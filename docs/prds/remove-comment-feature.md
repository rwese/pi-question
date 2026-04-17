# PRD: Remove Notes/Comments Feature from Choices

## Problem Statement

The questionnaire tool currently supports adding notes/comments to individual options via Shift+Tab. This feature adds complexity and is rarely used. The only way to add notes should be via the "Other" option's free-form input.

## Goal

Remove the ability to add notes to individual choices/options. The "Other" option remains the only way to provide additional notes.

## Changes Required

### 1. Type Changes

**MultiAnswer interface:**
```typescript
// BEFORE
interface MultiAnswer {
  values: string[];
  labels: string[];
  wasCustom: boolean[];
  comments: Record<number, string>;  // REMOVE
}

// AFTER
interface MultiAnswer {
  values: string[];
  labels: string[];
  wasCustom: boolean[];
}
```

### 2. State Variable Removal

Remove from the questionnaire closure:
- `commentMode: boolean`
- `commentOptionIndex: number | null`

### 3. Function Removal

Remove `displayToSequentialIdx()` - only used for comments.

### 4. Function Signature Changes

**saveMultiAnswer:**
```typescript
// BEFORE
function saveMultiAnswer(
  questionIndex: number,
  values: string[],
  labels: string[],
  wasCustom: boolean[],
  comments?: Record<number, string>  // REMOVE
)

// AFTER
function saveMultiAnswer(
  questionIndex: number,
  values: string[],
  labels: string[],
  wasCustom: boolean[]
)
```

### 5. Code Block Removals

Remove in order (top to bottom):
1. `submitPendingWithMessage`: Remove `comments` variable creation
2. `editor.onSubmit`: Remove entire `if (commentMode && commentOptionIndex !== null)` block
3. `handleInput`: Remove `if (commentMode && commentOptionIndex !== null)` block
4. `handleInput`: Remove Shift+Tab handler block
5. `render`: Remove `else if (commentMode && q)` block
6. `render`: Update help text to remove Shift+Tab reference

### 6. Call Site Updates

All `saveMultiAnswer` calls must use 4 arguments instead of 5.

### 7. Test Updates

Update test mocks to remove `comments` field from `MultiAnswer`.

## Implementation Order

1. Update `MultiAnswer` interface
2. Remove state variables  
3. Remove `displayToSequentialIdx` function
4. Update `saveMultiAnswer` signature
5. Update all `saveMultiAnswer` calls
6. Remove `submitPendingWithMessage` comments variable
7. Remove commentMode block in `editor.onSubmit`
8. Remove commentMode block in `handleInput`
9. Remove Shift+Tab handler
10. Remove commentMode rendering block
11. Update condition and help text
12. Update test mocks

## Key Learnings

1. **Small edits**: Make one change at a time, verify after each
2. **Regex danger**: Python/JS regex replacement is unreliable for complex code
3. **Line-by-line approach**: Process file line by line when removing blocks
4. **Brace counting**: Track `{` and `}` counts when removing blocks
5. **Test first**: Run `npm run lint` after every change
6. **Backup**: Keep `git checkout` ready to restore

## Verification

After all changes:
```bash
npm run validate  # typecheck + lint + test
```

Expected: Zero errors, all tests pass.
