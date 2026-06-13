# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-04-18

### Added

- **Publishing preparation**: LICENSE file, CONTRIBUTING.md, improved CI workflow
- **README badges**: npm version, license, and CI status badges
- **npm publication**: Published to @rwese/pi-question on npm registry

## [0.4.7] - 2026-04-21

### Fixed

- **Type safety edge cases**: Gracefully handle malformed multi-select answers where labels array is missing or undefined

## [Unreleased]

## [2.5.0] - 2026-06-13

### Changed

- **Disabled extension no longer deactivates the tool**: Previously, `pi-question:disabled` and the `--pi-question-disabled` startup flag removed the `question` tool from the host's active tool list. This made the tool silently disappear from the agent's view, so any in-flight call surfaced a generic "tool not found" error. The disabled state now only flips an internal flag: the tool stays registered, and the existing `execute()` rejection path returns the `Question extension is disabled` markdown so the agent (and ultimately the user) get a proper, descriptive message. The non-interactive (`--print`/`-p`) path still skips registration, since the tool fundamentally needs a UI.

## [2.4.0] - 2026-06-11

### Changed

- **Code quality**: Added fallow suppressions for intentional complexity in TUI interaction handlers and test utilities
- **Build toolchain**: `typecheck` now uses `tsgo` (TypeScript 7 native preview) instead of `tsc` for ~10x faster type checking; `typescript` devDep replaced with pinned `@typescript/native-preview@7.0.0-dev.20260611.2`

### Added

- **Multi-line text support**: Question prompts and option descriptions now wrap across multiple lines instead of truncating with ellipsis
  - Uses `wrapTextWithAnsi` for ANSI-aware word wrapping
  - Caps wrapped content at 7 lines maximum
  - Preserves ANSI styling across wrapped lines

### Changed

- **Multi-select required selection**: Multi-select questions now require at least one option to be selected before advancing to the next question
  - Users cannot proceed without selecting at least one option
  - Shows warning message when trying to advance without selection
  - Press any key to dismiss warning and continue selecting options
  - Removed `(no choice)` fallback for empty multi-select

### Fixed

- **Multi-select option indexing bug**: Fixed `toggleOption` function to correctly convert display indices to original indices when options are sorted (e.g., recommended first). Previously, when options were sorted, selecting option B might save option C's value instead.

### Fixed

- **Disabled extension feedback**: When `pi-question:disabled` is called and the question tool is subsequently invoked, it now returns error feedback with markdown showing all questions and options. This allows the agent to present the questions to the user even when the extension is disabled.

## [2.1.1] - 2026-04-27

### Changed

- **Note screen UI**: Removed "Your answer:" label and typed text preview from note input screen for cleaner interface

## [2.0.0] - 2026-04-22

### Breaking Changes

- **MultiAnswer structure changed**: Replaced parallel arrays (`values`, `labels`, `descriptions`, `wasCustom`) with object array `items` of type `MultiAnswerItem[]`
  - Migration: Update code using `answer.values[n]`, `answer.labels[n]` to use `answer.items[n].value`, `answer.items[n].label`
- **Data structure**:
  ```typescript
  interface MultiAnswerItem {
    value: string;
    label: string;
    description?: string;
    wasCustom: boolean;
    note?: string;
  }
  interface MultiAnswer {
    items: MultiAnswerItem[];
  }
  ```

### Added

- **Per-item notes for multi-select**: Press (n) on a selected option to add a note
- **Nested note output**: Notes displayed as indented `Note: ...` under each item
- **Input modal for notes**: Uses pi-tui Editor for note entry

### Removed

- **Tab for notes**: Tab key no longer adds notes to answers. Use (n) key instead for per-item notes
- **Help text updated**: Shows (n)ote hint for multi-select options

### Changed

- **Markdown output**: Multi-select items now show notes as nested bullets
  - Before: `- [x] Go`
  - After: `- [x] Go
    Note: my reason`

- **Quality gates expanded**:
  - Mutation checking: `no-param-reassign`, `no-proto`, `no-new-object`, `prefer-const`
  - Complexity monitoring: `complexity` rule with threshold 20
  - Security plugin: `eslint-plugin-security` with `detect-object-injection` disabled (false positive for TypeScript)
  - Lockfile integrity: `lockfile-lint` pre-commit hook
  - `npm ci` enforcement in CI workflow
- **Code refactoring**: Extracted helper functions to reduce complexity
  - handleInput: 40 → 12 (6 helper functions)
  - render: 45 → under threshold 20 (7 helper functions)
- **Local quality gates**: husky + lint-staged pre-commit hooks for format/lint/typecheck
- **Integration tests**: Comprehensive test suite for full questionnaire workflow
- **Type guards**: `isSingleAnswer()` and `isMultiAnswer()` helper functions
- **Answer validation**: Warns when answer count doesn't match question count
- **Screenshots**: Added documentation screenshots showing single/multi-select with descriptions

### Fixed

- **Cursor initialization**: Fixed UI highlighting when recommended option is not first in options array. Cursor now correctly positions on the recommended option after sorting.

### Changed

- README updated with comprehensive examples and return data structure documentation
- **Answer output enhanced**: Answers now include descriptions from option definitions
  - `SingleAnswer.description` captures option description
  - `MultiAnswer.descriptions` array captures all selected option descriptions
  - Markdown output shows `**Label** - Description` when description exists
  - Backward compatible: missing descriptions default to empty string

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
- Custom input ("Other") option with freeform input
- Editor integration for freeform text entry
- Quality gates (ESLint, Prettier, TypeScript strict)
- CI workflow with GitHub Actions
- Comprehensive documentation

[0.1.0]: https://github.com/rwese/pi-question/releases/tag/v0.1.0
[0.1.1]: https://github.com/rwese/pi-question/releases/tag/v0.1.1
[0.2.0]: https://github.com/rwese/pi-question/releases/tag/v0.2.0
