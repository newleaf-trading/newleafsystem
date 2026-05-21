#!/usr/bin/env python3
"""
NewLeaf PDF Report Generator v2
Pipeline: JSON -> HTML (template fill) -> PDF (WeasyPrint)

Usage:
    python3 generate-report.py <stock-name>
    python3 generate-report.py slv
    python3 generate-report.py baba

Or with custom JSON:
    python3 generate-report.py <json-file> <output-pdf>

Flags:
    --legacy    Use old Adobe Java pipeline (v1 template)
    --part N    Generate only part N (1=Executive, 2=Trade, 3=Strategy)
    --all-parts Generate all 3 parts as separate PDFs
"""

import sys
import json
import base64
import re
import subprocess
from pathlib import Path
from datetime import datetime

# Configuration
BASE_DIR = Path(__file__).parent
TEMPLATE_V3 = BASE_DIR / "templates" / "report-v3.html"
TEMPLATE_V2 = BASE_DIR / "templates" / "report-v2.html"
TEMPLATE_V1 = BASE_DIR / "templates" / "institutional-report-enhanced.html"
TEMPLATE_PART1 = BASE_DIR / "templates" / "report-part1.html"
TEMPLATE_PART2 = BASE_DIR / "templates" / "report-part2.html"
TEMPLATE_PART3 = BASE_DIR / "templates" / "report-part3.html"
LOGO_PNG = BASE_DIR / "assets" / "logos" / "newleaf-logo.png"
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output" / "reports"
JAVA_JAR = BASE_DIR / "converter" / "target" / "html-to-pdf-converter-1.0.0-jar-with-dependencies.jar"
TEMP_DIR = BASE_DIR / "converter" / "output"


def print_header():
    print("=" * 70)
    print("NewLeaf PDF Report Generator v2 (WeasyPrint)")
    print("=" * 70)
    print()


def get_stock_config(stock_name):
    """Find JSON config for a stock. Prefer v2, fall back to base."""
    stock_lower = stock_name.lower()

    # Try v2 first, then enhanced, then base
    candidates = [
        DATA_DIR / f"{stock_lower}-iron-condor-v2.json",
        DATA_DIR / f"{stock_lower}-iron-condor-enhanced.json",
        DATA_DIR / f"{stock_lower}-iron-condor.json",
    ]

    for json_file in candidates:
        if json_file.exists():
            return json_file

    print(f"Error: No configuration found for '{stock_name}'")
    print(f"   Searched: {', '.join(c.name for c in candidates)}")
    print()
    print("Available stocks:")
    for f in sorted(DATA_DIR.glob("*.json")):
        stock = f.stem.split("-iron-condor")[0].upper()
        print(f"  - {stock} ({f.name})")
    sys.exit(1)


def validate_inputs(json_file, template_file):
    if not Path(json_file).exists():
        print(f"Error: JSON file not found: {json_file}")
        sys.exit(1)
    if not template_file.exists():
        print(f"Error: Template not found: {template_file}")
        sys.exit(1)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_json_data(json_file):
    print(f"Loading data: {Path(json_file).name}")
    with open(json_file, 'r') as f:
        data = json.load(f)
    print(f"  {len(data)} fields loaded")
    return data


def process_logo_b64():
    """Encode logo as base64 for inline embedding."""
    if not LOGO_PNG.exists():
        print(f"Warning: Logo not found at {LOGO_PNG}, skipping")
        return ""

    with open(LOGO_PNG, 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()


def fill_template(template_file, data, logo_b64):
    """Fill HTML template with JSON data placeholders."""
    print(f"Filling template: {template_file.name}")

    with open(template_file, 'r') as f:
        html = f.read()

    # Replace data placeholders
    filled = 0
    for key, value in data.items():
        placeholder = f'{{{{{key}}}}}'
        if placeholder in html:
            html = html.replace(placeholder, str(value))
            filled += 1

    print(f"  {filled} placeholders filled")

    # Embed logo if present in template
    if logo_b64:
        html = re.sub(
            r'<img\s+class="banner-logo"[^>]*>',
            f'<img class="banner-logo" src="{logo_b64}">',
            html
        )

    # Remove conditional sections where data is missing
    # Pattern: <!-- IF_MACRO --> ... <!-- /IF_MACRO --> removed if HAS_MACRO is empty
    for section in ["MACRO", "COMPANY", "ANALYST"]:
        flag = data.get(f"HAS_{section}", "")
        if not flag:
            html = re.sub(
                rf'<!-- IF_{section} -->.*?<!-- /IF_{section} -->',
                '',
                html,
                flags=re.DOTALL
            )
            print(f"  Skipped: {section} section (no data)")

    return html


def combine_templates(template_files, data, logo_b64):
    """Combine multiple part templates into a single HTML for unified page numbering."""
    # Use the CSS from part1 as the base (all parts share the same styles)
    with open(template_files[0], 'r') as f:
        base_html = f.read()

    # Extract CSS from head of part1
    head_match = re.search(r'(<head>.*?</head>)', base_html, re.DOTALL)
    head = head_match.group(1) if head_match else '<head></head>'

    # Update @page to show "Page X of Y"
    head = head.replace(
        'content: "Page " counter(page);',
        'content: "Page " counter(page) " of " counter(pages);'
    )

    # Extract body content from each template
    bodies = []
    for tmpl_file in template_files:
        with open(tmpl_file, 'r') as f:
            html = f.read()
        body_match = re.search(r'<body>(.*?)</body>', html, re.DOTALL)
        if body_match:
            bodies.append(body_match.group(1))

    combined_body = '\n'.join(bodies)

    combined_html = f"""<!DOCTYPE html>
<html lang="en">
{head}
<body>
{combined_body}
</body>
</html>"""

    # Now fill placeholders on the combined HTML
    print(f"Filling combined template ({len(template_files)} parts)")
    filled = 0
    for key, value in data.items():
        placeholder = f'{{{{{key}}}}}'
        if placeholder in combined_html:
            combined_html = combined_html.replace(placeholder, str(value))
            filled += 1
    print(f"  {filled} placeholders filled")

    # Embed logo
    if logo_b64:
        combined_html = re.sub(
            r'<img\s+class="banner-logo"[^>]*>',
            f'<img class="banner-logo" src="{logo_b64}">',
            combined_html
        )

    # Remove conditional sections
    for section in ["MACRO", "COMPANY", "ANALYST"]:
        flag = data.get(f"HAS_{section}", "")
        if not flag:
            combined_html = re.sub(
                rf'<!-- IF_{section} -->.*?<!-- /IF_{section} -->',
                '', combined_html, flags=re.DOTALL
            )
            print(f"  Skipped: {section} section (no data)")

    return combined_html


def generate_pdf_weasyprint(html_string, output_pdf):
    """Generate PDF using WeasyPrint."""
    print(f"Generating PDF with WeasyPrint...")

    try:
        import weasyprint
    except ImportError:
        print("Error: WeasyPrint not installed. Run: pip install weasyprint")
        sys.exit(1)

    try:
        template_dir = str(BASE_DIR / "templates") + "/"
        doc = weasyprint.HTML(string=html_string, base_url=template_dir)
        doc.write_pdf(str(output_pdf))

        pdf_size = Path(output_pdf).stat().st_size
        if pdf_size > 1024 * 1024:
            size_str = f"{pdf_size / 1024 / 1024:.1f} MB"
        else:
            size_str = f"{pdf_size / 1024:.1f} KB"

        print(f"  PDF generated: {Path(output_pdf).name} ({size_str})")
        return True

    except Exception as e:
        print(f"  Error generating PDF: {e}")
        return False


def generate_pdf_legacy(html_string, output_pdf):
    """Legacy: generate PDF using Java + Adobe converter."""
    if not JAVA_JAR.exists():
        print(f"Error: Java converter not built at {JAVA_JAR}")
        print("  Build it: cd converter && mvn clean package")
        sys.exit(1)

    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    temp_html = TEMP_DIR / "temp-report.html"

    with open(temp_html, 'w') as f:
        f.write(html_string)

    print(f"Converting to PDF via Adobe Java...")
    cmd = ['java', '-jar', str(JAVA_JAR), str(temp_html), str(output_pdf)]

    try:
        result = subprocess.run(cmd, cwd=BASE_DIR / "converter",
                                capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            pdf_size = Path(output_pdf).stat().st_size / 1024
            print(f"  PDF generated: {Path(output_pdf).name} ({pdf_size:.1f} KB)")
            return True
        else:
            print(f"  Conversion failed: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print("  Conversion timed out (>60s)")
        return False
    except Exception as e:
        print(f"  Error: {e}")
        return False


def get_flag_value(flag_name):
    """Get value of a --flag value pair from argv."""
    try:
        idx = sys.argv.index(f"--{flag_name}")
        if idx + 1 < len(sys.argv):
            return sys.argv[idx + 1]
    except ValueError:
        pass
    return None


def generate_part(json_file, template_file, output_pdf, data, logo_b64, use_legacy=False, page_offset=0):
    """Generate a single PDF from a template and data."""
    validate_inputs(json_file, template_file)
    html = fill_template(template_file, data, logo_b64)
    # Inject page counter offset so numbering continues from previous part
    if page_offset > 0:
        html = html.replace('</style>', f'\nbody {{ counter-reset: page {page_offset}; }}\n</style>', 1)
        print(f"  Page numbering starts at {page_offset + 1}")
    if use_legacy:
        return generate_pdf_legacy(html, output_pdf)
    else:
        return generate_pdf_weasyprint(html, output_pdf)


def count_pdf_pages(pdf_path):
    """Count pages in a PDF file."""
    try:
        from pypdf import PdfReader
        return len(PdfReader(str(pdf_path)).pages)
    except Exception:
        return 0


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 generate-report.py <stock-name>")
        print("  python3 generate-report.py slv")
        print("  python3 generate-report.py <json-file> <output-pdf>")
        print()
        print("Flags:")
        print("  --legacy      Use old Adobe Java pipeline")
        print("  --part N      Generate only part N (1=Executive, 2=Trade, 3=Strategy)")
        print("  --all-parts   Generate all 3 parts as separate PDFs")
        print("  --combined    Generate single PDF from all 3 parts (correct page numbers)")
        sys.exit(1)

    # Check for flags
    use_legacy = "--legacy" in sys.argv
    all_parts = "--all-parts" in sys.argv
    combined = "--combined" in sys.argv
    part_num = get_flag_value("part")
    skip_flags = {"--legacy", "--portrait", "--all-parts", "--combined"}
    args = []
    skip_next = False
    for a in sys.argv[1:]:
        if skip_next:
            skip_next = False
            continue
        if a == "--part":
            skip_next = True
            continue
        if a in skip_flags:
            continue
        args.append(a)

    if not args:
        print("Error: No stock name or JSON file specified")
        sys.exit(1)

    # Determine input/output
    if len(args) == 1:
        stock_name = args[0]
        json_file = get_stock_config(stock_name)
        timestamp = datetime.now().strftime("%Y%m%d")
        base_name = f"{stock_name.upper()}-Iron-Condor"
        output_pdf = OUTPUT_DIR / f"{base_name}-{timestamp}.pdf"
    else:
        json_file = Path(args[0])
        output_pdf = Path(args[1])
        base_name = output_pdf.stem

    print_header()

    try:
        # Load data
        data = load_json_data(json_file)

        # Process logo
        logo_b64 = process_logo_b64()

        # Determine which parts to generate
        if combined or all_parts or part_num:
            parts_to_gen = [int(part_num)] if part_num else [1, 2, 3]
            part_templates = {1: TEMPLATE_PART1, 2: TEMPLATE_PART2, 3: TEMPLATE_PART3}
            part_names = {1: "Executive-Summary", 2: "Trade-Analysis", 3: "Strategy-Deep"}

            results = []
            for pn in parts_to_gen:
                tmpl = part_templates[pn]
                pdf_out = output_pdf.parent / f"{base_name}-Part{pn}-{part_names[pn]}.pdf"
                print(f"\n--- Part {pn}: {part_names[pn]} ---")
                success = generate_part(json_file, tmpl, pdf_out, data, logo_b64, use_legacy)
                results.append((pn, pdf_out, success))

            print()
            print("=" * 70)
            for pn, pdf_out, success in results:
                status = "OK" if success else "FAILED"
                print(f"  Part {pn}: {status} -> {pdf_out.name}")

            all_ok = all(s for _, _, s in results)

            # If --combined, merge all parts and stamp page numbers
            if combined and all_ok and len(results) >= 2:
                try:
                    from pypdf import PdfWriter, PdfReader
                    from reportlab.pdfgen import canvas
                    from reportlab.lib.pagesizes import letter
                    from reportlab.lib.colors import HexColor
                    import io

                    # Step 1: Merge
                    writer = PdfWriter()
                    for _, pdf_path, _ in results:
                        writer.append(str(pdf_path))
                    merged_path = output_pdf.parent / f"{base_name}-Full.pdf"
                    writer.write(str(merged_path))
                    writer.close()

                    # Step 2: Stamp page numbers
                    reader = PdfReader(str(merged_path))
                    total = len(reader.pages)
                    stamped = PdfWriter()

                    for i, page in enumerate(reader.pages):
                        # Create overlay with page number
                        packet = io.BytesIO()
                        c = canvas.Canvas(packet, pagesize=letter)
                        c.setFont("Helvetica-Bold", 7)
                        c.setFillColor(HexColor("#0B0F14"))
                        text = f"Page {i+1} of {total}"
                        # Bottom-right, matching @bottom-right position
                        c.drawRightString(letter[0] - 36, 28, text)
                        c.save()
                        packet.seek(0)

                        overlay_reader = PdfReader(packet)
                        page.merge_page(overlay_reader.pages[0])
                        stamped.add_page(page)

                    stamped.write(str(merged_path))
                    stamped.close()

                    merged_size = merged_path.stat().st_size / 1024
                    print(f"\n  MERGED -> {merged_path.name} ({merged_size:.0f} KB, {total} pages)")
                except Exception as e:
                    import traceback
                    print(f"\n  Merge failed: {e}")
                    traceback.print_exc()

            print("=" * 70)
            sys.exit(0 if all_ok else 1)
        else:
            # Single full PDF (original behavior)
            if use_legacy:
                template_file = TEMPLATE_V1
            elif "--portrait" in sys.argv:
                template_file = TEMPLATE_V2
            else:
                template_file = TEMPLATE_V3

            validate_inputs(json_file, template_file)
            html = fill_template(template_file, data, logo_b64)

            if use_legacy:
                success = generate_pdf_legacy(html, output_pdf)
            else:
                success = generate_pdf_weasyprint(html, output_pdf)

            print()
            print("=" * 70)
            if success:
                print("SUCCESS! PDF generated")
                print(f"  {Path(output_pdf).absolute()}")
            else:
                print("FAILED - See errors above")
            print("=" * 70)

            sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print("\nInterrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
