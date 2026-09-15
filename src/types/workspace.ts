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

export interface WhoAmIResponse {
  workspace: Organization;
  authentication: AuthenticationIdentity;
}
