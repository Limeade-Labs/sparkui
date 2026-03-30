# Changelog

All notable changes to SparkUI are documented here.

## [1.4.3] — 2026-03-30

### Fixed
- `server.js` now reads version from `package.json` dynamically instead of hardcoding it.
- `openclaw.plugin.json` version synced with `package.json`.
- `package-lock.json` version synced.

### Changed
- Published from source repo (`/projects/sparkui/`) — previous 1.4.2 was incorrectly published from the installed extensions directory.

### Documentation
- Added `docs/PUBLISH.md` — deploy checklist for all future releases.
- Full CHANGELOG entry for 1.4.2 (was missing).

## [1.4.2] — 2026-03-30

### Fixed
- Comparison template — radio-button selection was allowing multi-select instead of single-select.
- Approval template — empty details card rendered when no details/requester/amount provided.
- State persistence — REST-first loading with localStorage write-through cache and timestamp-based conflict resolution. Server state wins over stale local cache.
- Stale localStorage no longer overwrites newer server state on reconnect.
- Comparison select button hover state preserved correctly on chosen items.

### Added
- Delivery worker — OpenClaw hooks integration (`OPENCLAW_HOOKS_URL` + `OPENCLAW_HOOKS_TOKEN` via `.env`).
- Delivery worker — human-readable message format for completion events (not raw JSON).
- Multi-tab state sync via WebSocket `state_sync` messages.

## [1.4.1] — 2026-03-30

### Fixed
- Poll server-side vote aggregation — votes now tally correctly via `saveState`/`loadState`/`state_sync`.
- Template property fallbacks — all templates accept `name`/`title`/`label`/`text` interchangeably for display fields.
- State persistence — `shopping-list`, `approval-flow`, `feedback-form`, `checkout`, `comparison`, `calendar`, and `macro-tracker` now include `saveState`/`loadState` calls.

### Added
- Comprehensive test suite (90 unit tests + API integration tests) using `node:test` — zero dependencies.
  - Template rendering tests for all 11 templates.
  - Property fallback tests for `poll`, `shopping-list`, `comparison`, `workout-timer`, `checkout`, `calendar`, `feedback-form`, `approval-flow`, and `analytics-dashboard`.
  - State persistence tests verifying `saveState`/`loadState` in all 9 stateful templates.
  - API integration tests covering `/api/push`, `/api/pages/:id`, `/api/status`, page rendering, and auth enforcement.
- `npm test` script.

## [1.4.0] — 2026-03-29

### Added
- **Native OpenClaw agent tools** — `sparkui_push` and `sparkui_compose` registered as first-class agent tools. No more shelling out to curl.
- **Token auto-persistence** — Auto-generated push tokens are saved to OpenClaw config and survive gateway restarts.
- **Public URL auto-detection** — Plugin resolves shareable URLs from config instead of defaulting to localhost.
- **Redis graceful fallback** — Server starts cleanly in memory-only mode when Redis isn't available. No error spam.
- **SECURITY.md** — Documents install-time scanner warnings and responsible disclosure process.

### Fixed
- Push messages no longer delivered twice when Redis is active.
- Redis pub/sub no longer overwrites WebSocket message `type` field (push messages were silently failing via Redis path).
- `process.exit(1)` in server.js no longer kills the entire OpenClaw gateway when loaded as a plugin.
- Token comparison uses `crypto.timingSafeEqual` (timing-attack resistant).
- WebSocket server enforces 2MB `maxPayload` limit.
- `.env` parser trims `\r` from Windows line endings.
- REST state broadcast no longer echoes back to the sending client.
- Client-side `pendingQueue` and `offlineEventQueue` capped to prevent memory growth.
- `stateLoadedCallbacks` fires once then clears (one-shot semantics).
- `htmlCache` cleaned up when pages expire (previously leaked memory).
- Plugin `stop()` timeout properly cleared on successful shutdown.
- Removed development-only FreshBooks OAuth route from production server.

### Changed
- Default port corrected from 3456 to 3457 (now matches all documentation).
- Push token masked in logs (first 8 + last 4 characters only).
- Version bumped across package.json, openclaw.plugin.json, and server status endpoint.

### Documentation
- Fixed template count across all docs (was variously "5" or "10", now correctly "11").
- Fixed component count (was "15", now correctly "8").
- Added missing templates to README table and example outputs.
- Fixed wrong package name in getting-started.md (`sparkui` → `@limeade-labs/sparkui`).
- Fixed wrong Docker port (3456 → 3457) and env var name in README.
- Fixed slot push documentation (`id` → `selector`).
- Updated SKILL.md with agent tools documentation.
- Updated landing page with correct counts and real compose API example.
- Added permanent live demo preview links on landing page.

## [1.3.2] — 2026-03-28

### Fixed
- Removed `fetch()` call from plugin entry point that triggered OpenClaw security scanner warnings.

## [1.3.1] — 2026-03-27

### Added
- OpenClaw plugin system support (`openclaw plugins install @limeade-labs/sparkui`).
- Plugin manifest with configSchema and uiHints.
- Managed service lifecycle (auto-start/stop with gateway).

## [1.2.0] — 2026-03-20

### Added
- **Auto icon replacement** — Emoji in templates automatically replaced with inline Lucide SVG icons.
- Powered by `@limeade-labs/sparkui-icons` (208 mapped emojis, duotone rendering, <2ms overhead).
- Icons preserve original emoji as `aria-label` for accessibility.

## [1.1.0] — 2026-03-14

### Added
- **State persistence** — Redis-backed with localStorage fast cache. Survives tab closes and server restarts.
- **Guaranteed event delivery** — Redis Streams with retry worker and dead-letter queue.
- **Agent push API** — Send toasts, update DOM elements, and force page reloads from the server.
- **Event query API** — Query page event history with type and time filters.
- **OpenClaw round-trip callbacks** — Interactive templates auto-forward completion events.
- 6 new templates: poll, shopping-list, calendar, comparison, approval-flow, analytics-dashboard.
- Compose API for building custom pages from components.
- One-click deploy buttons (Render, Railway).

## [1.0.0] — 2026-03-01

### Added
- Initial release.
- Express server with WebSocket support.
- 5 built-in templates: macro-tracker, checkout, workout-timer, feedback-form, ws-test.
- Push API with bearer token authentication.
- Ephemeral pages with configurable TTL.
- Dark theme, mobile-first design.
- MCP server for Claude Desktop, Cursor, and Windsurf.
- Docker support.
