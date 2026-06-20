"use client";

import Editor from "@monaco-editor/react";
import { Save, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getFileSearchEmptyMessage } from "@/lib/fileSearch";
import { hasActiveFilter } from "@/lib/filterControls";
import { getInspectorSaveLabel, shouldDisableInspectorSave } from "@/lib/inspectorSave";
import { shouldConfirmInspectorSwitch } from "@/lib/inspectorSwitch";
import { isSaveShortcut } from "@/lib/keyboardShortcuts";
import { useAppStore } from "@/lib/store";
import { getBeforeUnloadMessage, shouldWarnBeforeUnload } from "@/lib/unsavedChanges";

export function InspectorPanel() {
  const {
    editableFiles,
    inspectorPath,
    inspectorContent,
    inspectorDirty,
    loadInspectorFile,
    updateInspectorContent,
    saveInspector
  } = useAppStore();
  const [fileFilter, setFileFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasFileFilter = hasActiveFilter(fileFilter);
  const saveDisabled = shouldDisableInspectorSave({
    isDirty: inspectorDirty,
    isSaving
  });
  const saveLabel = getInspectorSaveLabel({
    isDirty: inspectorDirty,
    isSaving
  });

  const filteredFiles = useMemo(() => {
    const query = fileFilter.trim().toLowerCase();
    if (!query) {
      return editableFiles;
    }

    return editableFiles.filter((path) => path.toLowerCase().includes(query));
  }, [editableFiles, fileFilter]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarnBeforeUnload(inspectorDirty)) {
        return;
      }

      const message = getBeforeUnloadMessage(inspectorPath);
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [inspectorDirty, inspectorPath]);

  const handleSave = useCallback(async () => {
    if (saveDisabled) {
      return;
    }

    setIsSaving(true);
    try {
      await saveInspector();
    } finally {
      setIsSaving(false);
    }
  }, [saveDisabled, saveInspector]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSaveShortcut(event)) {
        return;
      }

      event.preventDefault();
      void handleSave();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  function openFile(path: string) {
    if (
      shouldConfirmInspectorSwitch({
        currentPath: inspectorPath,
        nextPath: path,
        isDirty: inspectorDirty
      })
    ) {
      const confirmed = window.confirm(
        `当前文件「${inspectorPath}」还有未保存修改。切换到「${path}」会丢弃这些修改，确定继续？`
      );
      if (!confirmed) {
        return;
      }
    }

    void loadInspectorFile(path);
  }

  return (
    <aside className="panel flex h-full min-h-[640px] flex-col rounded-[30px] p-4 xl:min-h-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
            Inspector
          </p>
          <h2 className="break-words text-lg font-semibold tracking-[-0.04em]">
            Memory / Skills / Prompt
          </h2>
        </div>
        <button
          className="flex items-center justify-center gap-2 rounded-full bg-[rgba(15,139,141,0.12)] px-4 py-2 text-sm text-ocean disabled:cursor-not-allowed disabled:text-[var(--color-ink-soft)]"
          disabled={saveDisabled}
          onClick={() => void handleSave()}
          type="button"
        >
          <Save size={16} />
          {saveLabel}
        </button>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white/55 px-3 py-2 text-sm text-[var(--color-ink-soft)]">
        <Search size={16} />
        <input
          className="min-w-0 flex-1 bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-soft)]"
          onChange={(event) => setFileFilter(event.target.value)}
          placeholder="搜索文件路径"
          type="search"
          value={fileFilter}
        />
        {hasFileFilter && (
          <button
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-[var(--color-ink-soft)] transition hover:text-[var(--color-ink)]"
            onClick={() => setFileFilter("")}
            title="清空文件搜索"
            type="button"
          >
            <X size={14} />
          </button>
        )}
      </label>

      <div className="mb-4 flex flex-wrap gap-2">
        {filteredFiles.map((path) => (
          <button
            className={`max-w-full break-all rounded-full px-3 py-1 text-left text-xs ${
              path === inspectorPath
                ? "bg-[rgba(13,37,48,0.92)] text-white"
                : "border border-[var(--color-line)] bg-white/55 text-[var(--color-ink-soft)]"
            }`}
            key={path}
            onClick={() => openFile(path)}
            type="button"
          >
            {path}
          </button>
        ))}
        {!filteredFiles.length && (
          <div className="w-full rounded-2xl border border-dashed border-[var(--color-line)] bg-white/35 px-3 py-4 text-center text-sm text-[var(--color-ink-soft)]">
            {getFileSearchEmptyMessage(fileFilter)}
          </div>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--color-line)] bg-white/45 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
        <span className="break-all">{inspectorPath}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/70 px-2 py-1">Cmd/Ctrl + S 保存</span>
          <span
            className={`rounded-full px-2 py-1 ${
              inspectorDirty
                ? "bg-[rgba(212,106,74,0.12)] text-[var(--color-ember)]"
                : "bg-[rgba(15,139,141,0.12)] text-ocean"
            }`}
          >
            {inspectorDirty ? "未保存" : "已同步"}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[26px] border border-[var(--color-line)]">
        <Editor
          defaultLanguage="markdown"
          height="100%"
          onChange={(value) => updateInspectorContent(value ?? "")}
          options={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on"
          }}
          path={inspectorPath}
          theme="vs-light"
          value={inspectorContent}
        />
      </div>
    </aside>
  );
}
