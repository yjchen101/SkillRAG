import assert from "node:assert/strict";
import test from "node:test";

import { isSaveShortcut } from "../src/lib/keyboardShortcuts.ts";

test("isSaveShortcut accepts Cmd+S", () => {
  assert.equal(isSaveShortcut({ key: "s", metaKey: true, ctrlKey: false }), true);
});

test("isSaveShortcut accepts Ctrl+S", () => {
  assert.equal(isSaveShortcut({ key: "S", metaKey: false, ctrlKey: true }), true);
});

test("isSaveShortcut rejects plain S", () => {
  assert.equal(isSaveShortcut({ key: "s", metaKey: false, ctrlKey: false }), false);
});

test("isSaveShortcut rejects other modified keys", () => {
  assert.equal(isSaveShortcut({ key: "Enter", metaKey: true, ctrlKey: false }), false);
});
