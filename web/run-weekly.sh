#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# NewLeaf System — Weekly Publish Script
# ═══════════════════════════════════════════════════════════════════
#
# One command to publish your weekly picks:
#   ./run-weekly.sh "IV elevated — premium selling favoured"
#
# What it does:
#   1. Creates weekly picks from your published tiles
#   2. Generates analysis HTML pages for each pick
#   3. Regenerates sitemap.xml
#   4. Deploys everything to newleafsystem.com
#
# Prerequisites:
#   - Tiles already published from strategy-builder (Publish to Firebase button)
#   - npm install done
#
# ═══════════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

THEME="${1:-Options strategies selected by NewLeaf scoring engine}"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  NewLeaf System — Weekly Publish             ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
echo "  Theme: $THEME"
echo ""

# Step 1: Create weekly picks
echo "  ▸ Step 1/4: Creating weekly picks..."
node pipeline/create-weekly-picks.js --theme "$THEME"

# Step 2: Generate analysis pages
echo "  ▸ Step 2/4: Generating analysis pages..."
node pipeline/generate-analysis-pages.js

# Step 3: Regenerate sitemap
echo "  ▸ Step 3/4: Regenerating sitemap..."
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

# Step 4: Deploy
echo "  ▸ Step 4/4: Deploying to Firebase..."
firebase deploy --only hosting:newleafsystem --project newleaf-trading 2>&1 | grep -E "Deploy|release|Hosting URL"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  ✅ Weekly publish complete                   ║"
echo "  ║                                              ║"
echo "  ║  🔗 https://newleafsystem.com/picks          ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
