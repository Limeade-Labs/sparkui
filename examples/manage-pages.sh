#!/bin/bash
# manage-pages.sh — List, update, and delete pages
#
# Demonstrates the page management API: listing active pages,
# viewing details, updating content/TTL, and deleting.
#
# Usage:
#   export SPARKUI_TOKEN="your-push-token"
#   export SPARKUI_URL="http://localhost:3457"  # optional
#   ./examples/manage-pages.sh

set -euo pipefail

SPARKUI_URL="${SPARKUI_URL:-http://localhost:3457}"
SPARKUI_TOKEN="${SPARKUI_TOKEN:?Set SPARKUI_TOKEN to your push token}"
AUTH="Authorization: Bearer ${SPARKUI_TOKEN}"

echo "═══════════════════════════════════════"
echo "⚡ SparkUI Page Management Demo"
echo "═══════════════════════════════════════"
echo ""

# ── Step 1: Create a page ──
echo "1️⃣  Creating a feedback form page..."
RESPONSE=$(curl -s -X POST "${SPARKUI_URL}/api/push" \
  -H "${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "feedback-form",
    "data": {
      "title": "Quick Feedback",
      "fields": [
        { "name": "rating", "label": "How was your experience?", "type": "rating" },
        { "name": "comment", "label": "Comments", "type": "textarea" }
      ]
    },
    "ttl": 3600
  }')

PAGE_ID=$(echo "$RESPONSE" | jq -r '.id')
echo "   Created page: ${PAGE_ID}"
echo ""

# ── Step 2: List all active pages ──
echo "2️⃣  Listing active pages..."
curl -s "${SPARKUI_URL}/api/pages" \
  -H "${AUTH}" | jq '.pages[] | {id, template: .meta.template, views, createdAt}'
echo ""

# ── Step 3: Get page details ──
echo "3️⃣  Getting details for page ${PAGE_ID}..."
curl -s "${SPARKUI_URL}/api/pages/${PAGE_ID}" \
  -H "${AUTH}" | jq '{id, views, createdAt, expiresAt, meta: .meta}'
echo ""

# ── Step 4: Update the page (extend TTL) ──
echo "4️⃣  Extending TTL by 2 hours..."
curl -s -X PATCH "${SPARKUI_URL}/api/pages/${PAGE_ID}" \
  -H "${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{"ttl": 7200}' | jq '{id, expiresAt}'
echo ""

# ── Step 5: Delete the page ──
echo "5️⃣  Deleting page ${PAGE_ID}..."
curl -s -X DELETE "${SPARKUI_URL}/api/pages/${PAGE_ID}" \
  -H "${AUTH}" | jq .
echo ""

# ── Step 6: Verify deletion ──
echo "6️⃣  Verifying deletion (should return 404)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SPARKUI_URL}/api/pages/${PAGE_ID}" \
  -H "${AUTH}")
echo "   HTTP status: ${HTTP_CODE}"
echo ""

echo "✅ Done! Full lifecycle: create → list → details → update → delete → verify"
