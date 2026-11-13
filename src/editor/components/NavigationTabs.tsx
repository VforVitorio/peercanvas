import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export type TabDefinition<T extends string> = { id: T; label: string; content: ReactNode };

type Props<T extends string> = {
  label: string;
  tabs: TabDefinition<T>[];
  active: T;
  onChange: (tab: T) => void;
};

/**
 * WAI-ARIA tabs with automatic activation. Inactive panels stay mounted but hidden so form
 * drafts survive switching tabs.
 */
export default function NavigationTabs<T extends string>({
  label,
  tabs,
  active,
  onChange,
}: Props<T>) {
  const base = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === active);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(tabs[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <>
      <div className="pc-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            id={`${base}-tab-${tab.id}`}
            type="button"
            role="tab"
            className="pc-tab"
            aria-selected={tab.id === active}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${base}-panel-${tab.id}`}
          className="pc-panel-body"
          role="tabpanel"
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== active}
        >
          {tab.content}
        </div>
      ))}
    </>
  );
}
