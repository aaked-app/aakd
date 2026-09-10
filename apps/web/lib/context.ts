import { AsyncLocalStorage } from "async_hooks"

export interface RequestContext {
  userId: string
  organizationId: string
  /**
   * Database identity of the current organization membership. Real HTTP auth
   * always supplies it. It remains optional for contextless system work; every
   * agreement-access helper treats a missing value as a denial.
   */
  memberId?: string
  role: string
  scopes?: string[]
  /** Present only when the principal authenticated with a persisted API key. */
  apiKeyId?: string
  source: "session" | "api_key"
  requestId: string
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore()
}
