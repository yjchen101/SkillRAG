"use client";

import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { useAppStore } from "@/lib/store";
import { getWorkspaceRetryLabel, getWorkspaceStatusView } from "@/lib/workspaceStatus";

export function WorkspaceStatusBanner() {
  const { isInitializing, workspaceError, retryInitialize } = useAppStore();
  const [isRetrying, setIsRetrying] = useState(false);
  const view = getWorkspaceStatusView({ isInitializing, error: workspaceError });

  if (!view) {
    return null;
  }

  const isLoading = view.kind === "loading";
  const Icon = isLoading ? Loader2 : TriangleAlert;
  const retryLabel = getWorkspaceRetryLabel(isRetrying);

  async function handleRetry() {
    if (isRetrying) {
      return;
    }

    setIsRetrying(true);
    try {
      await retryInitialize();
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <section
      className={`panel flex flex-col gap-3 rounded-[24px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        isLoading
          ? "border-[rgba(15,139,141,0.18)]"
          : "border-[rgba(212,106,74,0.32)] bg-[rgba(212,106,74,0.08)]"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          className={`mt-0.5 shrink-0 ${isLoading ? "animate-spin text-ocean" : "text-[var(--color-ember)]"}`}
          size={18}
        />
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-ink)]">{view.title}</p>
          <p className="mt-1 break-words text-sm leading-6 text-[var(--color-ink-soft)]">
            {view.message}
          </p>
        </div>
      </div>
      {!isLoading && (
        <button
          className="flex items-center justify-center gap-2 rounded-full bg-[rgba(212,106,74,0.12)] px-4 py-2 text-sm text-[var(--color-ember)] disabled:cursor-not-allowed disabled:opacity-65"
          disabled={isRetrying}
          onClick={() => void handleRetry()}
          type="button"
        >
          <RefreshCw className={isRetrying ? "animate-spin" : ""} size={16} />
          {retryLabel}
        </button>
      )}
    </section>
  );
}
