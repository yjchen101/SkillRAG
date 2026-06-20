import assert from "node:assert/strict";
import test from "node:test";

import {
  getFileFilterCountLabel,
  getFilePathChipTitle,
  getInspectorCurrentPathTitle,
  getFileSearchEmptyMessage
} from "../src/lib/fileSearch.ts";

test("getFileSearchEmptyMessage shows a generic empty state without query", () => {
  assert.equal(getFileSearchEmptyMessage({ query: "", totalCount: 0 }), "暂无可编辑文件");
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

test("getInspectorCurrentPathTitle explains the active file", () => {
  assert.equal(
    getInspectorCurrentPathTitle("memory/MEMORY.md"),
    "当前文件：memory/MEMORY.md"
  );
});
