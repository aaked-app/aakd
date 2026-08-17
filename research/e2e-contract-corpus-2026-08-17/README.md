# Aakd public real-contract E2E corpus

This is a reproducible local corpus for testing Aakd with publicly filed legal
agreements. It deliberately spans agreement type, document length, redactions,
native text, image-only scans, and the two supported upload formats (PDF and DOCX).

## Build locally

```bash
bash research/e2e-contract-corpus-2026-08-17/download.sh
```

Files are written to `files/`, which is ignored. The script records SHA-256 hashes
in `SHA256SUMS`. Re-run it when a source is unavailable or when you need a clean
corpus.

Build the clearly labeled synthetic fixtures too:

```bash
bash research/e2e-contract-corpus-2026-08-17/build-synthetic.sh
```

## Safety and use

- Sources are public SEC filings. They may contain redactions and business names.
- Use only for local testing. Do not upload these files to third-party AI providers,
  commit the downloaded binaries, or present them as Aakd templates/legal advice.
- The image-only sample is composed from original public exhibit pages solely to
  exercise OCR; its manifest preserves the original filing URL.

## Coverage matrix

| Dimension | Corpus coverage |
| --- | --- |
| Agreement types | MSA, purchase, employment, license, amendment |
| File formats | PDF and DOCX |
| Extraction quality | Native text, redacted, redline, long/schedule-heavy, image-only OCR |
| E2E workflows | Upload, conversion, worker handling, search, metadata, Q&A, signing attachment |

Synthetic fixtures cover clean SaaS language, bilingual DOCX content, and deliberately
poor OCR input. They are non-legal test data, not contract templates.

Use the `tests` field in `manifest.json` as the minimum verification checklist per
file. A passing upload alone is not a passing corpus run: verify the worker outcome,
download retention, searchability, and no cross-organization leakage.
