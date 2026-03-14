#!/bin/bash
# compose-page.sh — Compose a custom page from individual components
#
# This example builds a "Team Standup" page using header, checklist,
# stats, form, and button components.
#
# Usage:
#   export SPARKUI_TOKEN="your-push-token"
#   export SPARKUI_URL="http://localhost:3457"  # optional
#   ./examples/compose-page.sh

set -euo pipefail

SPARKUI_URL="${SPARKUI_URL:-http://localhost:3457}"
SPARKUI_TOKEN="${SPARKUI_TOKEN:?Set SPARKUI_TOKEN to your push token}"

echo "⚡ Composing a custom page from components..."

curl -s -X POST "${SPARKUI_URL}/api/compose" \
  -H "Authorization: Bearer ${SPARKUI_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Standup",
    "sections": [
      {
        "type": "header",
        "config": {
          "title": "Daily Standup",
          "subtitle": "March 14, 2026",
          "icon": "🚀",
          "badge": "Sprint 12"
        }
      },
      {
        "type": "stats",
        "config": {
          "items": [
            { "label": "Open Tasks", "value": "7", "icon": "📋", "trend": "down" },
            { "label": "In Review", "value": "3", "icon": "👀", "trend": "up" },
            { "label": "Shipped", "value": "12", "icon": "🚀", "trend": "up" },
            { "label": "Sprint Days", "value": "4", "icon": "📅" }
          ]
        }
      },
      {
        "type": "checklist",
        "config": {
          "items": [
            { "text": "Review PR #142 — auth refactor" },
            { "text": "Fix WebSocket reconnect bug" },
            { "text": "Update API docs for compose endpoint" },
            { "text": "Deploy staging build" }
          ],
          "showProgress": true,
          "allowAdd": true
        }
      },
      {
        "type": "form",
        "config": {
          "fields": [
            { "name": "blockers", "label": "Any blockers?", "type": "textarea", "placeholder": "Describe blockers or type 'none'..." },
            { "name": "confidence", "label": "Sprint confidence", "type": "rating" }
          ],
          "submitLabel": "Submit Update"
        }
      }
    ],
    "ttl": 7200
  }' | jq .

echo ""
echo "✅ Composed page created! Open the fullUrl in your browser."
