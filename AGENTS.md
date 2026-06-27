# AGENTS.md

Question tool extension for pi coding agent.

## Commands

```bash
npm test              # Run tests
npm run validate      # typecheck + lint + test
npm run lint          # ESLint
npm run format        # Prettier
npm run typecheck     # TypeScript check

# Secret Scanning
npm run scan:secrets       # Gitleaks - scan working directory
npm run scan:secrets:deep  # Trufflehog - deep filesystem scan
npm run scan:secrets:ci    # Gitleaks - CI mode (no color)

# Release
npm run release:patch   # validate + patch bump + push (tag included)
npm run release:minor   # validate + minor bump + push (tag included)
npm run release:major   # validate + major bump + push (tag included)
# Publish is done manually: npm publish  (or via the npm web UI)
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

## Recommended Field (UI-Only)

The `recommended: true` option affects **UI only**:
- Pre-selects the option (multi-select)
- Positions cursor on the option (single-select)
- Shows `(Recommended)` label in TUI display
- Sorts recommended options first

**Never appears in:**
- Markdown output (injected into agent context)
- `details.answers` objects
- `renderResult` output

Example - option with `recommended: true`:
```typescript
{ value: "go", label: "Go", recommended: true }
```

TUI shows: `● Go (Recommended)`
Markdown output: `- Go` (no "Recommended" suffix)

## Git Workflow

- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`
- Update CHANGELOG.md for user-facing changes
- Update README.md for API/feature changes

## Quality Gates

Pre-commit hooks (`.husky/pre-commit`) run automatically:
1. **Gitleaks** - Scans staged changes for secrets (requires: `brew install gitleaks`)
2. **Lockfile lint** - Validates package-lock.json integrity
3. **Lint-staged** - Format/lint/typecheck on staged files

For deep scans:
```bash
npm run scan:secrets       # Full gitleaks detect
npm run scan:secrets:deep  # Trufflehog filesystem scan (requires: ~/bin/trufflehog)
```

**Required tools** (install once):
```bash
brew install gitleaks      # Secret scanning
# Install trufflehog binary to ~/bin/trufflehog
curl -sSfL "https://github.com/trufflesecurity/trufflehog/releases/latest/download/trufflehog_3.95.2_darwin_arm64.tar.gz" | tar -xzf - -C ~/bin
```

## Boundaries

**ALWAYS**
- Run `npm test` before committing
- Update relevant docs (README, CHANGELOG) for features
- Test interactive changes in tmux before marking complete

**NEVER**
- Commit secrets or test credentials
- Skip tests when functionality changes
