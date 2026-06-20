import assert from "node:assert/strict";
import test from "node:test";

import {
  getFileFilterCountLabel,
  getFilePathChipTitle,
  getInspectorCurrentPathTitle,
  getInspectorSaveShortcutTitle,
  getFileSearchClearTitle,
  getFileSearchEmptyMessage
} from "../src/lib/fileSearch.ts";

test("getFileSearchEmptyMessage shows a generic empty state without query", () => {
  assert.equal(
    getFileSearchEmptyMessage({ query: "", totalCount: 0 }),
    "暂无可编辑文件，稍后重试"
  );
  assert.equal(getFileSearchEmptyMessage({ query: "   ", totalCount: 2 }), "没有匹配的文件");
});

test("getFileSearchEmptyMessage includes the trimmed query", () => {
  assert.equal(
    getFileSearchEmptyMessage({ query: "  memory  ", totalCount: 2 }),
    "没有匹配「memory」的文件"
  );
});

test("getFileFilterCountLabel reports filtered file totals", () => {
  assert.equal(
    getFileFilterCountLabel({ filteredCount: 0, totalCount: 0, query: "" }),
    "暂无可编辑文件"
  );
  assert.equal(
    getFileFilterCountLabel({ filteredCount: 3, totalCount: 10, query: "  skill  " }),
    "匹配 3 / 10 个文件"
  );
  assert.equal(
    getFileFilterCountLabel({ filteredCount: 10, totalCount: 10, query: "" }),
    "共 10 个文件"
  );
});

test("getFilePathChipTitle explains the file chip action", () => {
  assert.equal(
    getFilePathChipTitle("skills/rag-skill/SKILL.md"),
    "打开文件：skills/rag-skill/SKILL.md"
  );
});

test("getFilePathChipTitle falls back when the file path is empty", () => {
  assert.equal(getFilePathChipTitle("   "), "打开当前文件");
});

test("getFileSearchClearTitle explains the clear filter action", () => {
  assert.equal(getFileSearchClearTitle(), "清空文件搜索条件");
});

test("getInspectorCurrentPathTitle explains the active file", () => {
  assert.equal(
    getInspectorCurrentPathTitle("memory/MEMORY.md"),
    "当前文件：memory/MEMORY.md"
  );
});

test("getInspectorCurrentPathTitle falls back when the active path is empty", () => {
  assert.equal(getInspectorCurrentPathTitle("   "), "当前文件未选择");
});

test("getInspectorSaveShortcutTitle explains the editor save shortcut", () => {
  assert.equal(getInspectorSaveShortcutTitle(), "按 Cmd 或 Ctrl + S 保存当前文件");
});
