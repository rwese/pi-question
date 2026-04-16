# Quality Gates Checklist

## Pre-commit (local)

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes with no errors
- [ ] `npm run format` applied (files auto-formatted)
- [ ] No `console.log` statements (except warn/error)
- [ ] No `any` types (except `_` prefixed params)

## PR Requirements

- [ ] Branch from `main` or `develop`
- [ ] CI passes (type check, lint, format)
- [ ] Tests pass (if applicable)
- [ ] Documentation updated (if API changed)

## Release Checklist

- [ ] Version bumped (semver)
- [ ] CHANGELOG.md updated
- [ ] Git tag created
- [ ] GitHub release published
- [ ] npm published (if public)

## Code Style

| Rule | Value |
|------|-------|
| Indent | Tab (4 spaces) |
| Quotes | Single |
| Semicolons | Yes |
| Trailing commas | All |
| Line width | 100 chars |

## TypeScript Guidelines

- Strict mode enabled
- No implicit any
- No unchecked indexed access
- Explicit return types for exported functions
- Use `type` imports for type-only imports