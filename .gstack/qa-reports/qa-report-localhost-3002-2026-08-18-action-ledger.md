# Action Ledger QA — 2026-08-18

<qa_report>
  <verdict>PARTIAL</verdict>
  <core_slice_verdict>PASS</core_slice_verdict>
  <scope>ContractAction migration/schema, REST actions/approvals/evidence/delivery, obligation and renewal projections, MCP action reads and compatibility writes, direct email worker, dashboard/action queue/detail UI, English/Arabic responsive matrix.</scope>
  <failure_mode_coverage>
    <row n="1" category="empty input" tested="yes" evidence="QA regression submits {} and malformed JSON to action commands; both are rejected before action lookup or mutation. Focused Action suite also validates required command, assignee, deadline/condition and evidence fields."/>
    <row n="2" category="huge input" tested="yes" evidence="QA regression submits a 10 MiB block reason and receives 422 before DB access; route limits titles, reasons, descriptions, evidence notes and URLs."/>
    <row n="3" category="special chars" tested="yes" evidence="fast-check generated 100 full-Unicode/metacharacter action titles; list DTO round-tripped each title while omitting source text/hash/key. Delivery HTML escapes user-controlled content."/>
    <row n="4" category="concurrency" tested="yes" evidence="Optimistic action updates bind id+organizationId+expectedVersion; stale versions return 409. A forced P2002 duplicate delivery insert returns the existing attempt and does not enqueue a second email."/>
    <row n="5" category="auth/authz" tested="yes" evidence="Unauthenticated action access redirects to login; API-key writes and approvals require a human session; viewer writes fail before DB access; cross-org action lookup returns 404; text_read gates API-key source excerpts. test:isolation passed 11/11."/>
    <row n="6" category="numeric extremes" tested="yes" evidence="Number.MAX_SAFE_INTEGER expectedVersion and MCP page are rejected before Prisma. REST page/limit and MCP limit/page are positive bounded integers. Confidence formatting exercised by visual fixtures."/>
    <row n="7" category="state/lifecycle" tested="yes" evidence="Illegal jumps, evidence-kind mismatch, stale review, required current-version approval, rejection, completion, reopen, legacy obligation sync/delete and action approval isolation were exercised. Action approvals no longer advance contract lifecycle or trigger generic fanout."/>
    <row n="8" category="network/external" tested="yes" evidence="Direct-email enqueue failure records delivery failed and returns 503; worker tests cover SMTP failure and reconciliation failure without automatic external resend. Delivery is email-only to the assigned member; no notification fanout call is made."/>
    <row n="9" category="dirty data" tested="yes" evidence="Exact migration replay against a disposable PostgreSQL clone preserved 32 pre-existing contracts, created action/evidence/delivery objects and allowed a linked action insert; temp database was dropped. MCP create rollback regression proves projection failure cannot leave an orphan obligation."/>
    <row n="10" category="time/TZ" tested="yes" evidence="Action projection suite passed under Pacific/Kiritimati and America/Los_Angeles; action UI formats deadline-only dates in UTC. Renewal notice calculation was exercised with reviewed end-date/notice facts."/>
  </failure_mode_coverage>
  <property_based_tests>
    <test name="minimized action assignee" property="No generated member email appears in an action-list DTO" inputs_tested="100">PASS</test>
    <test name="Unicode action title" property="Generated Unicode title round-trips while private source fields remain absent" inputs_tested="100">PASS</test>
  </property_based_tests>
  <tests_run>
    <test name="focused Action Ledger suite" result="pass" severity="blocker">12 files, 215 tests passed, including actions, approvals, obligations, MCP, projection, delivery worker, priority, dashboard and visual-fixture contracts.</test>
    <test name="adversarial action-ledger regressions" result="pass" severity="blocker">10/10 passed in apps/web/tests/integration/action-ledger-adversarial.qa.test.ts.</test>
    <test name="tenant isolation" result="pass" severity="blocker">11/11 passed.</test>
    <test name="typecheck and lint" result="pass" severity="blocker">TypeScript passed. Lint passed with existing img/useEffect warnings outside the Action Ledger change.</test>
    <test name="queue visual matrix" result="pass" severity="major">English and Arabic RTL at 320x720, 768x1024 and 1440x900: 6/6 passed with overflow, direction, console-error and primary-control assertions.</test>
    <test name="action-detail visual matrix" result="pass" severity="major">All English/Arabic/three-width cases reached the detail surface; one duplicate cold-development compile case was marked flaky, while its paired journey case and all other viewports passed.</test>
    <test name="full Phase 1 journey visual proof" result="fail" severity="major">The contract confirmation route did not display the seeded action text. Artifact: apps/web/test-results/visual-matrix/visual-matrix-Phase-1-Acti-0fa4b-l-proof-action-confirmation-en-mobile/test-failed-1.png.</test>
  </tests_run>
  <blockers>None for the bounded Action Ledger core slice. Do not declare Phase 1 Gate A complete: the contract/extraction confirmation surface and a full behavioral upload-to-review-to-delivery-to-completion E2E journey remain unproven.</blockers>
  <warnings>The approved URL view contract is not finished: current names/defaults are my_work, needs_review and due_soon rather than attention, review, mine and due-soon, and the optional due-window filter is absent. The action UI is behind NEXT_PUBLIC_ACTION_LEDGER_UI_ENABLED=true. The user-visible server on localhost:3002 remained unhealthy (login 500), so browser evidence was collected from an isolated single-server copy on localhost:3004. Action-list small filter/open controls remain below the 44px treatment used elsewhere. Migration enum rollback/runbook evidence is still absent.</warnings>
  <recommendations>Next: finish the explicit extraction confirmation choices (assign later, no fixed date/condition, evidence requirement), display/link the confirmed action on the contract, align URL filters, add a real state-changing E2E journey including approval/email/evidence completion, and repair/restart the local 3002 server before presenting the feature.</recommendations>
</qa_report>
