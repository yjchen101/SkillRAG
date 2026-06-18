"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useEffect } from "react";

import { useAppStore } from "@/lib/store";
import type { AppNotification } from "@/lib/notifications";

const toneStyles: Record<AppNotification["tone"], string> = {
  info: "border-[rgba(15,139,141,0.25)] bg-white/90 text-ocean",
  success: "border-[rgba(15,139,141,0.25)] bg-white/90 text-ocean",
  error: "border-[rgba(212,106,74,0.35)] bg-white/95 text-[var(--color-ember)]"
};

const toneIcons = {
  info: Info,
  success: CheckCircle2,
  error: TriangleAlert
};

export function NotificationCenter() {
  const { notifications, dismissNotification } = useAppStore();

  useEffect(() => {
    if (!notifications.length) {
      return;
    }

    const timers = notifications.map((notification) =>
      window.setTimeout(() => dismissNotification(notification.id), 5200)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dismissNotification, notifications]);

  if (!notifications.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
      {notifications.map((notification) => {
        const Icon = toneIcons[notification.tone];

        return (
          <div
            className={`pointer-events-auto rounded-[22px] border px-4 py-3 shadow-panel backdrop-blur-xl ${toneStyles[notification.tone]}`}
            key={notification.id}
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 shrink-0" size={18} />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-[var(--color-ink)]">
                  {notification.title}
                </p>
                {notification.message && (
                  <p className="mt-1 break-words text-xs leading-5 text-[var(--color-ink-soft)]">
                    {notification.message}
                  </p>
                )}
              </div>
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-ink-soft)] transition hover:bg-[rgba(13,37,48,0.08)]"
                onClick={() => dismissNotification(notification.id)}
                title="关闭通知"
                type="button"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
