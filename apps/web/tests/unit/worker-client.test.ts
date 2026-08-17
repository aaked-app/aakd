import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  pool: vi.fn(function Pool() {}),
  adapter: vi.fn(function PrismaPg() {}),
  prisma: vi.fn(function PrismaClient() {}),
}))

vi.mock("pg", () => ({ Pool: mocks.pool }))
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: mocks.adapter }))
vi.mock("@prisma/client", () => ({ PrismaClient: mocks.prisma }))

describe("worker Prisma client", () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.pool.mockReset()
    mocks.adapter.mockReset()
    mocks.prisma.mockReset()
    mocks.pool.mockImplementation(function Pool() {})
    mocks.adapter.mockImplementation(function PrismaPg() {})
    mocks.prisma.mockImplementation(function PrismaClient() {})
  })

  it("uses the validated DATABASE_POOL_SIZE for its only Prisma pool", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:password@db:5432/clauseflow")
    vi.stubEnv("DATABASE_POOL_SIZE", "7")

    const { getWorkerPrisma } = await import("@/lib/db/worker-client")
    getWorkerPrisma()

    expect(mocks.pool).toHaveBeenCalledWith({
      connectionString: "postgresql://postgres:password@db:5432/clauseflow",
      max: 7,
    })
    vi.unstubAllEnvs()
  })
})
