#!/usr/bin/env bash
set -euo pipefail

CORPUS_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
FILES_DIR="$CORPUS_DIR/files"
mkdir -p "$FILES_DIR"

uv run --with reportlab --with pillow --with img2pdf --with python-docx python - "$FILES_DIR" <<'PY'
from io import BytesIO
from pathlib import Path
import sys

import img2pdf
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib import colors

files = Path(sys.argv[1])
styles = getSampleStyleSheet()

def header(canvas, _):
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.darkred)
    canvas.drawString(0.65 * inch, 0.45 * inch, "SYNTHETIC TEST DOCUMENT — NOT LEGAL ADVICE")
    canvas.restoreState()

def para(text, style="BodyText"):
    return Paragraph(text, styles[style])

# Native PDF: SaaS MSA with the clauses Aakd should recognize.
story = [para("SaaS Master Services Agreement", "Title"),
         para("Synthetic E2E Fixture — Not a legal template", "BodyText"), Spacer(1, 0.25 * inch)]
clauses = [
    ("1. Parties and Effective Date", "This agreement is made between Northstar Labs GmbH (Customer) and Harbor Cloud, Inc. (Provider) and takes effect on 1 January 2026."),
    ("2. Services", "Provider will supply the hosted contract-workflow service described in Order Forms executed under this Agreement."),
    ("3. Term and Renewal", "The initial term is twelve months. It renews automatically for successive twelve-month periods unless either party gives forty-five days written notice before renewal."),
    ("4. Fees", "Customer will pay EUR 24,000 annually, invoiced in advance. Undisputed invoices are due thirty days after receipt."),
    ("5. Confidentiality", "Each party will protect the other party's Confidential Information using reasonable safeguards and will use it only to perform this Agreement."),
    ("6. Data Protection", "The parties will process personal data only under the Data Processing Addendum. Provider will notify Customer of a confirmed security incident without undue delay."),
    ("7. Service Levels", "Provider targets 99.9% monthly availability, excluding planned maintenance. Service credits are Customer's remedy for a service-level failure."),
    ("8. Limitation of Liability", "Except for excluded claims, each party's aggregate liability is limited to fees paid in the twelve months before the event giving rise to liability."),
    ("9. Termination", "Either party may terminate for material breach not cured within thirty days after written notice. Customer may export its data for sixty days after termination."),
    ("10. Governing Law", "German law governs this Agreement, excluding conflict-of-laws rules. The courts of Berlin have exclusive jurisdiction.")]
for index, (title, body) in enumerate(clauses):
    story.extend([para(title, "Heading2"), para(body), Spacer(1, 0.1 * inch)])
    if index in {3, 6}:
        story.append(PageBreak())
story.extend([PageBreak(), para("Schedule A — Service Levels", "Heading1"),
              Table([["Metric", "Commitment", "Remedy"], ["Availability", "99.9% monthly", "Service credit"], ["Support response", "4 business hours for critical incidents", "Escalation"]], colWidths=[1.5*inch, 2.7*inch, 1.6*inch], style=TableStyle([("GRID", (0,0), (-1,-1), .5, colors.grey), ("BACKGROUND", (0,0), (-1,0), colors.lightgrey)]))])
SimpleDocTemplate(str(files / "09-synthetic-saas-msa.pdf"), pagesize=LETTER, title="Synthetic SaaS MSA").build(story, onFirstPage=header, onLaterPages=header)

# DOCX: bilingual DPA with a table-heavy processing annex.
document = Document()
title = document.add_heading("Data Processing Agreement / Auftragsverarbeitungsvertrag", 0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
document.add_paragraph("SYNTHETIC TEST DOCUMENT — NOT LEGAL ADVICE")
document.add_heading("1. Parties / Parteien", level=1)
document.add_paragraph("Northstar Labs GmbH acts as Controller / Verantwortlicher. Harbor Cloud, Inc. acts as Processor / Auftragsverarbeiter.")
document.add_heading("2. Processing / Verarbeitung", level=1)
document.add_paragraph("The Processor processes contract metadata, user identifiers and uploaded documents only on documented instructions. Der Auftragsverarbeiter verarbeitet Vertragsmetadaten, Nutzerkennungen und hochgeladene Dokumente nur auf dokumentierte Weisung.")
document.add_heading("3. Security and incidents / Sicherheit und Vorfälle", level=1)
document.add_paragraph("Processor maintains appropriate technical and organisational measures and notifies Controller without undue delay after becoming aware of a personal-data breach. Der Auftragsverarbeiter meldet Verletzungen des Schutzes personenbezogener Daten unverzüglich.")
document.add_heading("Annex A — Processing details / Einzelheiten der Verarbeitung", level=1)
table = document.add_table(rows=1, cols=3)
table.style = "Table Grid"
for cell, label in zip(table.rows[0].cells, ["Category / Kategorie", "Purpose / Zweck", "Retention / Aufbewahrung"]):
    cell.text = label
for row in [("Account identifiers", "Service delivery", "Term + 60 days"), ("Contract metadata", "Search and workflow", "Term + 60 days"), ("Support records", "Incident resolution", "24 months")]:
    cells = table.add_row().cells
    for cell, value in zip(cells, row):
        cell.text = value
document.save(str(files / "10-synthetic-bilingual-dpa.docx"))

# Image-only PDF: low contrast mutual NDA pages, intentionally unsuitable for text extraction.
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
pages = []
texts = [
    ["MUTUAL NON-DISCLOSURE AGREEMENT", "Synthetic E2E Fixture — NOT LEGAL ADVICE", "This Agreement is effective 15 February 2026 between Aurora Systems Ltd. and Meridian Analytics LLC.", "Each party may disclose Confidential Information solely to evaluate a potential business relationship."],
    ["CONFIDENTIALITY OBLIGATIONS", "The receiving party will protect Confidential Information using reasonable care and will not disclose it except to authorised representatives.", "These obligations continue for three years after disclosure."],
    ["TERM AND SIGNATURES", "Either party may terminate this Agreement on written notice. Termination does not remove confidentiality obligations for information already disclosed.", "Aurora Systems Ltd. ____________________   Meridian Analytics LLC ____________________"]]
for page_lines in texts:
    image = Image.new("RGB", (1650, 2200), (244, 242, 235))
    draw = ImageDraw.Draw(image)
    y = 180
    for line_number, line in enumerate(page_lines):
        draw.text((155, y), line, fill=(132, 129, 122), font=font if line_number == 0 else small)
        y += 115 if line_number == 0 else 85
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=55)
    pages.append(buffer.getvalue())
(files / "11-synthetic-scanned-mutual-nda.pdf").write_bytes(img2pdf.convert(pages))
PY

for file in "$FILES_DIR"/09-synthetic-saas-msa.pdf "$FILES_DIR"/11-synthetic-scanned-mutual-nda.pdf; do
  pdfinfo "$file" >/dev/null
done

(cd "$FILES_DIR" && shasum -a 256 *.pdf *.docx) > "$CORPUS_DIR/SHA256SUMS"
printf 'Synthetic fixtures ready: %s\n' "$FILES_DIR"
