import assert from "node:assert/strict";
import test from "node:test";

import {
  NOTIFICATION_AUTO_DISMISS_MS,
  clearNotifications,
  createNotification,
  dismissNotification,
  getNotificationClearAllTitle,
  getNotificationDismissDelay,
  getNotificationDismissTitle
} from "../src/lib/notifications.ts";

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

test("clearNotifications removes every visible notification", () => {
  const notifications = [
    createNotification({ title: "A", tone: "info" }, { now: () => 1, makeId: () => "a" }),
    createNotification({ title: "B", tone: "error" }, { now: () => 2, makeId: () => "b" })
  ];

  assert.deepEqual(clearNotifications(notifications), []);
});

test("getNotificationDismissDelay keeps each notification on its own timer", () => {
  const notification = createNotification(
    { title: "A", tone: "info" },
    { now: () => 1000, makeId: () => "a" }
  );

  assert.equal(getNotificationDismissDelay(notification, 1000), NOTIFICATION_AUTO_DISMISS_MS);
  assert.equal(getNotificationDismissDelay(notification, 3600), 2600);
  assert.equal(getNotificationDismissDelay(notification, 7000), 0);
});

test("notification action titles explain what will be removed", () => {
  assert.equal(getNotificationDismissTitle("保存成功"), "关闭通知：保存成功");
  assert.equal(getNotificationDismissTitle("   "), "关闭这条通知");
  assert.equal(getNotificationClearAllTitle(), "关闭全部通知并清空列表");
});
