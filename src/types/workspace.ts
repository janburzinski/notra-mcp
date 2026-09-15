import type { Organization } from "./api.js";

export type AuthenticationIdentity =
  | {
      type: "apiKey";
    }
  | {
      type: "oauth";
      accountId: string;
      scopes: string[];
    };

export interface WorkspaceMembership extends Organization {
  role: string | null;
  status: "active" | "pending";
  isCurrent: boolean;
}

export interface WorkspaceContextResponse {
  currentWorkspace: Organization;
  workspaces: WorkspaceMembership[];
  authentication: AuthenticationIdentity;
}

export interface WhoAmIResponse {
  workspace: Organization;
  authentication: AuthenticationIdentity;
}
