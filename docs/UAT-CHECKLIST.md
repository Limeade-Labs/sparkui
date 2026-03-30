# SparkUI UAT Checklist

Run through this checklist before every publish. All items must pass.

---

## Template Rendering (all 11)

- [ ] `shopping-list` renders with valid data via API push
- [ ] `poll` renders with valid data via API push
- [ ] `comparison` renders with valid data via API push
- [ ] `macro-tracker` renders with valid data via API push
- [ ] `workout-timer` renders with valid data via API push
- [ ] `feedback-form` renders with valid data via API push
- [ ] `approval-flow` renders with valid data via API push
- [ ] `checkout` renders with valid data via API push
- [ ] `calendar` renders with valid data via API push
- [ ] `analytics-dashboard` renders with valid data via API push
- [ ] `ws-test` renders with valid data via API push
- [ ] Each template renders with LLM-style property names (`label`, `name`, `text`, `title` mixed)

## State Persistence (9 stateful templates)

- [ ] Data persists across page refresh
- [ ] Data persists across browser close/reopen

**Templates to verify:**
- [ ] `shopping-list` — checked items survive refresh
- [ ] `approval-flow` — decision state survives refresh
- [ ] `feedback-form` — submitted state survives refresh
- [ ] `checkout` — form data survives refresh
- [ ] `comparison` — selection state survives refresh
- [ ] `calendar` — view state survives refresh
- [ ] `macro-tracker` — meal log survives refresh
- [ ] `poll` — vote state survives refresh
- [ ] `workout-timer` — round progress, checked items, elapsed time survive refresh

## Poll Specific

- [ ] Votes aggregate across multiple voters (different browsers)
- [ ] Already-voted state is clear with message
- [ ] Results hidden until voted (when `hideResultsUntilVoted` is true)

## Feedback Form Specific

- [ ] Multiple respondents can submit from different browsers
- [ ] Already-submitted state shows previous response

## Completion Events

- [ ] Poll vote triggers event back to chat
- [ ] Feedback submission triggers event back to chat
- [ ] Approval decision triggers event back to chat

## Integration

- [ ] Pages expire correctly after TTL
- [ ] Agent tools (`sparkui_push`, `sparkui_compose`) work end-to-end
- [ ] Public URL generates correct shareable links
- [ ] WebSocket connection establishes and syncs state

## Automated Tests

- [ ] `node --test test/templates.test.js` passes
- [ ] `node --test test/fallbacks.test.js` passes
- [ ] `node --test test/state.test.js` passes
- [ ] `node --test test/integration.test.js` passes

---

**Sign-off:** ______________________  **Date:** ________
