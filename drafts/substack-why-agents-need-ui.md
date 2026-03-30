# Why AI Agents Need UI

*Your agent can build anything. So why is it still typing at you?*

---

Last month I watched my AI agent try to run a workout timer. It sent me 30 separate messages counting down from 30. One message per second. In a chat window.

I've also watched it ask someone to "paste your credit card number here" for a checkout flow. In plaintext. In chat history. Forever.

And my favorite: a 47-row markdown table comparing cloud providers, rendered on a phone screen. You could scroll for days.

These agents are brilliant. They can reason, plan, write code, analyze data. But we've confined their entire output to a text box. It's like hiring a world-class architect and then telling them they can only communicate through Post-it notes.

## The problem isn't intelligence. It's interface.

Think about what your agent actually needs to do:

- **Collect structured input** — star ratings, form fields, approval buttons. "Type 1-5" is not a UI.
- **Show visual data** — progress bars, charts, comparisons. Markdown tables on mobile are a crime.
- **Run interactive experiences** — timers, checkout flows, collaborative lists. Chat is not an app.
- **Get results back** — not "the user said yes," but structured JSON with timestamps, field values, and completion data.

The fundamental issue: chat is one-directional text. Real interactions need real UI.

## "But my agent can generate HTML"

True. Any LLM can write HTML. That's not the hard part.

The hard parts are:
1. **Serving it** — Where does that HTML live? How does the user access it?
2. **The round-trip** — User interacts with the page. How does the agent know what happened?
3. **State** — User closes the tab, comes back. Is their progress gone?
4. **Lifecycle** — The page was for one interaction. Who cleans it up?

Generating HTML is step one of a five-step problem. Most agent frameworks stop at step one.

## The round-trip is everything

Here's what actually matters:

```
Agent creates UI → User gets a URL → User interacts → Agent gets structured results → Agent acts
```

That loop is what turns a chatbot into an assistant. Without it, every interaction is a game of telephone:

> **Agent:** "How would you rate the experience? Type a number 1-5."
> **User:** "it was good"
> **Agent:** "I need a number between 1 and 5."
> **User:** "4 I guess"
> **Agent:** "And any additional feedback?"
> **User:** "nah"

Versus:

> **Agent:** "Here's a quick feedback form: [link]"
> *User clicks, gives 4 stars, writes "checkout was smooth but shipping options were confusing," hits Submit*
> **Agent receives:** `{ rating: 4, feedback: "checkout was smooth but shipping options were confusing", timestamp: "2026-03-29T15:30:00Z" }`

One took 5 messages and produced ambiguous text. The other took 1 message and produced structured data. The agent can actually *do something* with structured data.

## Ephemeral by design

The other insight: these UIs shouldn't persist. A feedback form doesn't need to live forever. A workout timer is useless after the workout. An approval flow is done once the decision is made.

Ephemeral pages solve problems that permanent apps create:
- **No accounts** — User clicks a link. That's it. No login, no signup, no app install.
- **No cleanup** — Pages self-destruct after a configurable time. No databases filling up, no admin dashboards to manage.
- **No maintenance** — Each page is generated fresh. No versioning, no migrations, no "works on my machine."
- **Privacy by default** — The page contains exactly the data needed for that interaction, and then it's gone.

This is why I built [SparkUI](https://sparkui.dev). It's an open-source server that lets AI agents generate interactive web pages on demand. Push a template, get a URL, share it. User interacts, results stream back via WebSocket. Page expires when it's done.

## When you can build anything, the hard part is the interaction

Product thinking for AI agents is the same as product thinking for humans: it's not about capability, it's about experience. Your agent *can* collect payment info through chat. The question is whether it *should*.

The best AI products won't be the ones with the smartest models. They'll be the ones that figure out the interface — when to use text, when to use voice, and when to give the user a real UI.

Text is great for conversation. It's terrible for interaction.

---

*SparkUI is MIT-licensed and available at [sparkui.dev](https://sparkui.dev). Try the live demos, or install it in 5 seconds: `npx @limeade-labs/sparkui`*

*If you're building with AI agents and this resonates, I'd love to hear what interaction patterns you're struggling with. Reply to this post or find me on [GitHub](https://github.com/Limeade-Labs/sparkui).*
