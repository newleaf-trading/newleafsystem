#!/usr/bin/env python3
"""
Upload PDF reports and video scripts to Cloudflare R2.

Usage:
    python3 upload-to-r2.py CRM                    # upload all CRM files
    python3 upload-to-r2.py CRM --pdf-only          # PDFs only
    python3 upload-to-r2.py CRM --scripts-only      # scripts only
    python3 upload-to-r2.py --all                   # upload everything in output/

R2 Structure:
    reports/pdf/{SYMBOL}/{SYMBOL}-{Strategy}-20260408.pdf
    reports/pdf/{SYMBOL}/{SYMBOL}-{Strategy}-latest.pdf
    reports/scripts/{SYMBOL}/{SYMBOL}-video-script.md
    reports/scripts/{SYMBOL}/{SYMBOL}-video-script-brief.md
    reports/data/{SYMBOL}/{SYMBOL}-iron-condor-v2.json
"""

import sys
import json
import boto3
from pathlib import Path
from datetime import datetime
from botocore.config import Config

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
PDF_DIR = OUTPUT_DIR / "reports"
SCRIPT_DIR = OUTPUT_DIR / "scripts"
DATA_DIR = BASE_DIR / "data"

# Load R2 config
CONFIG_PATH = Path(__file__).parent.parent / "scanner" / "config.json"

def get_r2_client():
    with open(CONFIG_PATH) as f:
        config = json.load(f)
    r2 = config["r2"]

    client = boto3.client(
        "s3",
        endpoint_url=r2["endpoint"],
        aws_access_key_id=r2["accessKeyId"],
        aws_secret_access_key=r2["secretAccessKey"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    return client, r2["bucket"], r2["publicBaseUrl"]


def upload_file(client, bucket, local_path, r2_key, content_type):
    """Upload a single file to R2."""
    with open(local_path, "rb") as f:
        client.put_object(
            Bucket=bucket,
            Key=r2_key,
            Body=f.read(),
            ContentType=content_type,
            CacheControl="public, max-age=3600",
        )
    size_kb = local_path.stat().st_size / 1024
    print(f"  Uploaded: {r2_key} ({size_kb:.0f} KB)")
    return r2_key


def get_content_type(path):
    ext = path.suffix.lower()
    return {
        ".pdf": "application/pdf",
        ".md": "text/markdown",
        ".json": "application/json",
        ".html": "text/html",
    }.get(ext, "application/octet-stream")


def upload_symbol(symbol, client, bucket, base_url, pdf_only=False, scripts_only=False):
    """Upload all files for a given symbol."""
    sym = symbol.upper()
    sym_lower = symbol.lower()
    uploaded = []

    timestamp = datetime.now().strftime("%Y%m%d")

    if not scripts_only:
        # PDFs — find all PDF files matching this symbol (any strategy)
        pdf_files = list(PDF_DIR.glob(f"{sym}-*-{timestamp}.pdf"))
        for pdf_path in pdf_files:
            r2_key = f"reports/pdf/{sym}/{pdf_path.name}"
            upload_file(client, bucket, pdf_path, r2_key, "application/pdf")
            uploaded.append(f"{base_url}/{r2_key}")

            # Also upload as "latest" (strip the timestamp from filename)
            latest_name = pdf_path.name.replace(f"-{timestamp}", "-latest")
            r2_key_latest = f"reports/pdf/{sym}/{latest_name}"
            upload_file(client, bucket, pdf_path, r2_key_latest, "application/pdf")
            uploaded.append(f"{base_url}/{r2_key_latest}")

    if not pdf_only:
        # Scripts
        script_files = [
            f"{sym}-video-script.md",
            f"{sym}-video-script-brief.md",
        ]
        for sf in script_files:
            script_path = SCRIPT_DIR / sf
            if script_path.exists():
                r2_key = f"reports/scripts/{sym}/{sf}"
                upload_file(client, bucket, script_path, r2_key, "text/markdown")
                uploaded.append(f"{base_url}/{r2_key}")

        # Data JSON
        json_path = DATA_DIR / f"{sym_lower}-iron-condor-v2.json"
        if json_path.exists():
            r2_key = f"reports/data/{sym}/{sym_lower}-iron-condor-v2.json"
            upload_file(client, bucket, json_path, r2_key, "application/json")
            uploaded.append(f"{base_url}/{r2_key}")

    return uploaded


def upload_manifest(client, bucket, symbols):
    """Upload a manifest with trade data per symbol for the dynamic index page."""
    NAMES = {
        "NVDA": "NVIDIA Corporation", "ADBE": "Adobe Inc.", "QQQ": "Invesco QQQ Trust",
        "CRM": "Salesforce Inc.", "AAPL": "Apple Inc.", "MSFT": "Microsoft Corp.",
        "TSLA": "Tesla Inc.", "SPY": "SPDR S&P 500 ETF", "SLV": "iShares Silver Trust",
        "BABA": "Alibaba Group", "AMD": "AMD Inc.", "META": "Meta Platforms Inc.",
        "AMZN": "Amazon.com Inc.", "GOOGL": "Alphabet Inc.",
    }

    trades = []
    for sym in sorted(symbols):
        entry = {"symbol": sym, "company": NAMES.get(sym, sym)}
        json_path = DATA_DIR / f"{sym.lower()}-iron-condor-v2.json"
        if json_path.exists():
            with open(json_path) as f:
                d = json.load(f)
            entry.update({
                "price": d.get("CURRENT_PRICE", ""),
                "strategy": d.get("STRATEGY_NAME", "Iron Condor"),
                "expiry": d.get("EXPIRATION_DATE", ""),
                "dte": d.get("DAYS_TO_EXPIRY", ""),
                "credit": d.get("NET_CREDIT", ""),
                "maxProfit": d.get("MAX_PROFIT", ""),
                "maxLoss": d.get("MAX_LOSS", ""),
                "winRate": d.get("WIN_RATE", ""),
                "score": d.get("TRADE_SCORE", ""),
                "confidence": d.get("CONFIDENCE_LEVEL", ""),
                "strikes": f"{d.get('LONG_PUT_STRIKE','')}/{d.get('SHORT_PUT_STRIKE','')}P | {d.get('SHORT_CALL_STRIKE','')}/{d.get('LONG_CALL_STRIKE','')}C",
            })

        # Check which files exist
        timestamp = datetime.now().strftime("%Y%m%d")
        entry["hasLandscape"] = (PDF_DIR / f"{sym}-Iron-Condor-{timestamp}.pdf").exists()
        entry["hasPortrait"] = any(PDF_DIR.glob(f"{sym}-Iron-Condor-Portrait-*.pdf"))
        entry["hasScript"] = (SCRIPT_DIR / f"{sym}-video-script.md").exists()
        entry["hasBrief"] = (SCRIPT_DIR / f"{sym}-video-script-brief.md").exists()
        entry["date"] = timestamp
        trades.append(entry)

    manifest = {
        "updated": datetime.now().isoformat(),
        "count": len(trades),
        "trades": trades,
    }
    client.put_object(
        Bucket=bucket,
        Key="reports/manifest.json",
        Body=json.dumps(manifest, indent=2),
        ContentType="application/json",
        CacheControl="public, max-age=60",
    )
    print(f"  Uploaded: reports/manifest.json ({len(trades)} trades)")


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 upload-to-r2.py CRM           # upload all CRM files")
        print("  python3 upload-to-r2.py CRM --pdf-only")
        print("  python3 upload-to-r2.py CRM --scripts-only")
        print("  python3 upload-to-r2.py --all          # upload everything")
        sys.exit(1)

    pdf_only = "--pdf-only" in sys.argv
    scripts_only = "--scripts-only" in sys.argv
    upload_all = "--all" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    print("Connecting to Cloudflare R2...")
    client, bucket, base_url = get_r2_client()
    print(f"Bucket: {bucket}")
    print()

    all_uploaded = []
    symbols_uploaded = []

    if upload_all:
        # Find all symbols with PDFs (any strategy name)
        symbols = set()
        for f in PDF_DIR.glob("*.pdf"):
            # Extract symbol: first segment before the first dash followed by a non-uppercase char
            parts = f.stem.split("-")
            if parts and parts[0] == parts[0].upper() and parts[0].isalpha():
                symbols.add(parts[0])
        for sym in sorted(symbols):
            print(f"--- {sym} ---")
            urls = upload_symbol(sym, client, bucket, base_url, pdf_only, scripts_only)
            all_uploaded.extend(urls)
            symbols_uploaded.append(sym)
            print()
    else:
        for sym in args:
            sym = sym.upper()
            print(f"--- {sym} ---")
            urls = upload_symbol(sym, client, bucket, base_url, pdf_only, scripts_only)
            all_uploaded.extend(urls)
            symbols_uploaded.append(sym)
            print()

    # Update manifest + index page
    if symbols_uploaded:
        upload_manifest(client, bucket, symbols_uploaded)

        # Regenerate index.html
        import subprocess
        print("\nRegenerating index page...")
        subprocess.run([sys.executable, str(BASE_DIR / "generate-index.py")], cwd=str(BASE_DIR))

    print("=" * 60)
    print(f"Uploaded {len(all_uploaded)} files for {len(symbols_uploaded)} symbol(s)")
    print()
    print("Public URLs:")
    for url in all_uploaded:
        print(f"  {url}")
    print(f"\nIndex page: {base_url}/reports/index.html")


if __name__ == "__main__":
    main()
