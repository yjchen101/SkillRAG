export type NotificationTone = "info" | "success" | "error";

export type AppNotification = {
  id: string;
  title: string;
  message?: string;
  tone: NotificationTone;
  createdAt: number;
};

type NotificationInput = {
  title: string;
  message?: string;
  tone?: NotificationTone;
};

type NotificationRuntime = {
  now?: () => number;
  makeId?: () => string;
};

function defaultId() {
  return `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createNotification(
  input: NotificationInput,
  runtime: NotificationRuntime = {}
): AppNotification {
  return {
    id: runtime.makeId?.() ?? defaultId(),
    title: input.title,
    message: input.message,
    tone: input.tone ?? "info",
    createdAt: runtime.now?.() ?? Date.now()
  };
}

export function dismissNotification(
  notifications: AppNotification[],
  notificationId: string
) {
  return notifications.filter((notification) => notification.id !== notificationId);
}
