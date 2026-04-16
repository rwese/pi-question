# AGENTS.md

Question tool extension for pi coding agent.

## Commands

```bash
npm test          # Run tests
npm run validate  # typecheck + lint + test
npm run lint      # ESLint
npm run format    # Prettier
```

## Project Structure

```
extensions/index.ts  # Main extension (pi-coding-agent tool)
test/*.test.ts       # Vitest tests
docs/prds/          # PRD documentation
```

## Testing

- Tests use Vitest with mocks for `@mariozechner/pi-tui`
- Run `npm test` before committing
- Mock pattern: `vi.mock()` for TUI components before imports

## Code Style

- TypeScript strict mode
- ESLint + Prettier enforced
- Use `Record<number, string>` for option-indexed maps
- Interface naming: `QuestionOption`, `SingleAnswer`, `MultiAnswer`

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
