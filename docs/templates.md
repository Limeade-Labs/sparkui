# Templates

SparkUI includes 11 built-in templates for common use cases. Each generates a complete, interactive HTML page with dark theme, responsive layout, and WebSocket connectivity.

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

## poll

Real-time poll/voting with bar chart results, single or multi-select, anonymous or named voting, and auto-close support.

### Data Schema

```typescript
interface PollData {
  question: string;                   // The poll question
  options: Array<string | { text: string; icon?: string }>;  // Choice options
  multiSelect?: boolean;              // Allow multiple selections (default: false)
  anonymous?: boolean;                // Anonymous voting (default: true)
  showResults?: boolean;              // Show live results (default: true)
  maxVotes?: number;                  // Auto-close after N votes
  closesAt?: string;                  // ISO timestamp to auto-close
  subtitle?: string;                  // Optional subtitle
}
```

### Example

```json
{
  "template": "poll",
  "data": {
    "question": "What framework do you prefer?",
    "options": ["React", "Vue", "Svelte", "Angular"],
    "multiSelect": false,
    "showResults": true
  },
  "ttl": 7200
}
```

### Features

- Single or multi-select voting
- Real-time bar chart results visualization
- Anonymous or named voting
- Auto-close after TTL, max votes, or timestamp
- WebSocket real-time vote updates from other voters
- Sends `completion` event with `{ action: 'vote', selections, voter, ... }`

---

## shopping-list

Categorized, checkable shopping list with real-time sync, dynamic item adding, and collaborative sharing.

### Data Schema

```typescript
interface ShoppingListData {
  title?: string;                     // List title (default: "Shopping List")
  items: Array<{
    category?: string;                // Category name (e.g. "Produce", "Dairy")
    name: string;                     // Item name
    quantity?: string;                // Quantity (e.g. "2 lbs", "1 bag")
    notes?: string;                   // Additional notes
    checked?: boolean;                // Pre-checked state
  }>;
  allowAdd?: boolean;                 // Allow adding items (default: true)
  collaborative?: boolean;            // Show live collaboration indicator
}
```

### Example

```json
{
  "template": "shopping-list",
  "data": {
    "title": "Weekly Groceries",
    "items": [
      { "category": "Produce", "name": "Avocados", "quantity": "3" },
      { "category": "Dairy", "name": "Greek Yogurt", "quantity": "2" },
      { "category": "Meat", "name": "Chicken Breast", "quantity": "1 lb" },
      { "category": "Pantry", "name": "Olive Oil" }
    ],
    "collaborative": true
  }
}
```

### Features

- Auto-grouped by category with icons (Produce 🥬, Dairy 🧀, Meat 🥩, etc.)
- Checkable items with strike-through animation
- Add items dynamically with category, quantity, and notes
- Progress bar showing completion percentage
- Copy share link for collaborative lists
- WebSocket real-time sync for live collaboration
- Sends `completion` event when all items are checked

---

## calendar

Day and week calendar views with color-coded events, detail modals, navigation, and today highlighting.

### Data Schema

```typescript
interface CalendarData {
  title?: string;                     // Calendar title (default: "Calendar")
  view?: 'day' | 'week';             // Initial view (default: "day")
  date?: string;                      // Focus date (YYYY-MM-DD, default: today)
  events: Array<{
    title: string;                    // Event title
    start: string;                    // ISO start time
    end?: string;                     // ISO end time
    category?: string;                // Category for color coding
    color?: string;                   // Override color (hex)
    location?: string;                // Event location
    description?: string;             // Event description
    allDay?: boolean;                 // All-day event
  }>;
  categories?: Record<string, string>; // { name: color } overrides
}
```

### Example

```json
{
  "template": "calendar",
  "data": {
    "title": "Today's Schedule",
    "view": "day",
    "events": [
      { "title": "Team Standup", "start": "2026-03-14T09:00:00", "end": "2026-03-14T09:30:00", "category": "Meeting", "location": "Zoom" },
      { "title": "Lunch", "start": "2026-03-14T12:00:00", "end": "2026-03-14T13:00:00", "category": "Personal" },
      { "title": "Code Review", "start": "2026-03-14T14:00:00", "category": "Work" }
    ]
  }
}
```

### Features

- Day view with time slots and event cards
- Week view with 7-day grid
- Color-coded categories (Work 🔵, Personal 🟢, Health 🔴, Meeting 🟣, etc.)
- Today highlight with green badge
- Event detail modal on click/tap
- Previous/Next/Today navigation
- All-day event support
- WebSocket updates for live event changes

---

## approval-flow

Request approval workflow with Approve/Reject/Request Changes buttons, optional comments, confirmation dialogs, and agent callback.

### Data Schema

```typescript
interface ApprovalFlowData {
  title: string;                      // Request title
  description?: string;               // Request description
  requester?: string;                 // Who submitted the request
  amount?: string;                    // Amount or impact (e.g. "$5,000", "High")
  status?: string;                    // pending|approved|rejected|changes_requested (default: "pending")
  details?: Array<{ label: string; value: string }>;  // Key-value detail rows
  requireComment?: boolean;           // Require comment before action (default: false)
  showRequestChanges?: boolean;       // Show "Request Changes" button (default: true)
  urgency?: string;                   // low|medium|high|critical
}
```

### Example

```json
{
  "template": "approval-flow",
  "data": {
    "title": "Q2 Marketing Budget Increase",
    "description": "Requesting additional budget for Q2 social media campaign.",
    "requester": "Sarah Chen",
    "amount": "$15,000",
    "urgency": "medium",
    "details": [
      { "label": "Department", "value": "Marketing" },
      { "label": "Timeline", "value": "Apr 1 - Jun 30" },
      { "label": "ROI Estimate", "value": "3.2x" }
    ],
    "requireComment": false
  }
}
```

### Features

- Status badge (pending/approved/rejected/changes requested)
- Requester avatar and info
- Amount/impact display
- Key-value detail rows
- Approve, Reject, and Request Changes buttons
- Optional or required comment field
- Confirmation dialog before submitting decision
- Urgency indicator (low/medium/high/critical)
- Sends `completion` event with `{ decision, comment, decidedAt }`

---

## comparison

Side-by-side product/option comparison with feature matrix, pros/cons, best-value highlights, and selection.

### Data Schema

```typescript
interface ComparisonData {
  title?: string;                     // Comparison title
  subtitle?: string;                  // Subtitle text
  items: Array<{
    name: string;                     // Item name
    image?: string;                   // Emoji or image URL
    price?: string;                   // Price display (e.g. "$29/mo")
    rating?: number;                  // 1-5 star rating
    recommended?: boolean;            // Highlight as recommended
    badge?: string;                   // Custom badge text
    pros?: string[];                  // List of pros
    cons?: string[];                  // List of cons
    features?: Record<string, string | boolean>;  // Feature values
    link?: string;                    // External link
  }>;                                 // 2-5 items
  featureLabels?: string[];           // Feature names for matrix
}
```

### Example

```json
{
  "template": "comparison",
  "data": {
    "title": "Choose a Plan",
    "items": [
      {
        "name": "Starter",
        "price": "$9/mo",
        "rating": 4,
        "features": { "API Calls": "1,000/mo", "Storage": "5 GB", "Support": "Email" },
        "pros": ["Affordable", "Easy setup"],
        "cons": ["Limited API calls"]
      },
      {
        "name": "Pro",
        "price": "$29/mo",
        "rating": 4.5,
        "recommended": true,
        "features": { "API Calls": "50,000/mo", "Storage": "100 GB", "Support": "Priority" },
        "pros": ["Great value", "Priority support"],
        "cons": ["No custom domain"]
      }
    ],
    "featureLabels": ["API Calls", "Storage", "Support"]
  }
}
```

### Features

- Card-based comparison (mobile-friendly stacking)
- Feature matrix table (toggleable on desktop)
- Star ratings with half-star support
- Recommended/best-value highlighting with green border
- Pros and cons lists per item
- Custom badges
- Selection buttons with confirmation
- Supports 2-5 items
- Boolean features shown as ✓/✗ checkmarks
- Sends `completion` event with `{ selectedItem, selectedIndex }`

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
