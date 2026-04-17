#!/usr/bin/env bash
set -e

echo "━━━ Quality Gate ━━━"

# Type check
echo "Type checking..."
npm run typecheck

# Lint
echo "Linting..."
npm run lint

# Test
echo "Testing..."
npm run test

# Format check
echo "Checking formatting..."
npm run format -- --check

echo "━━━━━━━━━━━━━━━━━━━"
echo "✓ All checks passed"
