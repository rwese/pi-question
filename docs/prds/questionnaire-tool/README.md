# PRD: Questionnaire Tool

## Project Name: pi-questionnaire

**Version:** 1.0.0  
**Date:** 2026-04-15  
**Status:** Planning  
**Target:** AI agent tool for collecting user responses via structured questionnaires

---

## 1. Executive Summary

**Problem Statement**

Current `questionnaire` tool lacks flexibility for diverse question types:
- No support for multi-select/checkboxes
- No way to pre-select or recommend options
- Ambiguous handling of "other" free-form input
- No validation schema

**Proposed Solution**

Enhanced questionnaire tool supporting:
- `type: "single"` (default) — radio-style single selection
- `type: "multi"` — checkbox-style multiple selections
- `recommended` field for pre-selection with visual highlight
- `allowOther` with clear semantics for empty/append behavior

---

## 2. Goals & Non-Goals

**Goals**

1. Support single-select and multi-select question types
2. Pre-select recommended options with visual (Recommended) label
3. Enforce single `recommended` on single-select (error if multiple)
4. Allow multiple `recommended` on multi-select (all pre-selected)
5. Implement `allowOther` for free-form input in both types
6. Handle empty `allowOther` as `(no choice)` result
7. Return multi-select answers as array of selected values only
8. Append `allowOther` free-form text to multi-select array

**Non-Goals**

1. No answer validation (format, range, custom rules)
2. No conditional questions or branching logic
3. No question reordering or randomization
4. No persistence or storage of responses

---

## 3. Technical Specification

### 3.1 Tool Schema

```typescript
interface QuestionnaireOption {
  value: string;           // Unique identifier for the option
  label: string;           // Display text shown to user
  description?: string;    // Optional secondary text below label
  recommended?: boolean;   // Pre-select and highlight (default: false)
}

interface Questionnaire {
  questions: QuestionnaireQuestion[];
}

interface QuestionnaireQuestion {
  id: string;              // Unique identifier for the question
  label?: string;          // Short label for tab bar (defaults to id)
  prompt: string;          // Full question text displayed
  type: "single" | "multi"; // Selection type
  options: QuestionnaireOption[];
  allowOther?: boolean;    // Enable free-form input (default: false)
  required?: boolean;      // Always true (for future extensibility)
}
```

### 3.2 Result Schema

```typescript
interface QuestionnaireResult {
  [questionId: string]: SingleResult | MultiResult;
}

interface SingleResult {
  value: string;           // Selected option value
  note?: string;           // Optional user annotation
}

interface MultiResult {
  values: string[];        // Array of selected option values
  note?: string;           // Optional user annotation
}

// Special values
const NO_CHOICE = "(no choice)";  // When other selected but empty
const OTHER_INPUT = "(other)";    // Indicates free-form text included
```

### 3.3 Behavior Rules

| Scenario | Behavior |
|----------|----------|
| Single-select, multiple `recommended` | Error returned to agent |
| Multi-select, multiple `recommended` | All recommended pre-selected |
| Multi-select, no `recommended` | None pre-selected |
| `allowOther` on single-select | Checkbox triggers text input |
| `allowOther` on multi-select | Checkbox triggers text input, user can also select other options |
| `allowOther` empty text | Result includes `"(no choice)"` for that question |
| `allowOther` with text | Result appends `"(other)"` with text to array/result |
| Required question, no selection | Block submission (tool enforces) |
| Optional question (future) | Empty allowed |

### 3.4 UI Presentation

**Single-Select (Radio)**
```
○ Option 1
○ Option 2
○ Option 3 (Recommended) ← highlighted
☐ Other: [____________]
```

**Multi-Select (Checkbox)**
```
☐ Option 1
☑ Option 2 (Recommended) ← highlighted
☐ Option 3
☑ Option 4 (Recommended) ← highlighted
☐ Other: [____________]
```

**Visual Indicators**
- `recommended: true` shows "(Recommended)" label
- Recommended options have distinct background color (implementation-defined)
- Required indicator shown if applicable

---

## 4. Interface Specification

### 4.1 Tool Call Example

```json
{
  "name": "questionnaire",
  "parameters": {
    "questions": [
      {
        "id": "language",
        "label": "Language",
        "prompt": "What is your favorite programming language?",
        "type": "single",
        "options": [
          { "value": "go", "label": "Go", "recommended": true },
          { "value": "rust", "label": "Rust" },
          { "value": "typescript", "label": "TypeScript" }
        ]
      },
      {
        "id": "tools",
        "label": "Tools",
        "prompt": "Which tools do you use daily?",
        "type": "multi",
        "options": [
          { "value": "git", "label": "Git" },
          { "value": "docker", "label": "Docker" },
          { "value": "tmux", "label": "tmux", "recommended": true }
        ],
        "allowOther": true
      }
    ]
  }
}
```

### 4.2 Result Example (Success)

```json
{
  "language": {
    "value": "go",
    "note": "my preferred language"
  },
  "tools": {
    "values": ["docker", "tmux", "(other)"],
    "note": "vim for the win"
  }
}
```

### 4.3 Result Example (Error)

```json
{
  "error": {
    "code": "MULTIPLE_RECOMMENDED",
    "message": "Question 'language' is single-select but has multiple recommended options",
    "questionId": "language",
    "recommendedCount": 2
  }
}
```

---

## 5. Feature Roadmap

### Phase 1: Core Implementation
- [ ] Implement `type: "single"` with radio-style selection
- [ ] Implement `type: "multi"` with checkbox-style selection
- [ ] Add `recommended` field with validation
- [ ] Add visual "(Recommended)" label and highlight
- [ ] Implement `allowOther` free-form input

### Phase 2: Multi-Select Refinements
- [ ] Return selected values as array
- [ ] Handle multiple `recommended` (pre-select all)
- [ ] Append other text to multi-select array

### Phase 3: Edge Cases
- [ ] Handle `(no choice)` for empty other
- [ ] Error handling for multiple recommended on single-select
- [ ] Optional notes/annotations per answer

---

## 6. Open Questions

1. ~~If multiple options have `recommended: true`, which is pre-selected?~~ → All on multi-select, error on single-select
2. ~~How is multiselect answer returned?~~ → Array of selected values only
3. ~~Other + multiselect?~~ → Appends to selection
4. ~~Other empty result?~~ → `(no choice)`
5. **Visual theme**: What color/style for "(Recommended)" highlight? (Agent's choice)
6. **Note field**: Should notes be per-question or per-answer? (Per-question confirmed)
7. **Required by default**: Confirmed, but should there be explicit `required: false`?

---

## 7. Success Criteria

### Functional
- [ ] Single-select questions accept exactly one option
- [ ] Multi-select questions accept zero or more options
- [ ] `recommended: true` pre-selects and highlights option
- [ ] Single-select with >1 recommended returns error result
- [ ] Multi-select with >1 recommended pre-selects all
- [ ] `allowOther` shows text input field
- [ ] Multi-select with `allowOther` allows combining options and free-form
- [ ] Empty `allowOther` yields `(no choice)` in result
- [ ] `allowOther` with text appends `"(other)"` to result
- [ ] Result matches defined schema structure

### Non-Functional
- [ ] Tool call completes within reasonable time
- [ ] Clear error messages for validation failures
- [ ] Responsive UI for various question counts

---

## 8. Repository Location

```
~/Repos/github.com/rwese/pi-questionnaire/
```

---

## Appendix A: Error Codes

| Code | Description |
|------|-------------|
| `MULTIPLE_RECOMMENDED` | Single-select has >1 recommended option |
| `INVALID_TYPE` | Unknown question type (not "single" or "multi") |
| `EMPTY_OPTIONS` | Question has no options array |
| `DUPLICATE_VALUE` | Multiple options share same value |

## Appendix B: Migration from v1

| Aspect | v1 | v2 |
|--------|----|----|
| Types | Implicit single | Explicit `single` or `multi` |
| Recommended | N/A | New field |
| AllowOther | Checkbox triggers input | Same, with clearer semantics |
| Empty other | Ambiguous | `(no choice)` |
| Result format | Flat value | Nested `{value, note}` or `{values, note}` |
