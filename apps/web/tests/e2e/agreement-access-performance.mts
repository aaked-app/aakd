import { writeFileSync } from "node:fs"
import pg from "pg"

const outputFlag = process.argv.indexOf("--output")
const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : undefined
if (!outputPath || outputPath.startsWith("--")) {
  throw new Error("Usage: tsx tests/e2e/agreement-access-performance.mts --output <evidence.json>")
}

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) throw new Error("DATABASE_URL is required")

type PlanNode = {
  "Node Type": string
  "Relation Name"?: string
  "Index Name"?: string
  Plans?: PlanNode[]
}

function flattenPlan(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(flattenPlan)]
}

const pool = new pg.Pool({ connectionString: databaseUrl, application_name: "aakd-agreement-access-performance" })
const client = await pool.connect()

try {
  await client.query("BEGIN")
  await client.query("SET LOCAL search_path TO pg_temp, public")
  await client.query(`
    CREATE TEMP TABLE "Contract" (
      "id" text PRIMARY KEY,
      "organizationId" text NOT NULL,
      "title" text NOT NULL,
      "updatedAt" timestamptz NOT NULL
    ) ON COMMIT DROP;
    CREATE TEMP TABLE "Member" (
      "id" text PRIMARY KEY,
      "organizationId" text NOT NULL,
      "userId" text NOT NULL
    ) ON COMMIT DROP;
    CREATE TEMP TABLE "ContractAccessGrant" (
      "id" text PRIMARY KEY,
      "organizationId" text NOT NULL,
      "contractId" text NOT NULL,
      "memberId" text NOT NULL
    ) ON COMMIT DROP;
    CREATE TEMP TABLE "ContractAction" (
      "id" text PRIMARY KEY,
      "organizationId" text NOT NULL,
      "contractId" text NOT NULL
    ) ON COMMIT DROP;
    CREATE TEMP TABLE "ContractChunk" (
      "id" text PRIMARY KEY,
      "organizationId" text NOT NULL,
      "contractId" text NOT NULL,
      "embedding" vector(3) NOT NULL
    ) ON COMMIT DROP;
    CREATE UNIQUE INDEX ON "ContractAccessGrant" ("contractId", "memberId");
    CREATE INDEX ON "ContractAccessGrant" ("organizationId", "memberId", "contractId");
    CREATE INDEX ON "Contract" ("organizationId", "updatedAt" DESC);
    CREATE INDEX ON "ContractAction" ("organizationId", "contractId");
    CREATE INDEX ON "ContractChunk" ("organizationId", "contractId");
  `)
  await client.query(`
    INSERT INTO "Contract" ("id", "organizationId", "title", "updatedAt")
    SELECT 'contract-' || n, 'org-performance', 'Agreement searchable ' || n, to_timestamp(n)
    FROM generate_series(1, 10000) AS n;
    INSERT INTO "Member" ("id", "organizationId", "userId")
    SELECT 'member-' || n, 'org-performance', 'user-' || n
    FROM generate_series(1, 100) AS n;
    INSERT INTO "ContractAccessGrant" ("id", "organizationId", "contractId", "memberId")
    SELECT
      'grant-' || member_number || '-' || slot,
      'org-performance',
      'contract-' || ((((member_number - 1) * 500 + slot) % 10000) + 1),
      'member-' || member_number
    FROM generate_series(1, 100) AS member_number
    CROSS JOIN generate_series(0, 499) AS slot;
    INSERT INTO "ContractAction" ("id", "organizationId", "contractId")
    SELECT 'action-' || n, 'org-performance', 'contract-' || n
    FROM generate_series(1, 10000) AS n;
    INSERT INTO "ContractChunk" ("id", "organizationId", "contractId", "embedding")
    SELECT 'chunk-' || n, 'org-performance', 'contract-' || n, '[1,0,0]'::vector
    FROM generate_series(1, 10000) AS n;
    ANALYZE "Contract";
    ANALYZE "Member";
    ANALYZE "ContractAccessGrant";
    ANALYZE "ContractAction";
    ANALYZE "ContractChunk";
  `)

  const cases = [
    {
      name: "direct_contract_probe",
      sql: `SELECT contract."id" FROM "Contract" contract WHERE contract."id" = 'contract-1' AND EXISTS (SELECT 1 FROM "ContractAccessGrant" access_grant WHERE access_grant."contractId" = contract."id" AND access_grant."organizationId" = 'org-performance' AND access_grant."memberId" = 'member-1')`,
      expected: 1,
    },
    {
      name: "paginated_contract_list",
      sql: `SELECT contract."id" FROM "Contract" contract WHERE contract."organizationId" = 'org-performance' AND EXISTS (SELECT 1 FROM "ContractAccessGrant" access_grant WHERE access_grant."contractId" = contract."id" AND access_grant."organizationId" = 'org-performance' AND access_grant."memberId" = 'member-1') ORDER BY contract."updatedAt" DESC LIMIT 50`,
      expected: 50,
    },
    {
      name: "action_list",
      sql: `SELECT action."id" FROM "ContractAction" action WHERE action."organizationId" = 'org-performance' AND EXISTS (SELECT 1 FROM "ContractAccessGrant" access_grant WHERE access_grant."contractId" = action."contractId" AND access_grant."organizationId" = 'org-performance' AND access_grant."memberId" = 'member-1')`,
      expected: 500,
    },
    {
      name: "full_text_search",
      sql: `SELECT contract."id" FROM "Contract" contract WHERE contract."organizationId" = 'org-performance' AND to_tsvector('simple', contract."title") @@ plainto_tsquery('simple', 'searchable') AND EXISTS (SELECT 1 FROM "ContractAccessGrant" access_grant WHERE access_grant."contractId" = contract."id" AND access_grant."organizationId" = 'org-performance' AND access_grant."memberId" = 'member-1')`,
      expected: 500,
    },
    {
      name: "semantic_search",
      sql: `SELECT chunk."id" FROM "ContractChunk" chunk WHERE chunk."organizationId" = 'org-performance' AND EXISTS (SELECT 1 FROM "ContractAccessGrant" access_grant WHERE access_grant."contractId" = chunk."contractId" AND access_grant."organizationId" = 'org-performance' AND access_grant."memberId" = 'member-1') ORDER BY chunk."embedding" <=> '[1,0,0]'::vector LIMIT 500`,
      expected: 500,
    },
    {
      name: "analytics_count",
      sql: `SELECT contract."id" FROM "Contract" contract WHERE contract."organizationId" = 'org-performance' AND EXISTS (SELECT 1 FROM "ContractAccessGrant" access_grant WHERE access_grant."contractId" = contract."id" AND access_grant."organizationId" = 'org-performance' AND access_grant."memberId" = 'member-1')`,
      expected: 500,
    },
    {
      name: "notification_recipient_intersection",
      sql: `SELECT member."userId" FROM "Member" member JOIN "ContractAccessGrant" access_grant ON access_grant."memberId" = member."id" AND access_grant."organizationId" = member."organizationId" WHERE member."organizationId" = 'org-performance' AND access_grant."contractId" = 'contract-1'`,
      expected: 5,
    },
  ]

  const evidence: Array<Record<string, unknown>> = []
  for (const testCase of cases) {
    const result = await client.query(testCase.sql)
    const explained = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${testCase.sql}`)
    const root = explained.rows[0]["QUERY PLAN"][0] as { Plan: PlanNode; [key: string]: unknown }
    const grantNodes = flattenPlan(root.Plan).filter((node) => node["Relation Name"] === "ContractAccessGrant")
    const grantSequentialScans = grantNodes.filter((node) => node["Node Type"] === "Seq Scan")
    if (result.rowCount !== testCase.expected) {
      throw new Error(`${testCase.name}: expected ${testCase.expected} rows, received ${result.rowCount}`)
    }
    if (grantNodes.length === 0 || grantSequentialScans.length > 0) {
      throw new Error(`${testCase.name}: ContractAccessGrant did not use an indexed plan`)
    }
    evidence.push({
      name: testCase.name,
      resultCount: result.rowCount,
      expectedCount: testCase.expected,
      grantNodes: grantNodes.map((node) => ({
        nodeType: node["Node Type"],
        indexName: node["Index Name"] ?? null,
      })),
      explain: root,
    })
  }

  writeFileSync(outputPath, `${JSON.stringify({
    fixture: { contracts: 10000, grants: 50000, members: 100 },
    cases: evidence,
  }, null, 2)}\n`, { flag: "wx" })
  process.stdout.write(`Agreement-access performance gate passed; evidence written to ${outputPath}\n`)
  await client.query("ROLLBACK")
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined)
  throw error
} finally {
  client.release()
  await pool.end()
}
