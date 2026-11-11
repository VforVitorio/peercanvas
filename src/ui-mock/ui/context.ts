import { createContext, useContext } from "react";
import type { DemoService, DemoState } from "../services/demo-service";
import {
  initialPreferences,
  type DialogState,
  type LeftPanel,
  type PendingReplacement,
  type Preferences,
  type RightPanel,
} from "./types";

/** Transient presentation state owned by the UI (never part of the canonical document). */
export interface UiState {
  view: "home" | "workspace";
  homeSection: "recent" | "recovery";
  search: string;
  prefs: Preferences;
  zoom: number;
  fitRequest: number;
  leftOpen: boolean;
  rightOpen: boolean;
  leftPanel: LeftPanel;
  rightPanel: RightPanel;
  dialog: DialogState | null;
  assistantSource: "assistant" | "mcp";
}

export const initialUi: UiState = {
  view: "home",
  homeSection: "recent",
  search: "",
  prefs: initialPreferences,
  zoom: 1,
  fitRequest: 0,
  leftOpen: true,
  rightOpen: true,
  leftPanel: "outline",
  rightPanel: "inspector",
  dialog: null,
  assistantSource: "assistant",
};

export interface DemoActions {
  announce: (message: string) => void;
  explain: (message: string) => void;
  run: (label: string, work: () => Promise<void> | void) => void;
  requestReplace: (action: PendingReplacement) => void;
  resolveReplace: (action: PendingReplacement, decision: "save" | "discard") => void;
  cancelReplace: () => void;
  openDialog: (dialog: DialogState) => void;
  closeDialog: () => void;
  setZoom: (zoom: number) => void;
  zoomBy: (direction: 1 | -1) => void;
  resetDemo: () => void;
  loadFixture: (fixture: DemoState["fixture"]) => void;
  showPanel: (panel: RightPanel) => void;
}

export interface DemoContextValue {
  service: DemoService;
  state: DemoState;
  ui: UiState;
  setUi: (update: (ui: UiState) => UiState) => void;
  actions: DemoActions;
  dirty: boolean;
}

export const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside the demo provider");
  return value;
}

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export const fixtureLabels: Record<DemoState["fixture"], { title: string; summary: string }> = {
  empty: { title: "Untitled diagram", summary: "An empty document with one page and one layer." },
  diagram: {
    title: "Product architecture",
    summary: "Two pages and two layers of connected services.",
  },
  collaboration: {
    title: "Team workspace",
    summary: "Fictional participants, roles, and a pending join request.",
  },
  proposal: {
    title: "Service blueprint",
    summary: "Opens with a pending assistant proposal to review.",
  },
};

export const scenarioLabels: Record<DemoState["scenario"], string> = {
  success: "Success",
  wait: "Wait (manual continue)",
  cancel: "Cancelled",
  error: "Error",
};
