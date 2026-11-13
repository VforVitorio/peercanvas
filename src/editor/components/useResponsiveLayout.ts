import { useCallback, useEffect, useRef, useState } from "react";

/**
 * wide >= 1280 px, medium 1024..1279 px: both side panels are permanent.
 * compact 760..1023 px: the navigation panel becomes a drawer.
 * narrow < 760 px: navigation and inspector are both drawers.
 */
export type WorkspaceLayout = "wide" | "medium" | "compact" | "narrow";
export type DrawerSide = "left" | "right";

const queries = [
  ["wide", "(min-width: 1280px)"],
  ["medium", "(min-width: 1024px)"],
  ["compact", "(min-width: 760px)"],
] as const;

function currentLayout(): WorkspaceLayout {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "wide";
  for (const [layout, query] of queries) if (window.matchMedia(query).matches) return layout;
  return "narrow";
}

export function useResponsiveLayout() {
  const [layout, setLayout] = useState<WorkspaceLayout>(currentLayout);
  const [open, setOpen] = useState<DrawerSide | null>(null);
  const toggles = useRef<Record<DrawerSide, HTMLButtonElement | null>>({ left: null, right: null });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const lists = queries.map(([, query]) => window.matchMedia(query));
    const update = () => setLayout(currentLayout());
    for (const list of lists) list.addEventListener?.("change", update);
    update();
    return () => {
      for (const list of lists) list.removeEventListener?.("change", update);
    };
  }, []);

  const leftDrawer = layout === "compact" || layout === "narrow";
  const rightDrawer = layout === "narrow";
  const isDrawer = useCallback(
    (side: DrawerSide) => (side === "left" ? leftDrawer : rightDrawer),
    [leftDrawer, rightDrawer],
  );

  // A side that becomes permanent is no longer an open drawer.
  useEffect(() => {
    setOpen((side) => (side && isDrawer(side) ? side : null));
  }, [isDrawer]);

  const openRef = useRef(open);
  const restoreFocus = useRef<DrawerSide | null>(null);
  useEffect(() => {
    openRef.current = open;
    // Restore after the render that removes `inert` from the rest of the shell.
    if (open === null && restoreFocus.current) {
      toggles.current[restoreFocus.current]?.focus();
      restoreFocus.current = null;
    }
  }, [open]);

  /** Opens one drawer at a time; the other closes so the canvas stays visible. */
  const openDrawer = useCallback((side: DrawerSide) => {
    openRef.current = side;
    setOpen(side);
  }, []);

  /** Closes a drawer and returns focus to the control that opened it. */
  const closeDrawer = useCallback((restore = true) => {
    const side = openRef.current;
    openRef.current = null;
    if (side && restore) restoreFocus.current = side;
    setOpen(null);
  }, []);

  const toggleDrawer = useCallback(
    (side: DrawerSide) => {
      if (open === side) closeDrawer();
      else openDrawer(side);
    },
    [closeDrawer, open, openDrawer],
  );

  const registerToggle = useCallback(
    (side: DrawerSide) => (element: HTMLButtonElement | null) => {
      toggles.current[side] = element;
    },
    [],
  );

  return {
    layout,
    isDrawer,
    isOpen: (side: DrawerSide) => open === side,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    registerToggle,
  };
}

export type ResponsiveLayout = ReturnType<typeof useResponsiveLayout>;
