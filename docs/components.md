# Composable Components

SparkUI provides 8 composable components that you can mix and match to build custom pages without writing HTML. Use the `POST /api/compose` endpoint to assemble a page from a `sections` array.

This is the recommended approach for most use cases — faster than raw HTML, more flexible than templates.

## How It Works

Send a layout object to the compose API:

```bash
curl -X POST http://localhost:3457/api/compose \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Dashboard",
    "sections": [
      { "type": "header", "config": { ... } },
      { "type": "stats", "config": { ... } },
      { "type": "progress", "config": { ... } }
    ],
    "ttl": 3600
  }'
```

Each section has a `type` (component name) and a `config` object with component-specific props.

---

## 1. header

Page header with title, subtitle, optional icon, and optional badge.

### Config

```typescript
interface HeaderConfig {
  title: string;         // Main heading text
  subtitle?: string;     // Secondary text below the title
  icon?: string;         // Emoji or icon character
  badge?: string;        // Small highlighted label (e.g. "New", "Beta")
}
```

### Example

```json
{
  "type": "header",
  "config": {
    "title": "Daily Dashboard",
    "subtitle": "March 14, 2026",
    "icon": "📊",
    "badge": "Live"
  }
}
```

---

## 2. button

Action button that emits an event when clicked. Supports primary, secondary, and danger styles.

### Config

```typescript
interface ButtonConfig {
  label: string;          // Button text
  action: string;         // Event action name sent via WebSocket
  style?: "primary" | "secondary" | "danger";  // Default: "primary"
  icon?: string;          // Emoji prepended to label
  disabled?: boolean;     // Greyed out, non-clickable
}
```

### Example

```json
{
  "type": "button",
  "config": {
    "label": "Approve Request",
    "action": "approve",
    "style": "primary",
    "icon": "✅"
  }
}
```

**Event emitted:** `{ type: "event", data: { action: "approve" } }`

---

## 3. timer

Countdown timer, stopwatch, or interval timer with start/pause/reset controls.

### Config

```typescript
interface TimerConfig {
  mode: "countdown" | "stopwatch" | "interval";
  duration?: number;      // Seconds (for countdown mode)
  intervals?: Array<{
    label: string;        // e.g. "Work", "Rest"
    seconds: number;
  }>;
  autoStart?: boolean;    // Start immediately on page load
  onComplete?: string;    // (reserved for future use)
}
```

### Examples

**Countdown timer:**

```json
{
  "type": "timer",
  "config": {
    "mode": "countdown",
    "duration": 300,
    "autoStart": false
  }
}
```

**Interval timer (HIIT):**

```json
{
  "type": "timer",
  "config": {
    "mode": "interval",
    "intervals": [
      { "label": "Work", "seconds": 30 },
      { "label": "Rest", "seconds": 10 },
      { "label": "Work", "seconds": 30 },
      { "label": "Rest", "seconds": 10 }
    ]
  }
}
```

**Event emitted on completion:** `{ type: "timer", data: { action: "complete", mode: "countdown", elapsed: 300 } }`

---

## 4. checklist

Interactive checklist with tappable items, optional progress bar, and optional "add item" input.

### Config

```typescript
interface ChecklistConfig {
  items: Array<{
    text: string;
    checked?: boolean;    // Default: false
  }>;
  allowAdd?: boolean;     // Show an input to add new items
  showProgress?: boolean; // Show progress bar and percentage
}
```

### Example

```json
{
  "type": "checklist",
  "config": {
    "items": [
      { "text": "Review PR #42", "checked": false },
      { "text": "Update docs", "checked": true },
      { "text": "Deploy to staging", "checked": false }
    ],
    "showProgress": true,
    "allowAdd": true
  }
}
```

**Events emitted:**

- Toggle: `{ type: "event", data: { action: "checklist_toggle", index: 0, checked: true, text: "Review PR #42" } }`
- All complete: `{ type: "completion", data: { action: "checklist_complete", items: [...] } }`

---

## 5. progress

Single or multi-segment progress bar with animated fill.

### Config

```typescript
interface ProgressConfig {
  // Single bar mode
  value?: number;          // Current value
  max?: number;            // Maximum value (default: 100)
  label?: string;          // Label text
  color?: string;          // Bar color (default: "#00ff88")
  showPercent?: boolean;   // Show percentage (default: true)

  // Multi-segment mode
  segments?: Array<{
    label: string;
    value: number;
    max: number;
    color?: string;
  }>;
}
```

### Examples

**Single bar:**

```json
{
  "type": "progress",
  "config": {
    "value": 65,
    "max": 100,
    "label": "Project completion",
    "color": "#6c63ff"
  }
}
```

**Multi-segment (macros):**

```json
{
  "type": "progress",
  "config": {
    "segments": [
      { "label": "Protein", "value": 62, "max": 86, "color": "#ff6b6b" },
      { "label": "Fat", "value": 45, "max": 95, "color": "#ffd93d" },
      { "label": "Carbs", "value": 15, "max": 25, "color": "#6bcb77" }
    ]
  }
}
```

---

## 6. stats

Grid of stat cards (2 columns) with values, labels, optional icons, units, and trend indicators.

### Config

```typescript
interface StatsConfig {
  items: Array<{
    label: string;         // Stat label (e.g. "Weight")
    value: string | number;
    unit?: string;         // e.g. "lbs", "days", "%"
    icon?: string;         // Emoji icon
    trend?: "up" | "down" | "flat";  // Trend arrow
  }>;
}
```

### Example

```json
{
  "type": "stats",
  "config": {
    "items": [
      { "label": "Weight", "value": "222", "unit": "lbs", "icon": "⚖️", "trend": "down" },
      { "label": "Streak", "value": "5", "unit": "days", "icon": "🔥", "trend": "up" },
      { "label": "Calories", "value": "1,250", "unit": "cal", "icon": "🍽️", "trend": "flat" },
      { "label": "Steps", "value": "8,432", "icon": "👟", "trend": "up" }
    ]
  }
}
```

---

## 7. form

Form with multiple field types. Sends a `completion` event with all field data on submit.

### Config

```typescript
interface FormConfig {
  fields: Array<{
    type: "text" | "number" | "email" | "textarea" | "select" | "rating";
    name: string;          // Field name in submitted data
    label?: string;        // Display label
    placeholder?: string;
    required?: boolean;
    options?: Array<string | { value: string; label: string }>;  // For select type
  }>;
  submitLabel?: string;    // Submit button text (default: "Submit")
}
```

### Example

```json
{
  "type": "form",
  "config": {
    "fields": [
      { "type": "rating", "name": "satisfaction", "label": "How satisfied are you?" },
      { "type": "select", "name": "category", "label": "Category", "options": ["Bug", "Feature", "Question"], "required": true },
      { "type": "text", "name": "title", "label": "Title", "placeholder": "Brief summary", "required": true },
      { "type": "textarea", "name": "details", "label": "Details", "placeholder": "Tell us more..." }
    ],
    "submitLabel": "Send Feedback"
  }
}
```

**Event emitted:** `{ type: "completion", data: { formData: { satisfaction: 4, category: "Feature", title: "...", details: "..." } } }`

---

## 8. tabs

Tab switcher with multiple content panels. Content can include HTML strings (including output from other components rendered server-side).

### Config

```typescript
interface TabsConfig {
  tabs: Array<{
    label: string;         // Tab button label
    content: string;       // HTML content for the panel
  }>;
  activeIndex?: number;    // Initially active tab (default: 0)
}
```

### Example

```json
{
  "type": "tabs",
  "config": {
    "tabs": [
      { "label": "Overview", "content": "<p style='color:#e0e0e0'>Project overview content here...</p>" },
      { "label": "Details", "content": "<p style='color:#e0e0e0'>Detailed breakdown...</p>" },
      { "label": "History", "content": "<p style='color:#e0e0e0'>Change log...</p>" }
    ],
    "activeIndex": 0
  }
}
```

---

## Full Composed Page Example

Here's a complete example composing a fitness dashboard from multiple components:

```bash
curl -X POST http://localhost:3457/api/compose \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fitness Dashboard",
    "sections": [
      {
        "type": "header",
        "config": {
          "title": "Fitness Dashboard",
          "subtitle": "March 14, 2026",
          "icon": "💪",
          "badge": "Day 5"
        }
      },
      {
        "type": "stats",
        "config": {
          "items": [
            { "label": "Weight", "value": "222", "unit": "lbs", "icon": "⚖️", "trend": "down" },
            { "label": "Streak", "value": "5", "unit": "days", "icon": "🔥", "trend": "up" },
            { "label": "Calories", "value": "1,250", "unit": "cal", "icon": "🍽️" },
            { "label": "Protein", "value": "62", "unit": "g", "icon": "💪" }
          ]
        }
      },
      {
        "type": "progress",
        "config": {
          "segments": [
            { "label": "Calories", "value": 1250, "max": 1900, "color": "#00d4aa" },
            { "label": "Protein", "value": 62, "max": 86, "color": "#6c63ff" },
            { "label": "Fat", "value": 45, "max": 95, "color": "#ff6b6b" },
            { "label": "Carbs", "value": 15, "max": 25, "color": "#ffd93d" }
          ]
        }
      },
      {
        "type": "checklist",
        "config": {
          "items": [
            { "text": "Morning workout", "checked": true },
            { "text": "Take vitamins", "checked": true },
            { "text": "10k steps", "checked": false },
            { "text": "Drink 8 glasses water", "checked": false }
          ],
          "showProgress": true
        }
      },
      {
        "type": "timer",
        "config": {
          "mode": "countdown",
          "duration": 1800
        }
      }
    ],
    "ttl": 7200,
    "openclaw": {
      "enabled": true,
      "channel": "slack",
      "to": "C0AKMF5E0KD",
      "eventTypes": ["completion"]
    }
  }'
```

> **Tip:** When choosing between compose and templates, prefer **compose** for custom layouts and **templates** only when you need their specialized rendering (e.g., macro-tracker's animated charts).
