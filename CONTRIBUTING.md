# Contributing to @rwese/pi-question

Thank you for your interest in contributing!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/rwese/pi-question
cd pi-question

# Install dependencies
npm install

# Run tests
npm test

# Validate (typecheck + lint + test)
npm run validate
```

## Workflow

1. **Fork** the repository and create a feature branch from `main`
2. **Implement** your changes with tests
3. **Validate** locally: `npm run validate`
4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation only
   - `chore:` maintenance
5. **Open a Pull Request** with a clear description

## Code Style

- TypeScript strict mode
- ESLint + Prettier enforced via lint-staged (runs on commit)
- Interface naming: `QuestionOption`, `SingleAnswer`, `MultiAnswer`

## Testing

```bash
# Run tests once
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run coverage
```

## Releasing

```bash
# Patch release (0.2.1 → 0.2.2)
npm run release:patch

# Minor release (0.2.1 → 0.3.0)
npm run release:minor

# Major release (0.2.1 → 1.0.0)
npm run release:major
```

This runs validation, bumps the version, commits the version bump, and pushes
both `main` and the version tag to GitHub.

Publishing to npm is done **manually** after the push:

```bash
npm publish
```

This is a deliberate split — `npm publish` is not part of the release scripts
because the npm token is not always available in every environment (CI, local
dev, etc.). When a valid token is present, `npm publish` works directly;
otherwise, publish from the npm web UI at
https://www.npmjs.com/package/@rwese/pi-question.

## Questions?

Open an issue at https://github.com/rwese/pi-question/issues
