#!/usr/bin/env python3
"""
NewLeaf Batch PDF Generator - Clean Version
Process multiple stock reports at once

Usage:
    python3 batch-generate.py slv baba
    python3 batch-generate.py all
"""

import sys
import subprocess
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

def print_header():
    """Print header"""
    print("=" * 70)
    print("🍃 NewLeaf Batch PDF Generator")
    print("=" * 70)
    print()

def get_available_stocks():
    """Get list of available stock configurations"""
    stocks = set()
    for f in DATA_DIR.glob("*-iron-condor*.json"):
        # Extract stock name from e.g. "slv-iron-condor-v2.json"
        stock = f.stem.split("-iron-condor")[0]
        stocks.add(stock)
    return sorted(stocks)

def process_batch(stock_names):
    """Process multiple stock reports"""
    total = len(stock_names)
    successes = 0
    failures = []

    print(f"📊 Processing {total} reports...")
    print()

    for i, stock_name in enumerate(stock_names, 1):
        print(f"[{i}/{total}] 📄 {stock_name.upper()}")

        # Call main generator script
        cmd = [
            'python3',
            str(BASE_DIR / 'generate-report.py'),
            stock_name
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode == 0:
                successes += 1
                print(f"         ✅ Success!")
            else:
                failures.append((stock_name, "Conversion failed"))
                print(f"         ❌ Failed!")
                # Print last line of error
                if result.stderr:
                    error_lines = result.stderr.strip().split('\n')
                    print(f"         Error: {error_lines[-1]}")

        except subprocess.TimeoutExpired:
            failures.append((stock_name, "Timeout"))
            print(f"         ❌ Timeout!")
        except Exception as e:
            failures.append((stock_name, str(e)))
            print(f"         ❌ Error: {e}")

        print()

    # Summary
    print("=" * 70)
    print("📊 BATCH SUMMARY")
    print("=" * 70)
    print(f"✅ Successful: {successes}/{total}")
    print(f"❌ Failed: {len(failures)}/{total}")

    if failures:
        print()
        print("Failed reports:")
        for stock_name, reason in failures:
            print(f"  • {stock_name.upper()}: {reason}")

    print()
    print(f"📁 Reports saved in: {BASE_DIR / 'output' / 'reports'}")
    print("=" * 70)

    return successes, len(failures)

def main():
    """Main execution"""
    if len(sys.argv) < 2:
        available = get_available_stocks()
        print("Usage:")
        print("  python3 batch-generate.py <stock-names...>")
        print("  python3 batch-generate.py all")
        print()
        print("Examples:")
        print("  python3 batch-generate.py slv baba")
        print("  python3 batch-generate.py all")
        print()
        print(f"Available stocks ({len(available)}):")
        for stock in available:
            print(f"  • {stock.upper()}")
        sys.exit(1)

    # Get stock names
    if sys.argv[1].lower() == 'all':
        stock_names = get_available_stocks()
    else:
        stock_names = [s.lower() for s in sys.argv[1:]]

    if not stock_names:
        print("❌ No stock configurations found!")
        sys.exit(1)

    print_header()
    successes, failures = process_batch(stock_names)

    sys.exit(0 if failures == 0 else 1)

if __name__ == "__main__":
    main()
