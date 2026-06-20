"use client";

import { ArrowDown, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CompressionCard } from "@/components/chat/CompressionCard";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import {
  getScrollToLatestTitle,
  isNearScrollBottom,
  shouldAutoScrollChat
} from "@/lib/chatScroll";
import { getStarterPromptCountLabel, getStarterPrompts } from "@/lib/starterPrompts";
import { useAppStore } from "@/lib/store";
import { getTokenStatsView } from "@/lib/tokenStatsView";

export function ChatPanel() {
  const {
    messages,
    sendMessage,
    isStreaming,
    tokenStats,
    compressionEvents,
    captureMessageAsKnowledge,
    isInitializing,
    workspaceError
  } = useAppStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const starterPrompts = getStarterPrompts();
  const starterPromptCountLabel = getStarterPromptCountLabel(starterPrompts.length);
  const tokenStatsView = getTokenStatsView(tokenStats);
  const inputDisabled = isStreaming || isInitializing || Boolean(workspaceError);
  const inputDisabledReason = isInitializing
    ? "正在连接后端"
    : workspaceError
      ? "后端连接失败"
      : isStreaming
        ? "正在接收流式回复"
        : undefined;

  useEffect(() => {
    if (shouldAutoScrollChat(isAtBottom)) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [compressionEvents, isAtBottom, messages]);

  function updateScrollPosition() {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    setIsAtBottom(
      isNearScrollBottom({
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight
      })
    );
  }

  function scrollToLatest() {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  }

  return (
    <section className="flex h-full min-h-[640px] min-w-0 flex-1 flex-col gap-4 xl:min-h-0">
      <div className="panel flex flex-col gap-3 rounded-[30px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
            Conversation
          </p>
          <h2 className="break-words text-lg font-semibold tracking-[-0.04em]">
            实时对话与检索轨迹
          </h2>
        </div>
        <div className="mono text-sm text-[var(--color-ink-soft)]" title={tokenStatsView.title}>
          {tokenStatsView.label}
        </div>
      </div>

      <div className="panel relative flex min-h-0 flex-1 flex-col rounded-[32px] p-5">
        <div
          className="flex-1 space-y-4 overflow-y-auto pr-2"
          onScroll={updateScrollPosition}
          ref={scrollRef}
        >
          <CompressionCard events={compressionEvents} />

          {!messages.length && (
            <div className="rounded-[28px] border border-dashed border-[var(--color-line)] bg-white/45 p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
                Ready
              </p>
              <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                一个本地、透明、文件驱动的 Agent 工作台
              </h3>
              <p className="mt-3 max-w-2xl text-[var(--color-ink-soft)]">
                你可以直接提问，也可以在右侧编辑 Memory、Skills 和 Workspace
                文件。所有系统提示、会话和工具执行都可以追踪。
              </p>
              <div className="mt-4 inline-flex rounded-full bg-white/70 px-3 py-1 text-xs text-[var(--color-ink-soft)]">
                {starterPromptCountLabel}
              </div>
              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {starterPrompts.map((starter) => (
                  <button
                    className="rounded-2xl border border-[var(--color-line)] bg-white/55 p-4 text-left transition hover:border-[rgba(15,139,141,0.35)] hover:bg-white/75 disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={inputDisabled}
                    key={starter.id}
                    onClick={() => void sendMessage(starter.prompt)}
                    type="button"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-ocean">
                      <Sparkles size={15} />
                      {starter.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">
                      {starter.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              content={message.content}
              id={message.id}
              key={message.id}
              onCapture={captureMessageAsKnowledge}
              retrievalSteps={message.retrievalSteps}
              role={message.role}
              sessionIndex={message.sessionIndex}
              toolCalls={message.toolCalls}
            />
          ))}
          <div ref={endRef} />
        </div>
        {!isAtBottom && (
          <button
            className="absolute bottom-5 right-6 flex items-center gap-2 rounded-full bg-[rgba(13,37,48,0.92)] px-4 py-2 text-sm text-white shadow-panel"
            onClick={scrollToLatest}
            title={getScrollToLatestTitle()}
            type="button"
          >
            <ArrowDown size={16} />
            回到最新
          </button>
        )}
      </div>

      <ChatInput
        disabled={inputDisabled}
        disabledReason={inputDisabledReason}
        onSend={sendMessage}
        placeholder={
          isInitializing
            ? "正在连接后端，稍后即可发送"
            : workspaceError
              ? "后端连接失败，重试成功后再发送"
              : undefined
        }
      />
    </section>
  );
}
