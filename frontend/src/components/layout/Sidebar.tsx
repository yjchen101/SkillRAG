"use client";

import { Check, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { hasActiveFilter } from "@/lib/filterControls";
import {
  getMessagePreview,
  getRawMessageEmptyText,
  getRawMessageIndexLabel,
  getRawMessageRoleLabel,
  getRawMessageToolLabel
} from "@/lib/messagePreview";
import { formatRelativeTime } from "@/lib/relativeTime";
import {
  getSessionActionButtonTitle,
  getSessionActionState
} from "@/lib/sessionActions";
import {
  getSessionRenameSaveTitle,
  shouldDisableSessionRenameSave,
  shouldSubmitSessionRename
} from "@/lib/sessionRename";
import {
  getSessionFilterCountLabel,
  getSessionSearchClearTitle,
  getSessionSearchEmptyMessage
} from "@/lib/sessionSearch";
import { useAppStore } from "@/lib/store";

export function Sidebar() {
  const {
    sessions,
    currentSessionId,
    selectSession,
    createNewSession,
    removeSession,
    renameCurrentSession,
    messages,
    isStreaming,
    isInitializing,
    workspaceError
  } = useAppStore();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const hasSessionFilter = hasActiveFilter(sessionFilter);

  const filteredSessions = useMemo(() => {
    const query = sessionFilter.trim().toLowerCase();
    if (!query) {
      return sessions;
    }

    return sessions.filter((session) => session.title.toLowerCase().includes(query));
  }, [sessionFilter, sessions]);
  const sessionFilterCountLabel = getSessionFilterCountLabel({
    filteredCount: filteredSessions.length,
    totalCount: sessions.length,
    query: sessionFilter
  });
  const sessionActionState = getSessionActionState({
    isStreaming,
    isInitializing,
    workspaceError
  });

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
    if (sessionActionState.disabled) {
      return;
    }

    setEditingSessionId(sessionId);
    setDraftTitle(title);
  }

  function cancelRename() {
    setEditingSessionId(null);
    setDraftTitle("");
  }

  async function submitRename() {
    if (!editingSessionId || sessionActionState.disabled) {
      return;
    }

    const title = draftTitle.trim();
    if (!title) {
      cancelRename();
      return;
    }

    const current = sessions.find((session) => session.id === editingSessionId);
    if (
      current &&
      !shouldSubmitSessionRename({
        currentTitle: current.title,
        draftTitle
      })
    ) {
      cancelRename();
      return;
    }

    await selectSession(editingSessionId);
    await renameCurrentSession(title);
    cancelRename();
  }

  function confirmRemove(sessionId: string, title: string) {
    if (sessionActionState.disabled) {
      return;
    }

    const confirmed = window.confirm(`删除会话「${title}」？此操作不可撤销。`);
    if (!confirmed) {
      return;
    }

    void removeSession(sessionId);
  }

  return (
    <aside className="panel flex h-full min-h-[520px] flex-col rounded-[30px] p-4 xl:min-h-0">
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
            Sessions
          </p>
          <h2 className="text-lg font-semibold tracking-[-0.04em]">会话与原始消息</h2>
        </div>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(15,139,141,0.12)] text-ocean disabled:cursor-not-allowed disabled:text-[var(--color-ink-soft)]"
          disabled={sessionActionState.disabled}
          onClick={() => void createNewSession()}
          title={getSessionActionButtonTitle({
            actionLabel: "新建会话",
            state: sessionActionState
          })}
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
        {hasSessionFilter && (
          <button
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-[var(--color-ink-soft)] transition hover:text-[var(--color-ink)]"
            onClick={() => setSessionFilter("")}
            title={getSessionSearchClearTitle()}
            type="button"
          >
            <X size={14} />
          </button>
        )}
      </label>
      <div className="mb-3 px-1 text-xs text-[var(--color-ink-soft)]">
        {sessionFilterCountLabel}
      </div>
      {sessionActionState.reason && (
        <div className="mb-3 rounded-2xl border border-[rgba(212,106,74,0.22)] bg-[rgba(212,106,74,0.1)] px-3 py-2 text-sm text-[var(--color-ember)]">
          {sessionActionState.reason}
        </div>
      )}

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
                    className="flex items-center gap-1 rounded-full bg-ocean px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:bg-[rgba(15,139,141,0.42)]"
                    disabled={shouldDisableSessionRenameSave({
                      currentTitle: session.title,
                      draftTitle
                    })}
                    onClick={() => void submitRename()}
                    title={getSessionRenameSaveTitle({
                      currentTitle: session.title,
                      draftTitle
                    })}
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
                  className="w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={sessionActionState.disabled}
                  onClick={() => void selectSession(session.id)}
                  title={getSessionActionButtonTitle({
                    actionLabel: `打开会话：${session.title}`,
                    state: sessionActionState
                  })}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{session.title}</p>
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
                    className="flex items-center gap-2 text-[var(--color-ink-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={sessionActionState.disabled}
                    onClick={() => startRename(session.id, session.title)}
                    title={getSessionActionButtonTitle({
                      actionLabel: `重命名会话：${session.title}`,
                      state: sessionActionState
                    })}
                    type="button"
                  >
                    <Pencil size={14} />
                    重命名
                  </button>
                  <button
                    className="flex items-center gap-2 text-[var(--color-ember)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={sessionActionState.disabled}
                    onClick={() => confirmRemove(session.id, session.title)}
                    title={getSessionActionButtonTitle({
                      actionLabel: `删除会话：${session.title}`,
                      state: sessionActionState
                    })}
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
            {getSessionSearchEmptyMessage({
              query: sessionFilter,
              totalCount: sessions.length
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-[24px] border border-[var(--color-line)] bg-white/40 p-3">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
          Raw Messages
        </p>
        <div className="mt-3 space-y-3 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <div
              className="rounded-2xl border border-[var(--color-line)] bg-white/60 px-3 py-2"
              key={message.id}
            >
              <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                <span>
                  {getRawMessageIndexLabel({ index, total: messages.length })} ·{" "}
                  {getRawMessageRoleLabel(message.role)}
                </span>
                <span>{getRawMessageToolLabel(message.toolCalls.length)}</span>
              </div>
              <p className="break-words text-sm text-[var(--color-ink-soft)]">
                {getMessagePreview({
                  content: message.content,
                  role: message.role,
                  isStreaming
                })}
              </p>
            </div>
          ))}
          {!messages.length && (
            <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-white/35 px-3 py-5 text-center text-sm text-[var(--color-ink-soft)]">
              {getRawMessageEmptyText()}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
