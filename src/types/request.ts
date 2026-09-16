export interface RequestTimeoutOptions {
  timeoutMs?: number;
}

export interface RequestOptions<
  B = Record<string, string | number | boolean | null | undefined>,
> extends RequestTimeoutOptions {
  params?: object;
  body?: B;
}
