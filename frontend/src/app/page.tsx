"use client";

import type { CSSProperties } from "react";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { InspectorPanel } from "@/components/editor/InspectorPanel";
import { Navbar } from "@/components/layout/Navbar";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
import { Sidebar } from "@/components/layout/Sidebar";
import { WorkspaceStatusBanner } from "@/components/layout/WorkspaceStatusBanner";
import { AppProvider, useAppStore } from "@/lib/store";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function Workspace() {
  const { sidebarWidth, inspectorWidth, setSidebarWidth, setInspectorWidth } = useAppStore();
  const sidebarPanelWidth = clamp(sidebarWidth, 260, 420);
  const inspectorPanelWidth = clamp(inspectorWidth, 320, 520);

  return (
    <main className="min-h-screen p-3 sm:p-4 md:p-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-4">
        <Navbar />
        <WorkspaceStatusBanner />
        <div className="flex min-h-[calc(100vh-146px)] flex-col gap-4 xl:flex-row xl:gap-0">
          <div
            className="w-full shrink-0 xl:w-[var(--panel-width)]"
            style={{ "--panel-width": `${sidebarPanelWidth}px` } as CSSProperties}
          >
            <Sidebar />
          </div>
          <ResizeHandle
            onResize={(delta) => setSidebarWidth(clamp(sidebarPanelWidth + delta, 260, 420))}
          />
          <ChatPanel />
          <ResizeHandle
            onResize={(delta) =>
              setInspectorWidth(clamp(inspectorPanelWidth - delta, 320, 520))
            }
          />
          <div
            className="w-full shrink-0 xl:w-[var(--panel-width)]"
            style={{ "--panel-width": `${inspectorPanelWidth}px` } as CSSProperties}
          >
            <InspectorPanel />
          </div>
        </div>
      </div>
      <NotificationCenter />
    </main>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <Workspace />
    </AppProvider>
  );
}
