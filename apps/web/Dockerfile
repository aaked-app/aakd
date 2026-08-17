FROM node@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS base
RUN npm install -g pnpm@10.33.3

# ── deps: install all workspace deps with lockfile ───────────────────────────
FROM base AS deps
WORKDIR /app
# Copy manifests first — this layer is cached until a manifest changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# ── builder: compile the Next.js app ─────────────────────────────────────────
FROM base AS builder
WORKDIR /app
# Root node_modules (pnpm virtual store)
COPY --from=deps /app/node_modules ./node_modules
# Workspace-local node_modules — Docker dereferences symlinks so binaries
# like prisma and next become real files at apps/web/node_modules/.bin
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
# Copy full source (node_modules excluded via .dockerignore)
COPY . .
WORKDIR /app/apps/web
RUN node_modules/.bin/prisma generate
RUN pnpm run build

# ── runner: minimal production image ─────────────────────────────────────────
FROM node@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runner
WORKDIR /app
ENV NODE_ENV=production
# prisma CLI needed for migrate deploy at container start
RUN npm install -g prisma@7.8.0
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/prisma ./prisma
# prisma.config.ts is needed by Prisma 7 at runtime for migrate deploy
COPY --from=builder /app/apps/web/prisma.config.ts ./
# Prisma 7 loads this config before Next's standalone trace. Keep the
# explicit env loader available in the minimal runner image for migrations.
COPY --from=builder /app/apps/web/node_modules/@next/env ./node_modules/@next/env
# With outputFileTracingRoot set to the monorepo root, the standalone
# output mirrors the monorepo structure: server.js lives at apps/web/server.js
# and root node_modules are at the top level.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Static assets must be at the path server.js expects
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
WORKDIR /app
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Run pending migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node apps/web/server.js"]
