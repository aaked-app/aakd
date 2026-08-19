# Phase 1 Action Ledger rollback

The migration is additive and must not be reversed by dropping its tables or
enums after production data exists. To roll back the user-facing release:

1. Set `NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED=false`.
2. Rebuild and redeploy the web application because this is a public build-time
   environment variable.
3. Leave the Action Ledger tables, relations, activities and projection data in
   place. Existing obligation and alert behavior remains compatible.
4. Investigate and repair the forward migration or UI, then re-enable with
   `NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED=true` and rebuild.

The API and MCP surfaces remain available while the UI is disabled so existing
integrations are not broken. A destructive database rollback requires a
separate, explicitly authorized data-retention plan and is not part of this
release rollback.
