set shell := ["bash", "-uc"]
set dotenv-load
set export
set positional-arguments

# Current version from package.json
version := `cat package.json | rg '"version"' | tr -d '," ' | cut -d: -f2`

# =============================================================================
# Development
# =============================================================================

# Run tests
# Usage: just test
test:
  npm test

# Type check
# Usage: just typecheck
typecheck:
  npm run typecheck

# Lint code
# Usage: just lint
lint:
  npm run lint

# Format code
# Usage: just format
format:
  npm run format

# Validate everything before release
# Usage: just validate
validate: typecheck lint test

# =============================================================================
# Version Management
# =============================================================================

# Show current version
# Usage: just version
version:
  @echo "{{version}}"

# Bump patch version (fixes)
# Usage: just bump-patch
bump-patch:
  npm run version:patch

# Bump minor version (new features)
# Usage: just bump-minor
bump-minor:
  npm run version:minor

# Bump major version (breaking changes)
# Usage: just bump-major
bump-major:
  npm run version:major

# =============================================================================
# Release
# =============================================================================

# Release patch version
# Usage: just release-patch
release-patch:
  npm run release:patch

# Release minor version
# Usage: just release-minor
release-minor:
  npm run release:minor

# Release major version
# Usage: just release-major
release-major:
  npm run release:major

# =============================================================================
# CI/CD
# =============================================================================

# Run full CI pipeline
# Usage: just ci
ci: validate

# Publish to npm
# Usage: just publish
publish:
  npm publish --access public

# =============================================================================
# Help
# =============================================================================

# Show available recipes
[default]
list:
  @just --list --list-heading $'pi-question recipes\n'
