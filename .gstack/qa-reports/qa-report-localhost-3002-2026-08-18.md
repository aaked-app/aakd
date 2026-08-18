# QA report: Aakd landing CLM clarity

- Date: 2026-08-18
- Target: `http://localhost:3002/`
- Scope: approved landing-only redesign
- Framework: Next.js
- Verdict: PASS
- Health score: 99/100

## Evidence

- Live visual checks: EN and AR at 320×720, 768×1024, and 1440×900.
- Locale switching: EN, FR, DE, ES, AR all render one localized H1 and one proof figure; Arabic sets `lang=ar`, `dir=rtl`.
- Responsive: document width equals viewport at all three sizes; tablet proof and lifecycle are 2×2; mobile proof order is source → extraction → obligation → activity → access.
- Accessibility: one H1, semantic figure/articles/list, visible keyboard focus rings, 44px CTA targets, one proof tree, Arabic source uses `bdi dir=auto`.
- Navigation: hero Create workspace reaches `/register`; GitHub CTA remains `https://github.com/aaked-app/aakd`.
- Metadata: exact approved title and description.
- Runtime: zero console errors; observed local resources returned 200.
- Automated: `landing-page.test.tsx` + `phase-0-public-truth.test.ts`: 12/12 passed.

Screenshots:

- `/private/tmp/aakd-landing-qa-20260818/en-320.png`
- `/private/tmp/aakd-landing-qa-20260818/en-768.png`
- `/private/tmp/aakd-landing-qa-20260818/en-1440.png`
- `/private/tmp/aakd-landing-qa-20260818/ar-320.png`
- `/private/tmp/aakd-landing-qa-20260818/ar-768.png`
- `/private/tmp/aakd-landing-qa-20260818/ar-1440.png`

## Finding

LOW, outside landing diff: the shared cookie banner remains English in Arabic and other non-English locales. The redesigned landing content itself is localized and RTL-correct.

## Failure Mode Matrix

1. Empty input: PASS. Unauthenticated load with no explicit locale returns 200 and defaults to English.
2. Huge input: N/A. Static public page has no user input or collection mutation surface.
3. Special characters: PASS. Arabic, mixed Latin/Arabic names, API/MCP, punctuation, and `bdi dir=auto` render without overflow.
4. Concurrency/races: PASS. Repeated locale switches and reloads remained coherent with no console errors.
5. Auth/authz: PASS. Public route loads unauthenticated, contains only synthetic proof, and routes to public registration.
6. Numeric extremes: PASS. Boundary viewports 320/768/1440 show no horizontal overflow and visible CTAs stay at least 44px tall.
7. State/lifecycle: PASS. Locale survives reload, CTA navigation, and browser back; Arabic returns with RTL intact.
8. Network/external: PASS. All observed page/local asset requests returned 200; no remote hero dependency was loaded.
9. Dirty data: N/A. Static synthetic proof performs no persisted read/write and calls no product API.
10. Time/TZ: N/A. “Due in 10 days” is fixed illustrative copy, not a date calculation.

Property-based testing: N/A for this black-box static UI slice; no new non-trivial pure function was exposed for testing.
