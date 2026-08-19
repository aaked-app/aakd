import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  instances: [] as Array<Record<string, unknown>>,
  Redis: vi.fn(),
}))

vi.mock("ioredis", () => ({
  default: state.Redis.mockImplementation(function RedisMock() {
    return state.instances.shift()
  }),
}))

function transactionResults(count = 1) {
  return [[null, 0], [null, 1], [null, count], [null, 1], [null, []]]
}

function redisClient(options: { connect?: () => Promise<void>; results?: unknown } = {}) {
  let status = "wait"
  const connect = vi.fn(async () => {
    await options.connect?.()
    status = "ready"
  })
  const exec = vi.fn().mockResolvedValue(options.results ?? transactionResults())
  return {
    get status() { return status },
    connect,
    on: vi.fn(),
    disconnect: vi.fn(),
    multi: vi.fn(() => ({
      zremrangebyscore: vi.fn(),
      zadd: vi.fn(),
      zcard: vi.fn(),
      expire: vi.fn(),
      zrange: vi.fn(),
      exec,
    })),
    exec,
  }
}

async function loadRateLimit() {
  return import("@/lib/rate-limit")
}

describe("rateLimit() — Redis connection and transaction safety", () => {
  beforeEach(() => {
    vi.resetModules()
    state.instances.length = 0
    state.Redis.mockClear()
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("REDIS_URL", "redis://localhost:6379")
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("shares one healthy cold connection across concurrent checks", async () => {
    const client = redisClient()
    state.instances.push(client)
    const { rateLimit } = await loadRateLimit()

    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => rateLimit(`cold-${index}`, 30, 60_000)))

    expect(results).toEqual(Array.from({ length: 10 }, () => ({ allowed: true, retryAfter: 0 })))
    expect(state.Redis).toHaveBeenCalledTimes(1)
    expect(client.connect).toHaveBeenCalledTimes(1)
  })

  it("fails closed for a failed connection and reconnects on the next check", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000)
    const failed = redisClient({ connect: async () => { throw new Error("Redis unavailable") } })
    const recovered = redisClient()
    state.instances.push(failed, recovered)
    const { rateLimit } = await loadRateLimit()

    expect(await rateLimit("recovery", 30, 60_000)).toEqual({ allowed: false, retryAfter: 60 })
    expect(await rateLimit("recovery", 30, 60_000)).toEqual({ allowed: false, retryAfter: 60 })
    expect(state.Redis).toHaveBeenCalledTimes(1)
    now.mockReturnValue(2_001)
    expect(await rateLimit("recovery", 30, 60_000)).toEqual({ allowed: true, retryAfter: 0 })
    expect(state.Redis).toHaveBeenCalledTimes(2)
    now.mockRestore()
  })

  it("fails closed when any Redis transaction command returns an error tuple", async () => {
    const client = redisClient({
      results: [[null, 0], [null, 1], [new Error("ZCARD failed"), null], [null, 1], [null, []]],
    })
    state.instances.push(client)
    const { rateLimit } = await loadRateLimit()

    expect(await rateLimit("malformed", 30, 60_000)).toEqual({ allowed: false, retryAfter: 60 })
  })
})
