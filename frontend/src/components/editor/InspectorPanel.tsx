"use client";

import Editor from "@monaco-editor/react";
import { Save, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { useAppStore } from "@/lib/store";

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

  const filteredFiles = useMemo(() => {
    const query = fileFilter.trim().toLowerCase();
    if (!query) {
      return editableFiles;
    }

    return editableFiles.filter((path) => path.toLowerCase().includes(query));
  }, [editableFiles, fileFilter]);

  return (
    <aside className="panel flex h-full flex-col rounded-[30px] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
            Inspector
          </p>
          <h2 className="text-lg font-semibold tracking-[-0.04em]">Memory / Skills / Prompt</h2>
        </div>
        <button
          className="flex items-center gap-2 rounded-full bg-[rgba(15,139,141,0.12)] px-4 py-2 text-sm text-ocean"
          onClick={() => void saveInspector()}
          type="button"
        >
          <Save size={16} />
          {inspectorDirty ? "保存修改" : "已同步"}
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
      </label>

      <div className="mb-4 flex flex-wrap gap-2">
        {filteredFiles.map((path) => (
          <button
            className={`rounded-full px-3 py-1 text-xs ${
              path === inspectorPath
                ? "bg-[rgba(13,37,48,0.92)] text-white"
                : "border border-[var(--color-line)] bg-white/55 text-[var(--color-ink-soft)]"
            }`}
            key={path}
            onClick={() => void loadInspectorFile(path)}
            type="button"
          >
            {path}
          </button>
        ))}
        {!filteredFiles.length && (
          <div className="w-full rounded-2xl border border-dashed border-[var(--color-line)] bg-white/35 px-3 py-4 text-center text-sm text-[var(--color-ink-soft)]">
            没有匹配的文件
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[26px] border border-[var(--color-line)]">
        <Editor
          defaultLanguage="markdown"
          height="calc(100vh - 270px)"
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
