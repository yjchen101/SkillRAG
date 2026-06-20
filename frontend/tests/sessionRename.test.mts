import assert from "node:assert/strict";
import test from "node:test";

import { shouldSubmitSessionRename } from "../src/lib/sessionRename.ts";

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
