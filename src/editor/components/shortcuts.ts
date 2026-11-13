/** Platform-aware shortcut labels. Key names are conventional symbols and are not translated. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");
}

/**
 * Converts a platform-neutral chord such as "Mod+Shift+S" to a visible label ("⇧⌘S" or
 * "Ctrl+Shift+S") and an aria-keyshortcuts value ("Meta+Shift+S" or "Control+Shift+S").
 */
export function shortcutLabel(chord: string): { display: string; aria: string } {
  const apple = isApplePlatform();
  const parts = chord.split("+");
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  const symbols: Record<string, string> = { Alt: "⌥", Shift: "⇧", Mod: "⌘" };
  const display = apple
    ? modifiers
        .map((part) => symbols[part] ?? part)
        .sort((left, right) => "⌥⇧⌘".indexOf(left) - "⌥⇧⌘".indexOf(right))
        .join("") + key
    : [...modifiers.map((part) => (part === "Mod" ? "Ctrl" : part)), key].join("+");
  const aria = [
    ...modifiers.map((part) => (part === "Mod" ? (apple ? "Meta" : "Control") : part)),
    key,
  ].join("+");
  return { display, aria };
}
