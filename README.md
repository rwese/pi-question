# @rwese/pi-question

[![npm version](https://img.shields.io/npm/v/@rwese/pi-question)](https://www.npmjs.com/package/@rwese/pi-question)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI Quality Gates](https://github.com/rwese/pi-question/actions/workflows/ci.yml/badge.svg)](https://github.com/rwese/pi-question/actions)

Unified question tool for the pi coding agent with single/multi-question support, optional notes, per-option comments, and custom input.

## Features

- **Single-select questions**: Radio-style selection with keyboard navigation
- **Multi-select questions**: Checkbox-style selection for multiple answers
- **Recommended options**: Pre-select and highlight recommended choices
- **Optional notes**: Add context to the entire answer via Tab key
- **Custom input**: "Other" option with inline text editor for free-form input
- **Multi-question support**: Tab bar interface for sequential questioning
- **Answer review**: Summary screen before final submission
- **Markdown output**: Clean markdown formatting for AI consumption
- **Auto-disable**: Tool is not registered in non-interactive mode (`--print`/`-p`)

## Installation

```bash
# From npm (recommended)
pi install npm:@rwese/pi-question

# From GitHub
pi install git:github.com/rwese/pi-question
```

After install, enable via `pi config` → User → Extensions.

## Usage

### Tool Call

```typescript
await pi.callTool("question", {
  questions: [
    {
      questionTopic: "Scope",
      prompt: "What type of change is this?",
      type: "single",
      options: [
        { value: "feat", label: "Feature" },
        { value: "fix", label: "Bug fix" },
        { value: "docs", label: "Documentation" }
      ]
    },
    {
      questionTopic: "Priority",
      prompt: "How urgent is this?",
      type: "multi",
      options: [
        { value: "high", label: "High", recommended: true },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" }
      ]
    }
  ]
});
```

## What Gets Injected Into the Agent

After the user answers all questions, the tool returns **markdown output** that is injected into the agent's context:

### Single-Select Output

When a single-select question is answered, the output includes the question prompt followed by the selected option:

```markdown
### What type of change is this?

- Feature
```

### Multi-Select Output

Multi-select questions use checkbox notation (`[x]`) to show selected items:

```markdown
### How urgent is this?

- [x] High
- [x] Medium
```

### Full Questionnaire Output

When multiple questions are asked, all answers are included in order:

```markdown
### What type of change is this?

- Bug fix

### How urgent is this?

- [x] High
- [x] Medium
```

## Return Data Structure

The tool also returns structured data in `details` for programmatic access:

### QuestionnaireResult

```typescript
interface QuestionnaireResult {
  questions: Question[];
  answers: Answer[];
  cancelled: boolean;
}

type Answer = SingleAnswer | MultiAnswer;

interface SingleAnswer {
  value: string;       // The option value (e.g., "go", "(other)")
  label: string;       // Display label (e.g., "Go", "Custom text")
  wasCustom: boolean;  // True if user entered custom text via "Other"
  index?: number;      // 1-based position in sorted options
  message?: string;     // Optional note added via Tab
}

interface MultiAnswer {
  values: string[];      // Array of option values
  labels: string[];      // Array of display labels
  wasCustom: boolean[];  // Per-item custom flag
}
```

### Example Return Value

```typescript
{
  content: [
    {
      type: "text",
      text: "### What type of change is this?\n\n- Bug fix\n\n### How urgent is this?\n\n- [x] High\n- [x] Medium\n"
    }
  ],
  details: {
    questions: [
      { questionTopic: "Scope", prompt: "What type of change is this?", type: "single", options: [...] },
      { questionTopic: "Priority", prompt: "How urgent is this?", type: "multi", options: [...] }
    ],
    answers: [
      { value: "fix", label: "Bug fix", wasCustom: false, index: 2 },
      { values: ["high", "medium"], labels: ["High", "Medium"], wasCustom: [false, false] }
    ],
    cancelled: false
  }
}
```

## UI States

### Tab Bar (Multi-Question)

When multiple questions are asked, a tab bar appears at the top:

```
▸ Language      ■ Tools      □ OS       □ Workflow     ✓ Submit →
```

- `▸` / `◂`: Navigation arrows
- `□` / `■`: Unanswered / Answered status
- `✓`: Submit tab (enabled when all questions answered)

### Single-Select (Radio)

```
  1. ● Go        Fast, compiled, concurrent
  2.   ○ Rust    Safe, fast, zero-cost abstractions
  3.   ○ TypeScript    JavaScript with types    (Recommended)
  4.   ○ Python  Simple and readable
  5.   ○ Other ✎
```

### Multi-Select (Checkbox)

```
  1. > ☑ VS Code     (Recommended)
  2.   ☐ Vim/Neovim
  3.   ☐ JetBrains IDEs
  4.   ☐ Zed
  5.   ☐ Other ✎
```

### Note Entry (Tab Key)

```
 What is your preferred language?

 Selected: Go

 Add note (optional):
  Fast compilation time

 Enter/Tab save • Esc discard
```

### Submit Review

```
 Ready to submit

  Scope: Bug fix
  Priority: High, Medium

 Press Enter to submit
```

### Cancellation

If the user presses `Esc`, the questionnaire is cancelled:

```typescript
{
  content: [{ type: "text", text: "User cancelled the question" }],
  details: { questions: [...], answers: [], cancelled: true }
}
```

A `questionnaire-cancelled` message is also sent to the agent.

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate options |
| `←` / `→` | Navigate questions (multi) |
| `Enter` | Select option + advance |
| `Space` | Toggle option selection (multi) |
| `Tab` | Add note to answer |
| `Escape` | Cancel entire questionnaire |

## Schema

```typescript
// Question option
{
  value: string,           // Returned when selected
  label: string,            // Display label
  description?: string,    // Optional description below label
  recommended?: boolean    // Pre-select and highlight
}

// Question
{
  questionTopic: string,    // Tab bar label
  prompt: string,           // Question text
  type?: "single" | "multi", // Default: "single"
  options: QuestionOption[]
}

// Questionnaire
{
  questions: Question[]
}
```

## Special Values

| Value | Meaning |
|-------|---------|
| `(other)` | User selected "Other" and entered custom text |
| `(no choice)` | User explicitly selected "no choice" option |
| `(no selection)` | Multi-select with no options selected |

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Test
npm test

# Coverage
npm run coverage

# Validate (all checks)
npm run validate
```

## License

MIT
