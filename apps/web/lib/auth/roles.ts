export type Role = "owner" | "admin" | "legal" | "member" | "viewer"

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 5,
  admin: 4,
  legal: 3,
  member: 2,
  viewer: 1,
}

export function hasRole(userRole: string, requiredRole: Role): boolean {
  return (ROLE_HIERARCHY[userRole as Role] ?? 0) >= ROLE_HIERARCHY[requiredRole]
}

export function requireRole(role: string, required: Role): Response | null {
  if (!hasRole(role, required)) {
    return new Response("Forbidden", { status: 403 })
  }
  return null
}
