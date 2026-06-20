"use client";

import { Database, FileSearch, Plus, Sparkles, Wrench } from "lucide-react";

import { getKnowledgeIndexView } from "@/lib/knowledgeIndexView";
import { getRagModeToggleTitle } from "@/lib/ragModeView";
import {
  getCompressionActionButtonTitle,
  getSessionActionState
} from "@/lib/sessionActions";
import { useAppStore } from "@/lib/store";

export function Navbar() {
  const {
    createNewSession,
    ragMode,
    toggleRagMode,
    compressCurrentSession,
    rebuildKnowledgeIndex,
    knowledgeIndexStatus,
    sessions,
    currentSessionId,
    isStreaming,
    isInitializing,
    workspaceError
  } = useAppStore();

  const currentTitle =
    sessions.find((session) => session.id === currentSessionId)?.title ?? "新会话";
  const isIndexBuilding = Boolean(knowledgeIndexStatus?.building);
  const knowledgeIndexView = getKnowledgeIndexView(knowledgeIndexStatus);
  const ragModeTitle = getRagModeToggleTitle(ragMode);
  const sessionActionState = getSessionActionState({
    isStreaming,
    isInitializing,
    workspaceError
  });
  const compressionActionState = getSessionActionState({
    isStreaming,
    isInitializing,
    workspaceError,
    currentSessionId,
    requiresSession: true
  });
  const compressionActionTitle = getCompressionActionButtonTitle(compressionActionState);

  return (
    <header className="panel flex flex-col gap-4 rounded-[30px] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(15,139,141,0.14)] text-ocean">
          <Sparkles size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-ink-soft)]">
            skill-rag
          </p>
          <h1 className="break-words text-xl font-semibold tracking-[-0.04em]">
            {currentTitle}
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <button
          className="flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white/60 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:text-[var(--color-ink-soft)]"
          disabled={sessionActionState.disabled}
          onClick={() => void createNewSession()}
          type="button"
        >
          <Plus size={16} />
          新会话
        </button>
        <button
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
            ragMode
              ? "bg-ocean text-white"
              : "border border-[var(--color-line)] bg-white/60 text-ink"
          }`}
          onClick={() => void toggleRagMode()}
          title={ragModeTitle}
          type="button"
        >
          <Database size={16} />
          {ragMode ? "RAG 已开" : "RAG 已关"}
        </button>
        <button
          className="flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white/60 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:text-[var(--color-ink-soft)]"
          disabled={compressionActionState.disabled}
          onClick={() => void compressCurrentSession()}
          title={compressionActionTitle}
          type="button"
        >
          <Wrench size={16} />
          压缩
        </button>
        <button
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
            isIndexBuilding
              ? "cursor-not-allowed bg-[rgba(15,139,141,0.12)] text-ocean"
              : knowledgeIndexStatus?.needs_rebuild
                ? "border border-[rgba(212,106,74,0.35)] bg-[rgba(212,106,74,0.12)] text-[var(--color-ember)]"
              : "border border-[var(--color-line)] bg-white/60"
          }`}
          disabled={isIndexBuilding}
          onClick={() => void rebuildKnowledgeIndex()}
          title={knowledgeIndexView.title}
          type="button"
        >
          <FileSearch size={16} />
          {knowledgeIndexView.label}
        </button>
        <div
          className={`hidden items-center gap-2 rounded-full px-4 py-2 text-sm md:flex ${knowledgeIndexView.hintClassName}`}
        >
          <FileSearch size={16} />
          {knowledgeIndexView.hint}
        </div>
      </div>
    </header>
  );
}
