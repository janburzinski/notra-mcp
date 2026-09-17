/**
 * Benchmark harness for the remote MCP server.
 *
 *   node scripts/bench-perf.mjs server [path/to/build/server.js]  # createServer() latency
 *   node scripts/bench-perf.mjs http [path/to/build/http.js]      # load test, 50 concurrent
 *
 * The http mode starts a mock Notra API (instant canned responses) so results
 * isolate MCP-server overhead from upstream latency, then spawns the built
 * HTTP server and drives the modern 2026-07-28 protocol path. Run it against
 * two builds (e.g. main vs a branch) to compare.
 *
 * Env knobs: BENCH_CONCURRENCY (50), BENCH_DURATION_S (8), BENCH_WARMUP_MS (500).
 */
import { execSync, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer as createHttpServer } from "node:http";
import { performance } from "node:perf_hooks";
import http from "node:http";

const [mode, target] = process.argv.slice(2);
const root = new URL("..", import.meta.url).pathname;

const CONCURRENCY = Number(process.env.BENCH_CONCURRENCY ?? 50);
const DURATION_S = Number(process.env.BENCH_DURATION_S ?? 8);
const WARMUP_MS = Number(process.env.BENCH_WARMUP_MS ?? 500);

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function benchCreateServer(serverPath) {
  const { createServer } = await import(serverPath);
  const coldStart = performance.now();
  createServer("bench-key");
  const cold = performance.now() - coldStart;

  const iterations = 2_000;
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    createServer("bench-key");
  }
  const total = performance.now() - start;
  return { coldMs: round(cold), warmAvgMs: round(total / iterations), iterations };
}

const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};

function requestBody(mode) {
  if (mode === "list") {
    return JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: META } });
  }
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "list_posts", arguments: {}, _meta: META },
  });
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function rssMb(pid) {
  try {
    return Number(execSync(`ps -o rss= -p ${pid}`).toString().trim()) / 1024;
  } catch {
    return undefined;
  }
}

async function runPhase(port, mode) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY * 2 });
  const body = requestBody(mode);
  const latencies = [];
  let errors = 0;
  let done = false;

  const worker = async () => {
    while (!done) {
      const started = performance.now();
      try {
        await new Promise((resolve, reject) => {
          const req = http.request(
            {
              agent,
              host: "127.0.0.1",
              port,
              path: "/mcp",
              method: "POST",
              headers: {
                "content-type": "application/json",
                accept: "application/json, text/event-stream",
                authorization: "Bearer bench-key",
                "mcp-protocol-version": "2026-07-28",
                "mcp-method": mode === "list" ? "tools/list" : "tools/call",
                ...(mode === "call" ? { "mcp-name": "list_posts" } : {}),
              },
            },
            (res) => {
              res.resume();
              res.on("end", () => {
                if (res.statusCode === 200) resolve();
                else reject(new Error(`HTTP ${res.statusCode}`));
              });
            },
          );
          req.on("error", reject);
          req.end(body);
        });
        latencies.push(performance.now() - started);
      } catch {
        errors += 1;
      }
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, worker);
  await new Promise((resolve) => setTimeout(resolve, WARMUP_MS));
  latencies.length = 0; // discard warmup samples
  errors = 0;
  const measuredStart = performance.now();
  setTimeout(() => {
    done = true;
  }, DURATION_S * 1000);
  await Promise.all(workers);
  const measuredS = (performance.now() - measuredStart) / 1000;
  agent.destroy();

  latencies.sort((a, b) => a - b);
  return {
    mode,
    concurrency: CONCURRENCY,
    requests: latencies.length,
    errors,
    reqPerSec: round(latencies.length / measuredS),
    p50ms: round(percentile(latencies, 50)),
    p95ms: round(percentile(latencies, 95)),
    p99ms: round(percentile(latencies, 99)),
    maxMs: round(latencies.at(-1) ?? 0),
  };
}

async function benchHttp(httpPath) {
  const upstream = createHttpServer((req, res) => {
    if (req.method === "GET" && req.url?.startsWith("/v1/posts")) {
      res.writeHead(200, { "content-type": "application/json" }).end('{"posts":[],"nextOffset":null}');
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end("{}");
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");

  const child = spawn(process.execPath, [httpPath], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "0",
      NOTRA_API_BASE: `http://127.0.0.1:${upstream.address().port}`,
      NOTRA_MCP_RESOURCE: "http://127.0.0.1",
      WORKOS_AUTHKIT_DOMAIN: "auth.example.test",
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const port = await new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      const port = /listening on port (\d+)/.exec(String(chunk))?.[1];
      if (port) resolve(Number(port));
    });
    child.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
    setTimeout(() => reject(new Error("server did not start in 15s")), 15_000);
  });

  try {
    const call = await runPhase(port, "call");
    const list = await runPhase(port, "list");
    const rssAfterLoad = rssMb(child.pid);
    // Per-call AbortSignal.timeout compositions live until their 30s deadline;
    // after a cooldown only true leaks remain.
    await new Promise((resolve) => setTimeout(resolve, 35_000));
    const rssAfterCooldown = rssMb(child.pid);
    return {
      server: httpPath,
      phases: [call, list],
      rssMbAfterLoad: rssAfterLoad,
      rssMbAfter35sCooldown: rssAfterCooldown,
    };
  } finally {
    child.kill();
    upstream.closeAllConnections();
    upstream.close();
  }
}

const results =
  mode === "server"
    ? await benchCreateServer(target ?? `${root}build/server.js`)
    : await benchHttp(target ?? `${root}build/http.js`);
console.log(JSON.stringify(results, null, 2));
