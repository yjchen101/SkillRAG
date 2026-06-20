import assert from "node:assert/strict";
import test from "node:test";

import {
  getFileFilterCountLabel,
  getFileSearchEmptyMessage
} from "../src/lib/fileSearch.ts";

test("getFileSearchEmptyMessage shows a generic empty state without query", () => {
  assert.equal(getFileSearchEmptyMessage(""), "没有匹配的文件");
  assert.equal(getFileSearchEmptyMessage("   "), "没有匹配的文件");
});

test("getFileSearchEmptyMessage includes the trimmed query", () => {
  assert.equal(getFileSearchEmptyMessage("  memory  "), "没有匹配「memory」的文件");
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
