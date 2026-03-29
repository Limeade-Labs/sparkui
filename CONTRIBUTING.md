# Contributing to SparkUI

Thanks for your interest in contributing! Here's how to get started.

## Prerequisites

- Node.js 18+
- npm or yarn

## Setup

```bash
git clone https://github.com/limeade-labs/sparkui.git
cd sparkui
npm install
cp .env.example .env
# Edit .env — set PUSH_TOKEN to any random string
npm start
```

Server runs at `http://localhost:3457`. Test with:

```bash
curl http://localhost:3457/
# {"status":"ok","templates":["macro-tracker","checkout",...]}
```

## Adding a Template

1. Create `templates/your-template.js`
2. Export a `render(data)` function that returns an HTML string
3. Use `require('./base').base()` for the page shell (dark theme, WS client, OG tags)
4. Register in `lib/templates.js`

Look at `templates/checkout.js` for a good example.

## Adding a Component

1. Add your function to `lib/components.js`
2. Components return HTML strings (inline styles, no external deps)
3. For interactivity, use inline `<script>` blocks
4. WebSocket events: use `window.sparkui.send({type, ...data})`
5. Export from the `compose` function's component map

## Code Style

- Standard JS (semicolons, single quotes)
- No external CSS frameworks — inline styles only
- Dark theme: background `#0a0a0a`, cards `#1a1a1a`, text `#e0e0e0`
- Mobile-first responsive design
- Zero external runtime dependencies in generated HTML

## Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Test locally (push a page, verify it renders)
5. Submit a PR with a clear description

## Questions?

Open an issue or reach out to the maintainers.
