# @rwese/pi-question

Unified question tool for the pi coding agent with single/multi-question support, optional notes, and custom input.

## Features

- **Single question**: simple options list with keyboard navigation
- **Multiple questions**: tab bar interface for sequential questioning
- **Optional notes**: add context to any answer via Tab key
- **Custom input**: "Type something" option with inline editor
- **Answer review**: summary screen before final submission
- **Validation**: unique question IDs, required options count

## Installation

```bash
# From GitHub
pi install git:github.com/rwese/pi-question

# From npm (when published)
pi install npm:@rwese/pi-question
```

After install, enable via `pi config` → User → Extensions.

## Usage

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

## Keyboard Navigation

| Key | Action |
|-----|--------|
| ↑/↓ | Navigate options |
| Enter | Select option + advance |
| ←/→ | Navigate questions (multi) |
| Tab | Add note to selected option |
| Esc | Cancel/Back |

## License

MIT