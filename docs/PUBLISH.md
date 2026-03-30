# SparkUI Publish Checklist

Every release must follow this checklist. No exceptions, no one-shotting.

## Pre-Publish

1. **Work in the source repo** — `/home/clawd/projects/sparkui/`
   - NEVER edit files directly in `~/.openclaw/extensions/sparkui/` — that's the installed copy
   - All changes go in the source repo first

2. **Run tests**
   ```bash
   cd /home/clawd/projects/sparkui
   npm test
   ```

3. **Update version in ALL locations:**
   - `package.json` — use `npm version <major|minor|patch> --no-git-tag-version`
   - `package-lock.json` — updated automatically by `npm version`
   - `openclaw.plugin.json` — update `version` field manually
   - `server.js` — reads from `package.json` automatically (DO NOT hardcode)
   - Verify: `grep -rn "1\\.OLD\\.VERSION" . --include='*.js' --include='*.json' --exclude-dir=node_modules`

4. **Update CHANGELOG.md**
   - Add entry under `## [x.y.z] — YYYY-MM-DD`
   - Include all changes under Fixed / Added / Changed / Documentation sections

5. **Verify everything**
   ```bash
   # All versions should match
   node -e "const p=require('./package.json'); const o=require('./openclaw.plugin.json'); console.log('package.json:', p.version, '| plugin:', o.version); if(p.version!==o.version) { console.error('VERSION MISMATCH'); process.exit(1); }"
   
   # No stale version strings
   grep -rn "OLD_VERSION" . --include='*.js' --include='*.json' --exclude-dir=node_modules
   ```

## Publish

6. **Commit**
   ```bash
   git add -A
   git commit -m "v1.x.y: brief description of changes"
   ```

7. **Tag**
   ```bash
   git tag v1.x.y -m "v1.x.y: brief description"
   ```

8. **Push**
   ```bash
   git push && git push --tags
   ```

9. **Create GitHub release**
   ```bash
   gh release create v1.x.y --title "v1.x.y — Title" --notes "$(sed -n '/## \[1\.x\.y\]/,/## \[/p' CHANGELOG.md | head -n -1)"
   ```

10. **Publish to npm**
    ```bash
    npm publish --access public
    ```

11. **Verify npm**
    ```bash
    npm view @limeade-labs/sparkui version  # should show new version
    ```

## Post-Publish

12. **Install the new version locally**
    ```bash
    rm -rf ~/.openclaw/extensions/sparkui
    openclaw plugins install @limeade-labs/sparkui@1.x.y
    ```

13. **Restart gateway**
    ```bash
    openclaw gateway restart
    ```

14. **Verify running version**
    ```bash
    curl -s http://localhost:3457/ | jq '.version'
    ```

15. **Update LaunchPad** — comment on relevant tasks with the version shipped

## Rules

- **Source repo is the source of truth** — never publish from the extensions directory
- **One commit, one publish** — don't drip changes across multiple commits then publish
- **No hardcoded versions** — if you find one, make it read from package.json
- **Always check CHANGELOG** before publishing — if there's no entry, you're not ready
