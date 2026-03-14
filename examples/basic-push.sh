#!/bin/bash
# basic-push.sh — Push a macro-tracker page to SparkUI
#
# Usage:
#   export SPARKUI_TOKEN="your-push-token"
#   export SPARKUI_URL="http://localhost:3457"  # optional, defaults to localhost
#   ./examples/basic-push.sh

set -euo pipefail

SPARKUI_URL="${SPARKUI_URL:-http://localhost:3457}"
SPARKUI_TOKEN="${SPARKUI_TOKEN:?Set SPARKUI_TOKEN to your push token}"

echo "⚡ Pushing macro-tracker page..."

curl -s -X POST "${SPARKUI_URL}/api/push" \
  -H "Authorization: Bearer ${SPARKUI_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "macro-tracker",
    "data": {
      "title": "Saturday Macros",
      "date": "2026-03-14",
      "targets": {
        "calories": { "current": 1250, "goal": 1900 },
        "protein": { "current": 62, "goal": 86 },
        "fat": { "current": 95, "goal": 162 },
        "carbs": { "current": 18, "goal": 25 }
      },
      "meals": [
        { "name": "Breakfast", "items": ["2 eggs scrambled", "Avocado", "Coffee w/ cream"], "calories": 520 },
        { "name": "Lunch", "items": ["Grilled chicken salad", "Ranch dressing"], "calories": 480 },
        { "name": "Snack", "items": ["Almonds (1 oz)"], "calories": 170 }
      ]
    },
    "ttl": 3600
  }' | jq .

echo ""
echo "✅ Page created! Open the fullUrl in your browser."
