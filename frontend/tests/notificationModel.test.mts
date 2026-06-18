import assert from "node:assert/strict";
import test from "node:test";

import { createNotification, dismissNotification } from "../src/lib/notifications.ts";

test("createNotification fills deterministic metadata", () => {
  const notification = createNotification(
    {
      title: "保存成功",
      message: "memory/MEMORY.md 已同步",
      tone: "success"
    },
    {
      now: () => 1700000000000,
      makeId: () => "notice-1"
    }
  );

  assert.deepEqual(notification, {
    id: "notice-1",
    title: "保存成功",
    message: "memory/MEMORY.md 已同步",
    tone: "success",
    createdAt: 1700000000000
  });
});

test("dismissNotification removes only the matching notification", () => {
  const notifications = [
    createNotification({ title: "A", tone: "info" }, { now: () => 1, makeId: () => "a" }),
    createNotification({ title: "B", tone: "error" }, { now: () => 2, makeId: () => "b" }),
    createNotification({ title: "C", tone: "success" }, { now: () => 3, makeId: () => "c" })
  ];

  assert.deepEqual(
    dismissNotification(notifications, "b").map((notification) => notification.id),
    ["a", "c"]
  );
});
