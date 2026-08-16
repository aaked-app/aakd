# Spec Kit pilot

This repository is evaluating GitHub Spec Kit for two substantial Aakd features.
It preserves feature intent; it does not replace `AGENTS.md`, `CLAUDE.md`, tests,
QA, review, CI, or release approval.

## Install the approved CLI version

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v0.16.4
```

Verify with `specify --version`. Do not install extensions, presets, or use
`$speckit-taskstoissues` during the pilot.

## Use it in Codex

Repository-local skills live in `.agents/skills`. Use `$speckit-specify`, optional
`$speckit-clarify`, `$speckit-plan`, `$speckit-tasks`, and `$speckit-analyze`.
After implementation, use `$speckit-converge` to reconcile code with artifacts.

## Choose the right work

Use the pilot for a substantial feature, external integration, workflow change, or
auth/schema change. Skip small fixes and urgent patches.

## Aakd-specific behavior

The constitution and template overrides make authors decide which tenant, audit,
storage, job, AI, localization, accessibility, and E2E requirements apply. Overrides
take priority without modifying Spec Kit's installed templates.

## Exit criteria

After two features, decide whether the process materially improved requirement
clarity and verification. Keep, refine, or remove the pilot based on evidence.
