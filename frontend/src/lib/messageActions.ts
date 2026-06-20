export type CopyState = "idle" | "copying" | "copied" | "error";

export const COPY_FEEDBACK_RESET_MS = 1600;

export function canCopyMessage(content: string) {
  return content.trim().length > 0;
}

export function getCopyMessageLabel(state: CopyState) {
  if (state === "copying") {
    return "复制中";
  }

  if (state === "copied") {
    return "已复制";
  }

  if (state === "error") {
    return "复制失败";
  }

  return "复制";
}

export function shouldResetCopyState(state: CopyState) {
  return state === "copied" || state === "error";
}

export async function copyTextToClipboard(text: string) {
  if (!canCopyMessage(text)) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
