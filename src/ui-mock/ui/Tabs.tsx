import { useId, useRef, type ReactNode } from "react";

interface TabsProps<T extends string> {
  label: string;
  tabs: ReadonlyArray<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
  children: ReactNode;
}

/** WAI-ARIA tabs with automatic activation and roving tabindex. */
export default function Tabs<T extends string>({
  label,
  tabs,
  active,
  onChange,
  children,
}: TabsProps<T>) {
  const base = useId();
  const list = useRef<HTMLDivElement>(null);
  const focusTab = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length];
    onChange(next.id);
    queueMicrotask(() =>
      list.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus(),
    );
  };
  return (
    <>
      <div ref={list} role="tablist" aria-label={label} className="pc-tabs">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab={tab.id}
            id={`${base}-tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`${base}-panel`}
            tabIndex={tab.id === active ? 0 : -1}
            className="pc-tab"
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") focusTab(index + 1);
              else if (event.key === "ArrowLeft") focusTab(index - 1);
              else if (event.key === "Home") focusTab(0);
              else if (event.key === "End") focusTab(tabs.length - 1);
              else return;
              event.preventDefault();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${active}`}
        className="pc-tabpanel"
        tabIndex={0}
      >
        {children}
      </div>
    </>
  );
}
