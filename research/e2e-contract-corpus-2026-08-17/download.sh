#!/usr/bin/env bash
set -euo pipefail

CORPUS_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
FILES_DIR="$CORPUS_DIR/files"
RAW_DIR="$CORPUS_DIR/raw"
AGENT="Aakd E2E public-contract corpus research contact@example.com"

mkdir -p "$FILES_DIR" "$RAW_DIR"

download() {
  local target="$1"
  local source="$2"
  curl --fail --location --retry 3 --retry-delay 1 --max-filesize 15000000 \
    --user-agent "$AGENT" "$source" --output "$target"
}

download "$FILES_DIR/01-master-services-agreement-native.pdf" \
  "https://www.sec.gov/Archives/edgar/data/1285701/000113626110000125/exhibit10-28.pdf"
download "$FILES_DIR/02-asset-purchase-agreement-native.pdf" \
  "https://www.sec.gov/Archives/edgar/data/95301/000009530104000057/exh2-1.pdf"
download "$FILES_DIR/03-employment-agreement-native.pdf" \
  "https://www.sec.gov/Archives/edgar/data/812076/000081207607000024/exh10-23.pdf"
download "$FILES_DIR/04-collaborative-license-redline.pdf" \
  "https://www.sec.gov/Archives/edgar/data/1107332/000103221003000324/dex10131.pdf"
download "$FILES_DIR/05-outsourcing-msa-redacted-long.pdf" \
  "https://www.sec.gov/Archives/edgar/data/46989/000004698907000006/form10-k.pdf"
download "$FILES_DIR/06-equity-and-asset-purchase-agreement.pdf" \
  "https://www.sec.gov/Archives/edgar/data/1521365/000114036125019566/ef20049208_ex99-16.pdf"

# Public SEC image-only exhibit pages, preserved as a deliberately OCR-only PDF.
for page in 001 002 003 004 005 006; do
  download "$RAW_DIR/scanned-$page.jpg" \
    "https://www.sec.gov/Archives/edgar/data/1533615/000107878215001894/f8k111815_ex10z1${page}.jpg"
done
uv run --with img2pdf python - "$RAW_DIR" "$FILES_DIR/07-scanned-asset-purchase-agreement.pdf" <<'PY'
import pathlib
import sys
import img2pdf

raw_dir = pathlib.Path(sys.argv[1])
images = sorted(raw_dir.glob("scanned-*.jpg"))
pathlib.Path(sys.argv[2]).write_bytes(img2pdf.convert([str(image) for image in images]))
PY

# Public SEC HTML agreement transformed to DOCX only to cover the app's DOCX path.
download "$RAW_DIR/amendment-to-msa.html" \
  "https://www.sec.gov/Archives/edgar/data/1597033/000159703320000198/a1096amendmentnumber3.htm"
uv run --with beautifulsoup4 --with python-docx python - "$RAW_DIR/amendment-to-msa.html" "$FILES_DIR/08-amendment-to-msa.docx" <<'PY'
import pathlib
import sys
from bs4 import BeautifulSoup
from docx import Document

html = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
soup = BeautifulSoup(html, "html.parser")
text = soup.get_text("\n", strip=True)
document = Document()
document.add_heading("Amendment Number 3 to Master Services Agreement", 0)
for paragraph in text.splitlines():
    paragraph = paragraph.strip()
    if paragraph:
        document.add_paragraph(paragraph)
document.save(sys.argv[2])
PY

for file in "$FILES_DIR"/*.pdf; do
  pdfinfo "$file" >/dev/null
done
uv run --with python-docx python - "$FILES_DIR/08-amendment-to-msa.docx" <<'PY'
import sys
from docx import Document
assert len(Document(sys.argv[1]).paragraphs) > 10
PY

(cd "$FILES_DIR" && shasum -a 256 *.pdf *.docx) > "$CORPUS_DIR/SHA256SUMS"
printf 'Corpus ready: %s\n' "$FILES_DIR"
