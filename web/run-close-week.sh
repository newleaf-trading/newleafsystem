#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# NewLeaf System — Friday Close Week Script
# ═══════════════════════════════════════════════════════════════════
#
#   ./run-close-week.sh
#
# What it does:
#   1. Closes all active tiles for the current week
#   2. Calculates P&L per position
#   3. Generates weekly review HTML page
#   4. Regenerates sitemap
#   5. Deploys to newleafsystem.com
#
# ═══════════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  NewLeaf System — Close Week                 ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# Step 1: Close the week
echo "  ▸ Step 1/3: Closing week..."
node pipeline/close-week.js

# Step 2: Regenerate sitemap
echo "  ▸ Step 2/3: Regenerating sitemap..."
python3 -c "
import os, datetime
base = 'https://newleafsystem.com'
dist = 'dist'
today = datetime.date.today().isoformat()
urls = []
for root, dirs, files in os.walk(dist):
    for f in files:
        if f == 'index.html':
            rel = os.path.relpath(root, dist)
            path = '/' if rel == '.' else '/' + rel.replace(os.sep, '/') + '/'
            if path == '/': priority, freq = '1.0', 'weekly'
            elif '/analysis/' in path: priority, freq = '0.8', 'weekly'
            elif '/picks/' in path: priority, freq = '0.9', 'weekly'
            else: priority, freq = '0.5', 'monthly'
            urls.append((path, freq, priority))
urls.sort()
xml = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n'
for path, freq, pri in urls:
    xml += f'  <url><loc>{base}{path}</loc><lastmod>{today}</lastmod><changefreq>{freq}</changefreq><priority>{pri}</priority></url>\n'
xml += '</urlset>\n'
open(f'{dist}/sitemap.xml','w').write(xml)
print(f'  ✓ sitemap.xml ({len(urls)} URLs)')
"

# Step 3: Deploy
echo "  ▸ Step 3/3: Deploying to Firebase..."
firebase deploy --only hosting:newleafsystem --project newleaf-trading 2>&1 | grep -E "Deploy|release|Hosting URL"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  ✅ Week closed + review published            ║"
echo "  ║                                              ║"
echo "  ║  🔗 https://newleafsystem.com/picks/review   ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
