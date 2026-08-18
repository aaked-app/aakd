export type AuthErrorMessageKey =
  | "invalidCredentials"
  | "emailAlreadyRegistered"
  | "emailInvalid"
  | "passwordTooShort"
  | "authUnavailable"

type AuthErrorLike = { code?: string; message?: string } | null | undefined

/** Maps Better Auth failures to safe, actionable user-facing messages. */
export function authErrorMessageKey(error: AuthErrorLike): AuthErrorMessageKey {
  const code = error?.code?.toUpperCase() ?? ""
  const message = error?.message?.toLowerCase() ?? ""

  if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_PASSWORD" || code === "USER_NOT_FOUND") {
    return "invalidCredentials"
  }
  if (code.includes("USER_ALREADY_EXISTS") || message.includes("already exists") || message.includes("already registered")) {
    return "emailAlreadyRegistered"
  }
  if (code === "INVALID_EMAIL" || code === "VALIDATION_ERROR" || message.includes("invalid email")) {
    return "emailInvalid"
  }
  if (code === "PASSWORD_TOO_SHORT" || message.includes("password too short")) {
    return "passwordTooShort"
  }
  return "authUnavailable"
}
