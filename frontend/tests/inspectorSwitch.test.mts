import assert from "node:assert/strict";
import test from "node:test";

import {
  getInspectorSwitchConfirmMessage,
  shouldConfirmInspectorSwitch
} from "../src/lib/inspectorSwitch.ts";

test("shouldConfirmInspectorSwitch skips confirmation for the current file", () => {
  assert.equal(
    shouldConfirmInspectorSwitch({
      currentPath: "memory/MEMORY.md",
      nextPath: "memory/MEMORY.md",
      isDirty: true
    }),
    false
  );
});

test("shouldConfirmInspectorSwitch skips confirmation when the editor is clean", () => {
  assert.equal(
    shouldConfirmInspectorSwitch({
      currentPath: "memory/MEMORY.md",
      nextPath: "workspace/USER.md",
      isDirty: false
    }),
    false
  );
});

test("shouldConfirmInspectorSwitch requires confirmation before discarding dirty edits", () => {
  assert.equal(
    shouldConfirmInspectorSwitch({
      currentPath: "memory/MEMORY.md",
      nextPath: "workspace/USER.md",
      isDirty: true
    }),
    true
  );
});

test("getInspectorSwitchConfirmMessage explains unsaved edits will be discarded", () => {
  assert.equal(
    getInspectorSwitchConfirmMessage({
      currentPath: "memory/MEMORY.md",
      nextPath: "workspace/USER.md"
    }),
    "当前文件「memory/MEMORY.md」还有未保存修改。切换到「workspace/USER.md」会丢弃这些修改，确定继续？"
  );
  assert.equal(
    getInspectorSwitchConfirmMessage({ currentPath: "", nextPath: "" }),
    "当前文件还有未保存修改。切换文件会丢弃这些修改，确定继续？"
  );
});
