# AGENTS.md

Question tool extension for pi coding agent.

## Commands

```bash
npm test          # Run tests
npm run validate  # typecheck + lint + test
npm run lint      # ESLint
npm run format    # Prettier
npm run typecheck # TypeScript check

# Release
npm run release:patch   # patch + push + publish
npm run release:minor   # minor + push + publish
npm run release:major   # major + push + publish
```

## Project Structure

```
extensions/index.ts  # Main extension (pi-coding-agent tool)
extensions/types.ts  # Shared TypeScript interfaces
extensions/schema.ts # TypeBox validation schemas
test/*.test.ts      # Vitest tests
```

## Testing

- Tests use Vitest with mocks for `@mariozechner/pi-tui`
- Run `npm test` before committing
- Mock pattern: `vi.mock()` for TUI components before imports

## Code Style

- TypeScript strict mode
- ESLint + Prettier enforced
- Interface naming: `QuestionOption`, `SingleAnswer`, `MultiAnswer`

### Answer Interfaces

```typescript
interface SingleAnswer {
	value: string;      // Option value (e.g., "go", "(other)")
	label: string;      // Display label
	wasCustom: boolean; // True if user entered custom text
	index?: number;     // 1-based position in sorted options
	message?: string;   // Optional note added via Tab
}

interface MultiAnswer {
	values: string[];     // Array of option values
	labels: string[];     // Array of display labels
	wasCustom: boolean[]; // Per-item custom flag
}
```

### Mock Pattern

```typescript
vi.mock("@mariozechner/pi-tui", async () => {
	// inline mock implementation
	return { /* mock exports */ };
});
```

## Git Workflow

- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`
- Update CHANGELOG.md for user-facing changes
- Update README.md for API/feature changes

## Boundaries

**ALWAYS**
- Run `npm test` before committing
- Update relevant docs (README, CHANGELOG) for features
- Test interactive changes in tmux before marking complete

**NEVER**
- Commit secrets or test credentials
- Skip tests when functionality changes
