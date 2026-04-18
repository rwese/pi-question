# Slim Down pi-question Tool Surface

## Goal
Reduce token burden by ~7,000 tokens (33% reduction)

## Tasks

- [x] 1. Remove `question:test` command (~400 lines)
- [x] 2. Trim tool description to minimal (~40 tokens)
- [x] 3. Strip schema parameter descriptions
- [x] 4. Remove DEBUG mode
- [x] 5. Run tests to verify
- [x] 6. Validate with `npm run validate`

## Results

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Lines | 1561 | 1095 | 466 lines (30%) |
| Test command | yes | no | ~400 lines |
| DEBUG mode | yes | no | ~30 lines |
| Schema descriptions | 7 | 0 | ~15 lines |

### Verification
- [x] TypeScript compiles
- [x] All 91 tests pass
- [x] ESLint passes
