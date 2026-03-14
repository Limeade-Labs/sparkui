# Templates

SparkUI includes 5 built-in templates for common use cases. Each generates a complete, interactive HTML page with dark theme, responsive layout, and WebSocket connectivity.

Use templates via `POST /api/push` with a `template` name and `data` object.

---

## macro-tracker

Daily nutrition and macro tracking dashboard with animated progress bars, macro cards, and a meal log.

### Data Schema

```typescript
interface MacroTrackerData {
  date: string;                    // e.g. "2026-03-14"
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  fat: { current: number; target: number };
  carbs: { current: number; target: number };
  meals?: Array<{
    name: string;                  // e.g. "Grilled chicken salad"
    calories: number;
    time: string;                  // e.g. "12:00 PM"
  }>;
}
```

### Example

```json
{
  "template": "macro-tracker",
  "data": {
    "date": "2026-03-14",
    "calories": { "current": 1250, "target": 1900 },
    "protein": { "current": 62, "target": 86 },
    "fat": { "current": 45, "target": 95 },
    "carbs": { "current": 15, "target": 25 },
    "meals": [
      { "name": "Eggs & bacon", "calories": 450, "time": "6:30 AM" },
      { "name": "Grilled chicken salad", "calories": 480, "time": "12:00 PM" },
      { "name": "Greek yogurt with almonds", "calories": 320, "time": "3:00 PM" }
    ]
  },
  "ttl": 7200
}
```

### Features

- Animated progress bars with percentage labels
- Color-coded macro cards (Calories, Protein, Fat, Carbs)
- Meal log with times and calorie counts
- Auto-refreshes every 30 seconds
- Over-target warnings

> **Screenshot:** [screenshots/macro-tracker.png](../screenshots/macro-tracker.png)

---

## checkout

Stripe-inspired checkout page with product display, quantity selector, promo code field, and payment form. **Demo only — no real payment processing.**

### Data Schema

```typescript
interface CheckoutData {
  product: {
    name: string;                  // Product name
    description: string;           // Short description
    price: number;                 // Unit price
    image?: string;                // Emoji (e.g. "⚡") or URL
    imageUrl?: string;             // Product image URL (overrides image)
  };
  shipping?: number;               // Shipping cost (default: 0)
  tax?: number;                    // Tax amount (default: 0)
  currency?: string;               // Currency code (default: "USD")
}
```

### Example

```json
{
  "template": "checkout",
  "data": {
    "product": {
      "name": "SparkUI Pro",
      "description": "Unlimited ephemeral UIs for your agent",
      "price": 29.99,
      "image": "⚡"
    },
    "shipping": 0,
    "tax": 2.40,
    "currency": "USD"
  }
}
```

### Features

- "DEMO MODE" banner (no real charges)
- Quantity selector with live price updates
- Promo code input
- Simulated payment form (card number, expiry, CVC)
- Order summary with subtotal, shipping, tax, and total
- Sends `completion` event with order data on "Pay" click

> **Screenshot:** [screenshots/checkout.png](../screenshots/checkout.png)

---

## workout-timer

Fitness-app-quality workout page with exercise rounds, rest timer, warmup/cooldown checklists, and progress tracking.

### Data Schema

```typescript
interface WorkoutTimerData {
  title: string;                   // Workout name
  subtitle?: string;               // e.g. "Day 3 — Push"
  warmup?: Array<{ text: string }>;
  exercises: Array<{
    name: string;                  // Exercise name
    reps: string;                  // e.g. "12 reps" or "30 sec"
    notes?: string;                // Form tips, etc.
  }>;
  rounds?: number;                 // Number of rounds (default: 3)
  restSeconds?: number;            // Rest between rounds (default: 60)
  cooldown?: Array<{ text: string }>;
  estimatedMinutes?: number;
  estimatedCalories?: number;
}
```

### Example

```json
{
  "template": "workout-timer",
  "data": {
    "title": "Upper Body Blast",
    "subtitle": "Day 1 — Push",
    "warmup": [
      { "text": "Arm circles — 30 sec" },
      { "text": "Band pull-aparts — 15 reps" }
    ],
    "exercises": [
      { "name": "Push-ups", "reps": "15 reps", "notes": "Full range of motion" },
      { "name": "Dumbbell press", "reps": "12 reps", "notes": "Slow negatives" },
      { "name": "Lateral raises", "reps": "12 reps" }
    ],
    "rounds": 3,
    "restSeconds": 60,
    "cooldown": [
      { "text": "Chest stretch — 30 sec each side" },
      { "text": "Shoulder stretch — 30 sec each side" }
    ],
    "estimatedMinutes": 35,
    "estimatedCalories": 280
  }
}
```

### Features

- Stats bar: rounds, exercises, estimated time and calories
- Interactive warmup/cooldown checklists
- Round tracker with exercise completion
- Built-in rest timer with start/skip controls
- Progress tracking across all rounds
- Sends `completion` event when workout finishes

> **Screenshot:** [screenshots/workout-timer.png](../screenshots/workout-timer.png)

---

## feedback-form

Simple feedback form with star rating, text input, and optional extra questions. Sends completion event with all form data.

### Data Schema

```typescript
interface FeedbackFormData {
  title?: string;                  // Form title (default: "Feedback")
  subtitle?: string;               // Subtitle text
  questions?: string[];            // Optional extra text input fields
}
```

### Example

```json
{
  "template": "feedback-form",
  "data": {
    "title": "How was your experience?",
    "subtitle": "We'd love to hear from you",
    "questions": [
      "What did you like most?",
      "What could be improved?"
    ]
  }
}
```

### Features

- 5-star rating selector
- Free-text feedback textarea
- Optional extra question fields
- Success animation on submit
- Sends `completion` event with `{ rating, feedback, ...extraFields }`

> **Screenshot:** [screenshots/feedback-form.png](../screenshots/feedback-form.png)

---

## ws-test

WebSocket connectivity test page for debugging and development. Tests all WS bridge features.

### Data Schema

```typescript
interface WsTestData {
  // No required data — this template works with defaults
}
```

### Example

```json
{
  "template": "ws-test",
  "data": {}
}
```

### Features

- Live connection status indicator
- Send click events and custom events
- Test form that sends completion events
- Real-time message log showing all WebSocket traffic
- Useful for verifying WebSocket connectivity and event forwarding

---

## Using Templates

### Push a template page

```bash
curl -X POST http://localhost:3457/api/push \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "TEMPLATE_NAME",
    "data": { ... },
    "ttl": 3600
  }'
```

### Update a template page

```bash
curl -X PATCH http://localhost:3457/api/pages/PAGE_ID \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": { ... }
  }'
```

When updating, you can just send `data` — SparkUI re-renders using the page's original template.

### List available templates

```bash
curl http://localhost:3457/ | jq .templates
```

> **Tip:** For custom layouts that don't fit a template, use the [compose API](./components.md) to build pages from individual components.
