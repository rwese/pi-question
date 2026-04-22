# TODO: Multi-Select Per-Item Notes (v2.0.0)

## Status

- [x] 1. Update `MultiAnswer` type
- [x] 2. Update schema validation
- [x] 3. Add (n) key handler
- [x] 4. Update save logic
- [x] 5. Update output rendering
- [x] 6. Update submit tab display
- [x] 7. Update/add tests
- [x] 8. Version bump to 2.0.0 + CHANGELOG + README

## Summary

All tasks completed. The implementation adds per-item notes for multi-select questions.

### Breaking Changes

`MultiAnswer` structure changed from parallel arrays to object array:

```typescript
// Before (v1.x)
interface MultiAnswer {
  values: string[];
  labels: string[];
  descriptions: string[];
  wasCustom: boolean[];
}

// After (v2.0)
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

### New Features

- Press (n) on a selected option to add a note
- Notes displayed as nested bullets in markdown output
