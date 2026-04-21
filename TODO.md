# Plan: Ensure `recommended` Never Leaks to Markdown Output

## Summary
Verify and document that the `recommended` field affects UI only (preselect, cursor, "(Recommended)" label), and never appears in markdown injection or answer data.

## Research

### Current Behavior (Verified)
| Location | `recommended` usage | Purpose |
|----------|---------------------|---------|
| `sortedQuestions` | Sorting options | Recommended first |
| `selectedOptions` | Pre-select in multi | Auto-check recommended |
| `optionIndex` init | Cursor position | Start on recommended |
| TUI render | `(Recommended)` suffix | Visual indicator |

### Output Paths (Safe)
| Output | Data Used | Contains `(Recommended)`? |
|--------|-----------|---------------------------|
| Markdown (execute) | `singleAnswer.label` | ❌ No |
| Markdown (execute) | `multiAnswer.labels[]` | ❌ No |
| renderResult | `singleAnswer.label` | ❌ No |
| renderResult | `multiAnswer.labels[]` | ❌ No |
| details | `{value, label, ...}` | ❌ No |

## Tasks

| # | Task | Acceptance Criteria | Status |
|---|------|---------------------|--------|
| 1 | Add test: `(Recommended)` absent from markdown output | Test passes with recommended option, output has no `(Recommended)` | ✅ Done |
| 2 | Add test: `details.answers` exclude recommended metadata | Answer objects have only value/label/wasCustom/index/message | ✅ Done |
| 3 | Document in AGENTS.md | Clear statement that `recommended` is UI-only | ✅ Done |
| 4 | Run validation | `npm run validate` passes | ✅ Done |

## Completed: 2026-04-21

- Added 5 tests in `test/integration.test.ts`:
  - `should NOT include '(Recommended)' in markdown output for single-select`
  - `should NOT include '(Recommended)' in markdown output for multi-select`
  - `should NOT include 'recommended' metadata in details.answers`
  - `should NOT include 'recommended' in renderResult output`
  - `should preserve correct answer even when recommended is the only selected option`

- Updated `AGENTS.md` with "Recommended Field (UI-Only)" section
