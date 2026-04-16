# @rwese/pi-question

Unified question tool for the pi coding agent with single/multi-question support, optional notes, per-option comments, and custom input.

## Features

- **Single-select questions**: Radio-style selection with keyboard navigation
- **Multi-select questions**: Checkbox-style selection for multiple answers
- **Recommended options**: Pre-select and highlight recommended choices
- **Per-option comments**: Add comments to individual selected options (Shift+Tab)
- **Optional notes**: Add context to the entire answer via Tab key
- **Custom input**: "Other" option with inline text editor for free-form input
- **Multi-question support**: Tab bar interface for sequential questioning
- **Answer review**: Summary screen before final submission
- **Markdown output**: Clean markdown formatting for AI consumption
- **Auto-disable**: Tool is not registered in non-interactive mode (`--print`/`-p`)

### Output Format

**Single-select:**
```markdown
### Question prompt?

- Selected option
```

**Multi-select:**
```markdown
### Question prompt?

- [x] Option A
  - User Comment: <comment>
- [x] Option B
```

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
| Space | Toggle option selection (multi) |
| Tab | Add note to answer |
| Shift+Tab | Add comment to selected option (multi) |
| Esc | Cancel/Back |

## License

MIT
