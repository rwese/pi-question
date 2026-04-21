---
name: pi-question-release
description: >
  Release workflow for @rwese/pi-question npm package. Use when publishing
  new versions, bumping versions, updating changelog, or managing npm publication.
  Triggers: "release", "publish", "npm publish", "version bump", "changelog update".
---

# pi-question Release Skill

Release management for @rwese/pi-question, a pi-coding-agent extension published to npm.

## Release Scripts

```bash
npm run release:patch   # patch + push + publish (0.x.y → 0.x.y+1)
npm run release:minor  # minor + push + publish (0.x.y → 0.x+1.0)
npm run release:major   # major + push + publish (0.x.y → x+1.0.0)
```

## Pre-Release Checklist

- [ ] Run `npm run validate` (typecheck + lint + test)
- [ ] Update CHANGELOG.md with unreleased changes
- [ ] Verify no secrets in working tree
- [ ] Get user approval for version bump type

## Version Bump Decision

| Change Type | Version | Example |
|-------------|---------|---------|
| Bug fixes, tests, docs, refactoring | `patch` | 0.4.2 → 0.4.3 |
| New features (backward compatible) | `minor` | 0.4.2 → 0.5.0 |
| Breaking changes | `major` | 0.4.2 → 1.0.0 |

## Release Process

1. **Validate**: `npm run validate`
2. **Bump version**: `npm version <patch|minor|major> -m '<type>: <message>'`
3. **Push**: `git push && git push --tags`
4. **Publish**: `npm publish --access public`
5. **Verify**: Check npm page for published version

## Changelog Format

```markdown
## [Unreleased]

### Added
- New features

### Changed
- Changes to existing functionality

### Fixed
- Bug fixes

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Security
- Security improvements
```

## Package Info

- **Name**: @rwese/pi-question
- **Registry**: https://registry.npmjs.org
- **npm page**: https://www.npmjs.com/package/@rwese/pi-question
- **Repository**: https://github.com/rwese/pi-question

## Installation (for users)

```bash
# From npm
pi install npm:@rwese/pi-question

# From GitHub
pi install git:github.com/rwese/pi-question
```
