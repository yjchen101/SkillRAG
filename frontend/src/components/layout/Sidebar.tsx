"use client";

import { Check, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatRelativeTime } from "@/lib/relativeTime";
import { useAppStore } from "@/lib/store";

function preview(text: string) {
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

export function Sidebar() {
  const {
    sessions,
    currentSessionId,
    selectSession,
    createNewSession,
    removeSession,
    renameCurrentSession,
    messages
  } = useAppStore();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");

  const filteredSessions = useMemo(() => {
    const query = sessionFilter.trim().toLowerCase();
    if (!query) {
      return sessions;
    }

    return sessions.filter((session) => session.title.toLowerCase().includes(query));
  }, [sessionFilter, sessions]);

  useEffect(() => {
    if (!editingSessionId) {
      return;
    }

    const current = sessions.find((session) => session.id === editingSessionId);
    if (!current) {
      setEditingSessionId(null);
      setDraftTitle("");
    }
  }, [editingSessionId, sessions]);

  function startRename(sessionId: string, title: string) {
    setEditingSessionId(sessionId);
    setDraftTitle(title);
  }

  function cancelRename() {
    setEditingSessionId(null);
    setDraftTitle("");
  }

  async function submitRename() {
    if (!editingSessionId) {
      return;
    }

    const title = draftTitle.trim();
    if (!title) {
      cancelRename();
      return;
    }

    await selectSession(editingSessionId);
    await renameCurrentSession(title);
    cancelRename();
  }

  return (
    <aside className="panel flex h-full flex-col rounded-[30px] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
            Sessions
          </p>
          <h2 className="text-lg font-semibold tracking-[-0.04em]">会话与原始消息</h2>
        </div>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(15,139,141,0.12)] text-ocean"
          onClick={() => void createNewSession()}
          type="button"
        >
          <Plus size={18} />
        </button>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white/55 px-3 py-2 text-sm text-[var(--color-ink-soft)]">
        <Search size={16} />
        <input
          className="min-w-0 flex-1 bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-soft)]"
          onChange={(event) => setSessionFilter(event.target.value)}
          placeholder="搜索会话标题"
          type="search"
          value={sessionFilter}
        />
      </label>

      <div className="space-y-2 overflow-y-auto pr-1">
        {filteredSessions.map((session) => (
          <div
            className={`rounded-3xl border px-4 py-3 transition ${
              session.id === currentSessionId
                ? "border-transparent bg-[rgba(15,139,141,0.16)]"
                : "border-[var(--color-line)] bg-white/45"
            }`}
            key={session.id}
          >
            {editingSessionId === session.id ? (
              <div className="space-y-3">
                <input
                  autoFocus
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white/80 px-3 py-2 text-sm outline-none"
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitRename();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRename();
                    }
                  }}
                  value={draftTitle}
                />
                <div className="flex items-center gap-2 text-xs">
                  <button
                    className="flex items-center gap-1 rounded-full bg-ocean px-3 py-1.5 text-white"
                    onClick={() => void submitRename()}
                    type="button"
                  >
                    <Check size={14} />
                    保存
                  </button>
                  <button
                    className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-white/60 px-3 py-1.5 text-[var(--color-ink-soft)]"
                    onClick={cancelRename}
                    type="button"
                  >
                    <X size={14} />
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  className="w-full text-left"
                  onClick={() => void selectSession(session.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{session.title}</p>
                      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                        {session.message_count} 条消息
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                        活跃于 {formatRelativeTime(session.updated_at)}
                      </p>
                    </div>
                    <MessageSquare className="mt-1 text-[var(--color-ink-soft)]" size={16} />
                  </div>
                </button>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <button
                    className="flex items-center gap-2 text-[var(--color-ink-soft)]"
                    onClick={() => startRename(session.id, session.title)}
                    type="button"
                  >
                    <Pencil size={14} />
                    重命名
                  </button>
                  <button
                    className="flex items-center gap-2 text-[var(--color-ember)]"
                    onClick={() => void removeSession(session.id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {!filteredSessions.length && (
          <div className="rounded-3xl border border-dashed border-[var(--color-line)] bg-white/35 px-4 py-6 text-center text-sm text-[var(--color-ink-soft)]">
            没有匹配的会话
          </div>
        )}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-[24px] border border-[var(--color-line)] bg-white/40 p-3">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
          Raw Messages
        </p>
        <div className="mt-3 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div
              className="rounded-2xl border border-[var(--color-line)] bg-white/60 px-3 py-2"
              key={message.id}
            >
              <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                <span>{message.role}</span>
                <span>{message.toolCalls.length} tools</span>
              </div>
              <p className="text-sm text-[var(--color-ink-soft)]">{preview(message.content)}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
