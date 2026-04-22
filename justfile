# Setup commands
setup: hooks
  @echo "Dev environment ready."

hooks:
  @echo "Installing git hooks..."
  npx husky install
  @echo "Done."
