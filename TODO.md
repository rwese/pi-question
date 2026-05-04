# SOLID Refactoring TODO

## Overview
Refactor `extensions/index.ts` (1232 LOC) into modular structure following SOLID principles.

## Status: In Progress

---

## Phase 1: Extract Core Types ✅
- [x] Extract `QuestionOption`, `Question`, `Answer` types to `extensions/types/question.ts`
- [x] Extract `QuestionnaireResult`, `QuestionnaireError` types to `extensions/types/result.ts`
- [x] Export types from `extensions/types/index.ts`

**Status**: Done (123 tests passing)

---

## Phase 2: Extract Validation ✅
- [x] Extract schema definitions to `extensions/schema.ts`
- [x] Keep validation inline (too coupled to state)
- [x] Update imports in `extensions/index.ts`

**Status**: Done (validation remains inline due to tight coupling)

---

## Phase 3: Extract UI State Machine ⚠️
- [ ] Extract QuestionnaireState class
- [ ] Move state variables from closure to class properties
- [ ] Update `extensions/index.ts` to use new state class

**Status**: Deferred (tight coupling with theme makes this complex)

---

## Phase 4: Extract Input Handlers ⚠️
- [ ] Extract input handlers
- [ ] Create handler interface
- [ ] Update `extensions/index.ts` to use handlers

**Status**: Deferred (depends on Phase 3)

---

## Phase 5: Extract Renderers ⚠️
- [ ] Extract render functions
- [ ] Create renderer interface
- [ ] Update `extensions/index.ts` to use renderers

**Status**: Deferred (depends on Phase 3)

---

## Phase 6: Extract Answer Formatters ✅
- [x] Extract markdown formatter to `extensions/formatters/markdown.ts`
- [x] Extract display formatter to `extensions/formatters/display.ts`
- [x] Eliminate duplication in `execute()` and `renderResult()`

**Status**: Done (123 tests passing, ~60 lines deduplicated)

---

## Phase 7: Extract Tool Builder ⚠️
- [ ] Extract tool registration to `extensions/tool.ts`
- [ ] Create builder function
- [ ] Update `extensions/index.ts` to be minimal entry point

**Status**: Pending

---

## Phase 8: Dependency Injection ⚠️
- [ ] Define dependency interfaces
- [ ] Create default implementations
- [ ] Wire up dependencies

**Status**: Pending

---

## Completion Criteria

- [x] All tests pass (123 tests)
- [x] No type errors
- [x] No lint errors
- [x] fallow reports 0 issues
- [ ] Main entry point (`extensions/index.ts`) < 200 LOC
