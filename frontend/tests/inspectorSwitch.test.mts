import assert from "node:assert/strict";
import test from "node:test";

import { shouldConfirmInspectorSwitch } from "../src/lib/inspectorSwitch.ts";

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
