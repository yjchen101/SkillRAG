import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldDisableSessionRenameSave,
  shouldSubmitSessionRename
} from "../src/lib/sessionRename.ts";

test("shouldSubmitSessionRename rejects empty draft titles", () => {
  assert.equal(
    shouldSubmitSessionRename({ currentTitle: "现有标题", draftTitle: "   " }),
    false
  );
});

test("shouldSubmitSessionRename rejects unchanged titles", () => {
  assert.equal(
    shouldSubmitSessionRename({ currentTitle: "现有标题", draftTitle: "  现有标题  " }),
    false
  );
});

test("shouldSubmitSessionRename accepts changed titles", () => {
  assert.equal(
    shouldSubmitSessionRename({ currentTitle: "现有标题", draftTitle: "新标题" }),
    true
  );
});

test("shouldDisableSessionRenameSave disables missing, empty, or unchanged titles", () => {
  assert.equal(
    shouldDisableSessionRenameSave({ currentTitle: null, draftTitle: "新标题" }),
    true
  );
  assert.equal(
    shouldDisableSessionRenameSave({ currentTitle: "现有标题", draftTitle: "   " }),
    true
  );
  assert.equal(
    shouldDisableSessionRenameSave({ currentTitle: "现有标题", draftTitle: "现有标题" }),
    true
  );
});

test("shouldDisableSessionRenameSave enables changed titles", () => {
  assert.equal(
    shouldDisableSessionRenameSave({ currentTitle: "现有标题", draftTitle: "新标题" }),
    false
  );
});
