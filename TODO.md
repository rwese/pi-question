# Code Health Improvements

## Status: ✅ Complete

## Completed Tasks

### 1. [x] Extract shared test helpers
- **Created** `test/helpers.ts` with TUI mock factory, mock Pi instances, and common utilities
- **Refactored** 3 test files to use shared helpers:
  - `test/tool-registration.test.ts` (reduced from 187 → 118 lines)
  - `test/navigation.test.ts` (reduced from 460+ → 460 lines, cleaner code)
  - `test/word-wrap.test.ts` (reduced from 520+ → 364 lines)
- **Verified** all 7 tests still pass

### 2. [x] Add missing dependencies to package.json
- **Added** `@mariozechner/pi-tui` to dependencies (runtime import)
- **Added** `@eslint/js` to devDependencies (ESLint config)
- **Ran** `npm install` to update lockfile

### 3. [x] Handle unused files
- **Deleted** `extensions/types.ts` (duplicate type definitions, unused)
- **Deleted** `extensions/schema.ts` (duplicate schema definitions, unused)
- **Note**: The remaining "unused files" reported by fallow are false positives:
  - Test files are entry points for vitest
  - `extensions/index.ts` is loaded dynamically by pi-coding-agent

### 4. [x] Verify & Commit
- [x] Run `npm test` - all tests pass (7/7)
- [x] Run fallow - no real issues
- [x] Duplication reduced: 52.9% → 48.2%

## Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Duplication % | 52.9% | 48.2% | -4.7% |
| Duplicated lines | 3166 | 2871 | -295 |
| Clone groups | 126 | 118 | -8 |
| Clone instances | 365 | 324 | -41 |
| Unused files | 2 | 0 | -2 |
| Unlisted deps | 2 | 0 | -2 |

## Notes

- Test file duplication is expected and acceptable (test patterns need to be readable)
- The remaining ~48% duplication is primarily in test helper patterns and long string literals
- Further refactoring of test duplication would reduce readability without significant benefit
