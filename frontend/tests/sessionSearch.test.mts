import assert from "node:assert/strict";
import test from "node:test";

import {
  getSessionFilterCountLabel,
  getSessionSearchClearTitle,
  getSessionSearchEmptyMessage,
  getSidebarSectionLabels
} from "../src/lib/sessionSearch.ts";

test("getSessionSearchEmptyMessage shows a generic empty state without query", () => {
  assert.equal(
    getSessionSearchEmptyMessage({ query: "", totalCount: 0 }),
    "还没有会话，点击新建开始"
  );
  assert.equal(getSessionSearchEmptyMessage({ query: "   ", totalCount: 2 }), "没有匹配的会话");
});

test("getSessionSearchEmptyMessage includes the trimmed query", () => {
  assert.equal(
    getSessionSearchEmptyMessage({ query: "  report  ", totalCount: 2 }),
    "没有匹配「report」的会话"
  );
});

test("getSessionFilterCountLabel reports filtered session totals", () => {
  assert.equal(
    getSessionFilterCountLabel({ filteredCount: 0, totalCount: 0, query: "" }),
    "暂无会话"
  );
  assert.equal(
    getSessionFilterCountLabel({ filteredCount: 2, totalCount: 8, query: "  report  " }),
    "匹配 2 / 8 个会话"
  );
  assert.equal(
    getSessionFilterCountLabel({ filteredCount: 8, totalCount: 8, query: "" }),
    "共 8 个会话"
  );
});

test("getSessionSearchClearTitle explains the clear filter action", () => {
  assert.equal(getSessionSearchClearTitle(), "清空会话搜索条件");
});

test("getSidebarSectionLabels localizes visible sidebar labels", () => {
  assert.deepEqual(getSidebarSectionLabels(), {
    sessions: "会话",
    rawMessages: "原始消息"
  });
});
