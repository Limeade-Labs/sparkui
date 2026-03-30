# SparkUI Publish Guide

Steps to publish a new version of SparkUI.

## Pre-publish

1. **Run all tests** — every test must pass:
   ```bash
   npm test
   ```

2. **Walk through UAT checklist** — complete every item in [docs/UAT-CHECKLIST.md](./UAT-CHECKLIST.md).

## Publish

3. **Version bump:**
   ```bash
   # Patch (bug fixes):
   npm version patch

   # Minor (new features, templates, non-breaking changes):
   npm version minor

   # Major (breaking API changes):
   npm version major
   ```

4. **Publish to npm:**
   ```bash
   npm publish
   ```

## Post-publish

5. **Verify on live:**
   ```bash
   openclaw plugins install @limeade-labs/sparkui@NEW_VERSION
   ```

6. **Smoke test** — push a page with the installed version and confirm it renders.
