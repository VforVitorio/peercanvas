import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "../../i18n";
import { shortcutLabel } from "./shortcuts";

export type FileMenuItem =
  | {
      id: string;
      label: string;
      onSelect: () => void;
      disabled?: boolean;
      /** Platform-neutral shortcut, for example "Mod+Shift+S". */
      shortcut?: string;
      title?: string;
    }
  | { id: string; separator: true };

type Props = { items: FileMenuItem[]; disabled?: boolean };

/** Accessible menu button following the WAI-ARIA menu pattern. */
export default function FileMenu({ items, disabled = false }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const focusOnOpen = useRef<"first" | "last">("first");
  const menuId = useId();

  const enabledItems = () =>
    Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? []).filter(
      (item) => !item.disabled,
    );

  useEffect(() => {
    if (!open) return;
    const candidates = enabledItems();
    const target = focusOnOpen.current === "last" ? candidates.at(-1) : candidates[0];
    (target ?? menu.current)?.focus();
    function onPointerDown(event: PointerEvent) {
      const target = event.target as globalThis.Node | null;
      if (target && !menu.current?.contains(target) && !button.current?.contains(target))
        setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) button.current?.focus();
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOnOpen.current = event.key === "ArrowUp" ? "last" : "first";
      setOpen(true);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const candidates = enabledItems();
    const index = candidates.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    switch (event.key) {
      case "ArrowDown":
        next = candidates[(index + 1) % candidates.length];
        break;
      case "ArrowUp":
        next = candidates[(index - 1 + candidates.length) % candidates.length];
        break;
      case "Home":
        next = candidates[0];
        break;
      case "End":
        next = candidates.at(-1);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
      default:
        return;
    }
    event.preventDefault();
    next?.focus();
  }

  return (
    <div className="pc-menu">
      <button
        ref={button}
        type="button"
        className="pc-btn pc-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => {
          focusOnOpen.current = "first";
          setOpen((value) => !value);
        }}
        onKeyDown={onButtonKeyDown}
      >
        {t("documents.menu.file")}
      </button>
      {open && (
        <ul
          ref={menu}
          id={menuId}
          className="pc-menu-popup"
          data-align="start"
          role="menu"
          aria-label={t("documents.menu.file")}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) =>
            "separator" in item ? (
              <li key={item.id} role="separator" className="pc-menu-separator" />
            ) : (
              <li key={item.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="pc-menu-item"
                  tabIndex={-1}
                  disabled={item.disabled}
                  title={item.title}
                  aria-keyshortcuts={item.shortcut ? shortcutLabel(item.shortcut).aria : undefined}
                  onClick={() => {
                    close(true);
                    item.onSelect();
                  }}
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="pc-menu-shortcut" aria-hidden="true">
                      {shortcutLabel(item.shortcut).display}
                    </span>
                  )}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
