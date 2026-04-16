# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-15

### Added

- **Optional notes**: press Tab after selecting an option to add a note
- `message` field in Answer interface for optional context
- Message prompt UI with skip (Tab) and cancel (Esc) options
- Message display in review and result output

### Changed

- **Keyboard navigation**: Tab now adds notes, ←/→ navigate questions
- Enter selects option and advances to next question
- Updated README keyboard navigation table

### Fixed

- Tab key now triggers message prompt instead of navigation conflict

## [0.1.1] - 2026-04-14

### Added

- Test coverage with Vitest (52 tests)
  - Schema validation tests
  - Error handling tests
  - Tool registration integration tests
- Coverage reporting with v8

### Changed

- Updated package.json with test scripts
- Updated README with test commands

## [0.1.0] - 2024-04-14

### Added

- Initial extension structure with TypeScript/ESM
- Questionnaire tool with single/multi-question support
- Tab navigation for multi-question flows
- Custom input ("Type something") option
- Editor integration for freeform input
- Quality gates (ESLint, Prettier, TypeScript strict)
- CI workflow with GitHub Actions
- Comprehensive documentation

[0.1.0]: https://github.com/rwese/pi-question/releases/tag/v0.1.0