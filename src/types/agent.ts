export interface AgentSessionSummary {
  sessionId: string;
  chatId: string | null;
  surface: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListAgentChatsParams {
  limit?: number;
}

export interface AgentChatsListResponse {
  sessions: AgentSessionSummary[];
}
