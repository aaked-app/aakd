import { mkdtemp, readdir, writeFile, unlink, rmdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"

// Named local builds are excluded from the base config to avoid checking stale
// artifacts. Explicit files ensure the current build's validators still run.
export async function generatedRouteConfig(appRoot, distDir) {
  const root = path.resolve(appRoot)
  const output = path.resolve(root, distDir)
  if (!output.startsWith(`${root}${path.sep}`)) {
    throw new Error("The Next build directory must be inside the application")
  }
  const typesRoot = path.join(output, "types")
  const files = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(filename)
      else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(filename)
    }
  }
  await visit(typesRoot)
  if (files.length === 0) throw new Error("No generated route types found; run the Next production build first")
  return {
    extends: path.join(root, "tsconfig.json"),
    compilerOptions: { incremental: false, noEmit: true },
    files: files.sort(),
  }
}

async function main() {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const config = await generatedRouteConfig(appRoot, process.env.NEXT_DIST_DIR || ".next")
  const directory = await mkdtemp(path.join(tmpdir(), "aakd-generated-route-types-"))
  const filename = path.join(directory, "tsconfig.json")
  try {
    await writeFile(filename, JSON.stringify(config), { mode: 0o600 })
    const require = createRequire(path.join(appRoot, "package.json"))
    console.log(`Checking ${config.files.length} generated Next type files`)
    const result = spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", filename], {
      cwd: appRoot, stdio: "inherit",
    })
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
  } finally {
    await unlink(filename).catch((error) => { if (error.code !== "ENOENT") throw error })
    await rmdir(directory)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
