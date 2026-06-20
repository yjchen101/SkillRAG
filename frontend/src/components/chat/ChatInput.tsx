"use client";

import { SendHorizonal } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { getChatInputCountLabel, getChatInputHeight } from "@/lib/chatInput";

export function ChatInput({
  disabled,
  placeholder,
  onSend
}: {
  disabled: boolean;
  placeholder?: string;
  onSend: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const countLabel = getChatInputCountLabel(value);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const { height, overflowY } = getChatInputHeight(textarea.scrollHeight);
    textarea.style.height = `${height}px`;
    textarea.style.overflowY = overflowY;
  }, [value]);

  function submit() {
    const nextValue = value.trim();
    if (disabled || !nextValue) {
      return;
    }

    void onSend(nextValue);
    setValue("");
  }

  return (
    <div className="panel rounded-[28px] p-3">
      <textarea
        className="min-h-28 w-full resize-none rounded-[22px] border border-[var(--color-line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[rgba(15,139,141,0.45)] disabled:cursor-not-allowed disabled:bg-white/45"
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }

          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={
          placeholder ??
          (disabled ? "正在生成回复..." : "输入你的问题，Enter 发送，Shift + Enter 换行")
        }
        ref={textareaRef}
        value={value}
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--color-ink-soft)]">
          <span>
            {disabled ? "正在接收流式回复，完成后可继续追问。" : "支持工具调用、Memory 检索和多段响应。"}
          </span>
          <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs">{countLabel}</span>
        </div>
        <button
          className="flex items-center justify-center gap-2 rounded-full bg-ocean px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-[rgba(15,139,141,0.45)] sm:min-w-24"
          disabled={disabled || !value.trim()}
          onClick={submit}
          type="button"
        >
          <SendHorizonal size={16} />
          {disabled ? "生成中" : "发送"}
        </button>
      </div>
    </div>
  );
}
