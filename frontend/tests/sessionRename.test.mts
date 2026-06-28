import assert from "node:assert/strict";
import test from "node:test";

import {
  getSessionRenameCancelTitle,
  getSessionRenameSaveTitle,
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

test("getSessionRenameSaveTitle explains save availability", () => {
  assert.equal(
    getSessionRenameSaveTitle({ currentTitle: null, draftTitle: "新标题" }),
    "请选择一个会话后再重命名"
  );
  assert.equal(
    getSessionRenameSaveTitle({ currentTitle: "现有标题", draftTitle: "   " }),
    "输入新的会话标题后保存"
  );
  assert.equal(
    getSessionRenameSaveTitle({ currentTitle: "现有标题", draftTitle: "现有标题" }),
    "标题没有变化"
  );
  assert.equal(
    getSessionRenameSaveTitle({ currentTitle: "现有标题", draftTitle: "新标题" }),
    "保存新的会话标题"
  );
});

test("getSessionRenameCancelTitle explains the cancel action", () => {
  assert.equal(getSessionRenameCancelTitle(), "取消重命名并保留原标题");
});
