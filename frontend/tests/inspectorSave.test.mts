import assert from "node:assert/strict";
import test from "node:test";

import {
  getInspectorSaveLabel,
  getInspectorSaveTitle,
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

test("getInspectorSaveTitle explains save button state", () => {
  assert.equal(
    getInspectorSaveTitle({ path: "memory/MEMORY.md", isDirty: true, isSaving: false }),
    "保存 memory/MEMORY.md"
  );
  assert.equal(
    getInspectorSaveTitle({ path: "memory/MEMORY.md", isDirty: false, isSaving: false }),
    "memory/MEMORY.md 已同步"
  );
  assert.equal(
    getInspectorSaveTitle({ path: "memory/MEMORY.md", isDirty: true, isSaving: true }),
    "正在保存 memory/MEMORY.md"
  );
});

test("getInspectorSaveTitle falls back when the file path is empty", () => {
  assert.equal(
    getInspectorSaveTitle({ path: "   ", isDirty: false, isSaving: false }),
    "当前文件已同步"
  );
  assert.equal(
    getInspectorSaveTitle({ path: "", isDirty: true, isSaving: false }),
    "保存当前文件"
  );
  assert.equal(
    getInspectorSaveTitle({ path: "", isDirty: true, isSaving: true }),
    "正在保存当前文件"
  );
});
