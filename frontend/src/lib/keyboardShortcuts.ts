export type KeyboardShortcutEvent = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
};

export function isSaveShortcut(event: KeyboardShortcutEvent) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
}
