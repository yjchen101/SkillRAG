"use client";

import { BookmarkPlus, Check, Copy, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { RetrievalCard } from "@/components/chat/RetrievalCard";
import { ThoughtChain } from "@/components/chat/ThoughtChain";
import type { RetrievalStep, ToolCall } from "@/lib/api";
import {
  canCopyMessage,
  copyTextToClipboard,
  getCopyMessageLabel,
  type CopyState
} from "@/lib/messageActions";

export function ChatMessage({
  id,
  role,
  content,
  sessionIndex,
  toolCalls,
  retrievalSteps,
  onCapture
}: {
  id: string;
  role: "user" | "assistant";
  content: string;
  sessionIndex?: number;
  toolCalls: ToolCall[];
  retrievalSteps: RetrievalStep[];
  onCapture: (messageId: string) => Promise<{ path: string; title: string } | null>;
}) {
  const isUser = role === "user";
  const [captureState, setCaptureState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const canCapture = !isUser && content.trim().length > 0 && typeof sessionIndex === "number";
  const canCopy = canCopyMessage(content);

  async function handleCapture() {
    if (!canCapture || captureState === "saving") {
      return;
    }

    setCaptureState("saving");
    try {
      const result = await onCapture(id);
      setCaptureState(result ? "saved" : "error");
    } catch (_error) {
      setCaptureState("error");
    }
  }

  async function handleCopy() {
    if (!canCopy || copyState === "copying") {
      return;
    }

    setCopyState("copying");
    try {
      const copied = await copyTextToClipboard(content);
      setCopyState(copied ? "copied" : "error");
      if (copied) {
        window.setTimeout(() => setCopyState("idle"), 1600);
      }
    } catch (_error) {
      setCopyState("error");
    }
  }

  const CaptureIcon =
    captureState === "saving"
      ? Loader2
      : captureState === "saved"
        ? Check
        : captureState === "error"
          ? TriangleAlert
          : BookmarkPlus;
  const captureLabel =
    captureState === "saving"
      ? "沉淀中"
      : captureState === "saved"
        ? "已沉淀"
        : captureState === "error"
          ? "沉淀失败"
          : "沉淀为知识";
  const CopyIcon =
    copyState === "copying"
      ? Loader2
      : copyState === "copied"
        ? Check
        : copyState === "error"
          ? TriangleAlert
          : Copy;
  const copyLabel = getCopyMessageLabel(copyState);

  return (
    <article
      className={`max-w-[90%] rounded-[28px] px-5 py-4 ${
        isUser
          ? "ml-auto bg-[rgba(13,37,48,0.92)] text-white"
          : "panel mr-auto text-[var(--color-ink)]"
      }`}
    >
      {(canCopy || canCapture) && (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          {canCopy && (
            <button
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                copyState === "copied"
                  ? "bg-[rgba(15,139,141,0.12)] text-ocean"
                  : copyState === "error"
                    ? "bg-[rgba(212,106,74,0.14)] text-[var(--color-ember)]"
                    : isUser
                      ? "border border-white/20 bg-white/10 text-white/80"
                      : "border border-[var(--color-line)] bg-white/70 text-[var(--color-ink-soft)]"
              }`}
              disabled={copyState === "copying"}
              onClick={() => void handleCopy()}
              title="复制这条消息"
              type="button"
            >
              <CopyIcon className={copyState === "copying" ? "animate-spin" : ""} size={14} />
              {copyLabel}
            </button>
          )}
          {canCapture && (
            <button
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                captureState === "saved"
                  ? "bg-[rgba(15,139,141,0.12)] text-ocean"
                  : captureState === "error"
                    ? "bg-[rgba(212,106,74,0.14)] text-[var(--color-ember)]"
                    : "border border-[var(--color-line)] bg-white/70 text-[var(--color-ink-soft)]"
              }`}
              disabled={captureState === "saving" || captureState === "saved"}
              onClick={() => void handleCapture()}
              title="将这条回答保存为 knowledge Markdown 文件"
              type="button"
            >
              <CaptureIcon
                className={captureState === "saving" ? "animate-spin" : ""}
                size={14}
              />
              {captureLabel}
            </button>
          )}
        </div>
      )}
      {!isUser && <RetrievalCard steps={retrievalSteps} />}
      {!isUser && <ThoughtChain toolCalls={toolCalls} />}
      <div className={isUser ? "whitespace-pre-wrap leading-7" : "markdown"}>
        {isUser ? (
          content
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content || "正在思考..."}
          </ReactMarkdown>
        )}
      </div>
    </article>
  );
}
