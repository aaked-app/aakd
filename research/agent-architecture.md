# Aaked Agent System Architecture
> Designed 2026-05-20. This is the target state — not yet implemented.
> Goal: a system that operates like a senior engineering team, not a collection of functions you call.

---

## Current state (what we have)

7 global agents: CEO, lead-engineer, product-manager, qa-tester, code-reviewer, researcher, content-writer.
1 project-local agent: clauseflow-engineer.

Problems:
- Agents are reactive only — called when needed, do nothing otherwise
- No automatic failure capture — if an agent makes a mistake, it's lost unless manually remembered
- No trust tiers — all agents have the same permission level
- No specialist coverage — no architect, no security, no devops
- Evolution cycle runs manually and infrequently
- Hooks: zero configured

---

## The Target Architecture — 4 Layers

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 4 — EVOLUTION ENGINE                             │
│  Agents improve themselves. CEO gates every change.     │
├─────────────────────────────────────────────────────────┤
│  LAYER 3 — NERVOUS SYSTEM                               │
│  Hooks fire automatically on lifecycle events.          │
│  Failure patterns captured. Context injected.           │
├─────────────────────────────────────────────────────────┤
│  LAYER 2 — COGNITIVE LOOP                               │
│  Every agent: Load → Plan → Act → Reflect → Propose     │
├─────────────────────────────────────────────────────────┤
│  LAYER 1 — TRUST TIERS                                  │
│  Agents have different permissions. Read < Write < Ship  │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Trust Tiers

Not all agents should be able to do everything. Currently they all can.

| Tier | Agents | Tools allowed | Can deploy? |
|---|---|---|---|
| **Observer** | researcher, product-manager | Read, Grep, Glob, Bash (read-only), WebSearch | No |
| **Editor** | lead-engineer, clauseflow-engineer, content-writer | All tools | No |
| **Gatekeeper** | code-reviewer, qa-tester, architect | Read, Grep, Glob, Bash, Write (reports only) | No |
| **Commander** | CEO | All tools + Agent spawning | Yes (with approval) |

Implementation: set `tools:` frontmatter in each agent definition. Observer agents cannot use Edit or Write — they can only read and report. This prevents a researcher agent from accidentally modifying production files.

---

## Layer 2 — Cognitive Loop

Every agent definition should follow this structure, not just have a description:

```
1. CONTEXT LOAD    — what to read at the start of every task
2. TASK INTAKE     — how to receive and clarify the task
3. EXECUTION       — how to do the work
4. QUALITY CHECK   — what to verify before reporting done
5. REFLECT         — what to write to memory after the task
```

The reflect step is where self-improvement happens. After every task, the agent writes one sentence to its proposed-improvements.md if it encountered friction. This is the input to the evolution engine.

---

## Layer 3 — Nervous System (Hooks)

This is the most innovative piece. Claude Code has 25+ hook events. We use none of them. Here's the target setup:

### Hook 1 — Morning Brief (SessionStart)
```bash
# ~/.claude/hooks/session-start.sh
# Fires at the start of every Claude Code session
echo "=== Aaked Daily Brief ==="
echo "Branch: $(git branch --show-current)"
echo "Last 3 commits:"
git log --oneline -3
echo "Test status:"
pnpm test --passWithNoTests 2>&1 | tail -3
echo "Open PRs:"
gh pr list --limit 3 2>/dev/null || echo "none"
```
Every session starts with context already loaded. No more asking "where were we?"

### Hook 2 — Auto-Failure Capture (PostToolUse on Bash)
```bash
# ~/.claude/hooks/capture-failures.sh
# Fires after every Bash command
EXIT_CODE=$(jq -r '.tool_response.exit_code // 0')
COMMAND=$(jq -r '.tool_input.command')

if [ "$EXIT_CODE" != "0" ]; then
  AGENT=$(jq -r '.agent_type // "unknown"')
  DATE=$(date '+%Y-%m-%d %H:%M')
  echo "## $DATE — $AGENT" >> ~/.claude/agent-memory/$AGENT/failure-patterns.md
  echo "**Command:** $COMMAND" >> ~/.claude/agent-memory/$AGENT/failure-patterns.md
  echo "---" >> ~/.claude/agent-memory/$AGENT/failure-patterns.md
fi
```
Every agent failure is automatically logged. The evolution engine reads these. No manual work.

### Hook 3 — Pre-Compact State Save (PreCompact)
```bash
# ~/.claude/hooks/pre-compact.sh
# Fires before context compaction — saves working state
AGENT=$(jq -r '.agent_type // "ceo"')
SESSION=$(jq -r '.session_id')
DATE=$(date '+%Y-%m-%d %H:%M')
echo "## Compact checkpoint — $DATE (session $SESSION)" >> ~/.claude/agent-memory/$AGENT/checkpoints.md
```
Compaction wipes context. This captures the last known state of each agent before it happens.

### Hook 4 — Auto-Lint After Edit (PostToolUse on Edit/Write, async)
```bash
# ~/.claude/hooks/auto-lint.sh
# Fires asynchronously after every file edit — doesn't block the agent
FILE=$(jq -r '.tool_input.file_path // .tool_input.new_file_path')

if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  pnpm exec eslint "$FILE" --fix --quiet 2>&1
fi
```
Every TypeScript edit is auto-linted without the agent having to remember to do it.

### Hook 5 — Subagent Monitor (SubagentStop)
```bash
# ~/.claude/hooks/subagent-stop.sh
# Fires when any subagent completes
AGENT=$(jq -r '.agent_type')
DATE=$(date '+%Y-%m-%d %H:%M')
echo "$DATE — $AGENT completed" >> ~/.claude/agent-memory/ceo/activity-log.md
```
CEO always has a log of what agents ran and when. Passive observability.

### Hook 6 — Security Gate (PreToolUse on Bash — blocks danger)
```bash
# ~/.claude/hooks/security-gate.sh
# Fires before every Bash command — blocks catastrophic operations
COMMAND=$(jq -r '.tool_input.command')

BLOCKED_PATTERNS="rm -rf /|DROP TABLE|DELETE FROM .* WHERE 1|git push.*--force.*main|git push.*-f.*main"

if echo "$COMMAND" | grep -qE "$BLOCKED_PATTERNS"; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Blocked: matches destructive command pattern. Ask CEO to approve manually."
    }
  }'
fi
```
No agent — including the engineer — can accidentally drop a production table or force-push to main.

---

## Layer 4 — Evolution Engine

### How it works

```
Agent encounters friction
        ↓
Writes to ~/.claude/agent-memory/{agent}/proposed-improvements.md
        ↓
Failure hook auto-appends failure patterns
        ↓
CEO runs evolution cycle (biweekly)
        ↓
Reads all proposals + failure patterns
Accepts good ones, rejects bad ones
        ↓
Applies to ~/.claude/agents/{agent}.md
        ↓
Removes applied entries, marks rejected ones
```

### Evolution cycle trigger
Add a `CLAUDE.local.md` reminder:
```markdown
## Evolution Cycle
Run `/evolve-agents` every 2 weeks.
Last run: [update this date]
```

### What agents learn
- Which task types they struggle with (from failure-patterns.md)
- Which approaches worked (from successful task reflections)
- Which tool sequences are inefficient (from activity logs)

---

## New Agents to Add

### architect
```yaml
---
name: architect
description: >
  System design and technical decision-making before any code is written.
  Use for: file structure decisions, library selection, data model design,
  API contract design, performance tradeoff analysis. Always before lead-engineer
  starts on any feature > 2 files. Produces an ADR (Architecture Decision Record).
tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Write
model: opus
---
```
Uses Opus because architecture decisions are high-stakes and need the smartest reasoning. Everything else can use Sonnet.

### security-auditor
```yaml
---
name: security-auditor
description: >
  Pre-ship security review. Use after code-reviewer approves, before any
  production deploy. Checks: auth bypass paths, SQL injection, secrets exposure,
  org isolation violations (critical for Aaked), OWASP Top 10, rate limiting gaps.
  Returns PASS or FAIL with file:line citations.
tools: Read, Grep, Glob, Bash
model: sonnet
---
```
Read-only. Cannot modify files — only reports. Trust tier: Gatekeeper.

### devops
```yaml
---
name: devops
description: >
  Deployment, CI/CD, Docker, environment management, Vercel config, database
  migrations in production. Use for: anything touching deploy pipeline, env vars,
  Dockerfile, docker-compose, GitHub Actions, migration safety. Never touches
  application code.
tools: Read, Edit, Write, Bash, Glob, Grep
model: sonnet
---
```

### database-architect
```yaml
---
name: database-architect
description: >
  Prisma schema design, migration safety, index strategy, query performance,
  org-isolation enforcement at DB layer. Use before any schema change.
  Reviews: N+1 queries, missing indexes, migration reversibility, data loss risk.
  Returns migration plan with rollback steps.
tools: Read, Grep, Glob, Bash, Write
model: sonnet
---
```

---

## Updated Agent Pipeline

```
┌──────────────┐
│  researcher  │  ← any unknown before we commit to a direction
└──────┬───────┘
       ↓
┌──────────────┐
│product-manager│ ← spec with no open values
└──────┬───────┘
       ↓ CEO reviews spec — blocks if ambiguous
┌──────────────┐
│  architect   │  ← NEW: ADR before implementation starts
└──────┬───────┘
       ↓ CEO reviews ADR
┌──────────────────┐
│clauseflow-engineer│ ← implements
└──────┬───────────┘
       ↓
┌─────────────────┐
│database-architect│ ← NEW: if schema changed
└──────┬──────────┘
       ↓
┌──────────────┐
│  qa-tester   │  ← breaks it adversarially
└──────┬───────┘
       ↓ QA PASS required
┌──────────────────┐
│ security-auditor │  ← NEW: for any auth/API/data change
└──────┬───────────┘
       ↓ PASS required
┌──────────────┐
│code-reviewer │  ← final gate
└──────┬───────┘
       ↓ APPROVE required
┌──────┐
│ SHIP │
└──────┘
```

---

## Memory Architecture

### Current (flat, siloed)
```
~/.claude/agent-memory/
  ceo/
    decisions.md
    wassim-preferences.md
    ...
```

### Target (structured, cross-agent)
```
~/.claude/agent-memory/
  _shared/                    ← NEW: all agents can read this
    team-patterns.md          ← CEO writes lessons learned
    project-context.md        ← always-current project state
    failure-patterns.md       ← aggregated from all agents
  ceo/
    decisions.md
    wassim-preferences.md
    proposed-improvements.md
    activity-log.md           ← NEW: auto-written by SubagentStop hook
    checkpoints.md            ← NEW: auto-written by PreCompact hook
  architect/
    adrs/                     ← one file per Architecture Decision Record
    proposed-improvements.md
    failure-patterns.md       ← auto-written by failure hook
  clauseflow-engineer/
    proposed-improvements.md
    failure-patterns.md
  ... (same structure for each agent)
```

### Rules: path-scoped context loading
```
~/.claude/rules/
  prisma.md      ← loads when any *.prisma file is opened
  api.md         ← loads when any /api/**/*.ts is opened
  security.md    ← loads when auth files are touched
```

This means agents only get relevant context, not everything at once.

---

## The Innovative Pieces

### 1. Prompt-based safety hook
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "prompt",
        "prompt": "Is this bash command safe for a production codebase? Command: $ARGUMENTS. Respond only: {\"decision\": \"allow\"} or {\"decision\": \"deny\", \"reason\": \"...\"}",
        "model": "claude-haiku-4-5",
        "timeout": 5
      }]
    }]
  }
}
```
A Haiku model judges every bash command before it runs. Costs fractions of a cent. Catches things the security pattern can't.

### 2. Subagent memory persistence
Each agent definition includes:
```yaml
autoMemory: true
memoryDirectory: ~/.claude/agent-memory/{agent-name}/
```
Agents write their own learnings without CEO having to remember to capture them.

### 3. The "architect-first" gate
CEO's definition updated: before delegating ANY feature involving > 2 files to the engineer, the architect produces an ADR first. Engineer cannot start without a signed-off ADR. This catches bad structural decisions before they're baked into code.

### 4. Reputation tracking (manual for now)
After each completed task, CEO logs in `_shared/team-patterns.md`:
```
| Agent | Task type | Outcome | Notes |
|---|---|---|---|
| clauseflow-engineer | API route | ✅ | fast, correct |
| qa-tester | Auth bypass check | ✅ | caught 2 issues |
```
Over time: patterns emerge in which agents excel at which task types. CEO uses this to route tasks better.

---

## Implementation Order

| Step | What | Time |
|---|---|---|
| 1 | Add 4 new agent definitions | 30 min |
| 2 | Configure 6 hooks in ~/.claude/settings.json | 45 min |
| 3 | Create hook scripts in ~/.claude/hooks/ | 30 min |
| 4 | Restructure memory directories | 15 min |
| 5 | Add path-scoped rules to ~/.claude/rules/ | 20 min |
| 6 | Update CEO definition with architect-first gate | 10 min |
| 7 | Run first evolution cycle | 20 min |

Total: ~3 hours. Sequential, no parallel work needed.

---

## What changes day-to-day for Wassim

**Before:** "Go build X" → CEO → engineer → done (maybe)

**After:**
- Session opens with a brief: branch, last 3 commits, test status, open PRs — already in context
- Every edit is auto-linted
- Every bash failure is captured without asking
- Destructive commands are blocked before they run
- "Go build X" → CEO → architect ADR → engineer → DB review if schema changed → QA → security → reviewer → ship
- Every 2 weeks: evolution cycle surfaces what the agents learned and what to improve

The system gets smarter every 2 weeks without you having to manage it manually.
