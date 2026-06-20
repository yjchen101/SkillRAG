import assert from "node:assert/strict";
import test from "node:test";

import {
  getInspectorSaveLabel,
  shouldDisableInspectorSave
} from "../src/lib/inspectorSave.ts";

test("getInspectorSaveLabel prioritizes saving feedback", () => {
  assert.equal(getInspectorSaveLabel({ isDirty: true, isSaving: true }), "保存中");
  assert.equal(getInspectorSaveLabel({ isDirty: false, isSaving: true }), "保存中");
});

test("getInspectorSaveLabel distinguishes dirty and synced files", () => {
  assert.equal(getInspectorSaveLabel({ isDirty: true, isSaving: false }), "保存修改");
  assert.equal(getInspectorSaveLabel({ isDirty: false, isSaving: false }), "已同步");
});

test("shouldDisableInspectorSave disables clean or saving states", () => {
  assert.equal(shouldDisableInspectorSave({ isDirty: false, isSaving: false }), true);
  assert.equal(shouldDisableInspectorSave({ isDirty: true, isSaving: true }), true);
  assert.equal(shouldDisableInspectorSave({ isDirty: true, isSaving: false }), false);
});
