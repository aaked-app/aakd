# Aakd gate scorecards

This directory is the canonical location for immutable phase-gate scorecards referenced by `PRODUCT.md`.

Create `phase-<n>-scorecard.md` before evidence collection for a qualitative gate begins. A phase cannot be declared passed or failed without its scorecard.

Each scorecard must contain:

- phase and gate;
- accountable owner and review authority;
- measurement unit and denominator;
- numeric PASS threshold;
- evidence source and exclusions;
- evidence-collection start date;
- PASS action;
- FAIL/redirect action;
- reusable artifacts retained after failure;
- signed decision history.

Thresholds may change only before evidence collection begins. Record the old value, new value and reason. After collection begins, a threshold change creates a new scorecard version and the current evaluation remains governed by the original version.

Do not use “reasonable,” “fast,” “bounded,” “multiple,” “repeat” or similar qualitative terms as the final decision threshold.
