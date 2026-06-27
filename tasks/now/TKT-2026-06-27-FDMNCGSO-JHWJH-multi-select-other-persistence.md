---
id: TKT-2026-06-27-FDMNCGSO-JHWJH
status: now
title: Multi-select consistency — preserve Other on re-confirm + show notes in Selected footer
---

## Objective

Fix two consistency gaps in the multi-select flow with the smallest reasonable diff.

## Scope

1. **Bug 1 — Other is lost when re-confirming a multi-select question**
   The user can pick a real option, then enter an "Other" free-form value, advance, navigate back, and re-confirm — at which point the Other is silently dropped from the saved answer.
   Root cause: `selectedOptions` only tracks original indices of predefined options. The Other item is built at save time but never persisted in live state, so any subsequent `getSelectedItems()` call returns only the toggled predefined options and overwrites the saved answer.

2. **Issue 4 — Notes are invisible in the question view's `Selected: …` footer**
   The Submit tab already shows `Git (using for version control)`, but the live question view shows just `Git`. Inconsistent feedback.

## Out of scope (deferred)

- Bug 2 — Allow attaching a note to the Other option in multi-select (feature gap, larger change)
- Issue 5 — `MultiAnswer.items` order not matching visual order
- Issue 6 — `requireSelectionMode` swallows the triggering key
- Issue 7 — Cursor position lost on tab change
- Issue 8 — `wasCustom` not surfaced in markdown output

## Approach

### Bug 1

- Add `OTHER_INDEX = -1` sentinel constant.
- Add `otherLabels: Map<number, string>` closure state (keyed by question index).
- In `editor.onSubmit` for multi-select Other: add the sentinel to `selectedOptions`, store the trimmed label in `otherLabels`.
- In `getSelectedItems`: when iterating, if the index equals `OTHER_INDEX`, build the Other item from `otherLabels` + `selectedNotes`.
- In `isOptionSelected`: when the display index is the Other option, return `selectedOptions.has(OTHER_INDEX)`.
- In `toggleOption`: when the cursor is on Other, toggle the sentinel (so the user can deselect it via Space).

### Issue 4

- In `renderQuestionMode`, change the Selected footer formatting to mirror `renderSubmitTab` (label + `(note)` inline).

## Tests

- `test/multi-select-other-persistence.test.ts` (new)
  - Re-confirm preserves Other: select predefined + Other, advance, navigate back, re-confirm → Other still in saved answer
  - Re-confirm with no changes preserves Other: same as above, no toggles in between
  - Replace Other: navigate back, re-enter Other with a different label → saved answer reflects the new label
  - Deselect Other via Space: navigate back, Space on Other → Other removed from saved answer
  - Notes on Other preserved through re-confirm (Bug 2 lite — may need to add note support on Other as a precondition; if it gets too big, defer)
- `test/multi-select-notes-footer.test.ts` (new) — Selected footer includes `(note)` for items with notes

## Done when

- [ ] New tests pass
- [ ] All existing tests pass (`npm run validate`)
- [ ] No new lint / typecheck warnings
- [ ] CHANGELOG `[Unreleased]` updated
- [ ] Reviewer subagent signs off
- [ ] Merged to main with full history (no squash)
