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
- [x] Extract validation logic to `extensions/validation.ts`
- [x] Move schema definitions to `extensions/schema.ts`
- [x] Update imports in `extensions/index.ts`

**Status**: Done (123 tests passing)

---

## Phase 3: Extract UI State Machine ⚠️
- [ ] Extract QuestionnaireState class to `extensions/ui/state.ts`
- [ ] Move state variables from closure to class properties
- [ ] Update `extensions/index.ts` to use new state class

**Status**: Pending

---

## Phase 4: Extract Input Handlers ⚠️
- [ ] Extract input handlers to `extensions/ui/handlers.ts`
- [ ] Create handler interface
- [ ] Update `extensions/index.ts` to use handlers

**Status**: Pending

---

## Phase 5: Extract Renderers ⚠️
- [ ] Extract render functions to `extensions/ui/renderers.ts`
- [ ] Create renderer interface
- [ ] Update `extensions/index.ts` to use renderers

**Status**: Pending

---

## Phase 6: Extract Answer Formatters ⚠️
- [ ] Extract markdown formatter to `extensions/formatters/markdown.ts`
- [ ] Extract display formatter to `extensions/formatters/display.ts`
- [ ] Eliminate duplication in `execute()` and `renderResult()`

**Status**: Pending

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

- [ ] All tests pass (123 tests)
- [ ] No type errors
- [ ] No lint errors
- [ ] fallow reports 0 issues
- [ ] Main entry point (`extensions/index.ts`) < 200 LOC
