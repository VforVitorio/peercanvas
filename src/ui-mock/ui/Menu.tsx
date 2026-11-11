import { useEffect, useId, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  shortcut?: string;
  onSelect: () => void;
  /** Disabled items stay focusable and announce why via `reason`. */
  disabledReason?: string | null;
  separatorBefore?: boolean;
}

interface MenuProps {
  label: string;
  items: MenuItem[];
  onExplain: (message: string) => void;
}

/**
 * Menu button following the WAI-ARIA menu button pattern: Enter/Space/ArrowDown open,
 * arrows/Home/End move, Escape closes and restores focus to the button, Tab closes.
 */
export default function Menu({ label, items, onExplain }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const close = (restore = true) => {
    setOpen(false);
    if (restore) button.current?.focus();
  };

  const choose = (item: MenuItem) => {
    close();
    if (item.disabledReason) onExplain(item.disabledReason);
    else item.onSelect();
  };

  const onListKey = (event: React.KeyboardEvent) => {
    const count = items.length;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((i) => (i + 1) % count);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => (i - 1 + count) % count);
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(count - 1);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  return (
    <div className="pc-menu">
      <button
        ref={button}
        type="button"
        className="pc-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setActive(0);
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(event.key === "ArrowUp" ? items.length - 1 : 0);
            setOpen(true);
          }
        }}
      >
        {label}
      </button>
      {open && (
        <ul
          ref={list}
          id={menuId}
          role="menu"
          aria-label={label}
          className="pc-menu-list"
          onKeyDown={onListKey}
        >
          {items.map((item, index) => (
            <li
              key={item.label}
              role="menuitem"
              tabIndex={index === active ? 0 : -1}
              aria-disabled={item.disabledReason ? true : undefined}
              className={item.separatorBefore ? "pc-menu-item pc-menu-sep" : "pc-menu-item"}
              onClick={() => choose(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  choose(item);
                }
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span>{item.label}</span>
              {item.disabledReason ? (
                <span className="pc-menu-hint">Unavailable</span>
              ) : (
                item.shortcut && <kbd>{item.shortcut}</kbd>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
