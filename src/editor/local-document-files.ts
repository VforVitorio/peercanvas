import { invoke, isTauri } from "@tauri-apps/api/core";

export type LocalDocumentCandidate = {
  token: string;
  displayName: string;
  primaryText: string | null;
  backupText: string | null;
};

export type LocalDocumentSave = {
  displayName: string;
  warning: string | null;
  recentUpdated: boolean;
};

export type DrawioImportCandidate = {
  displayName: string;
  document: unknown;
  losses: string[];
  preservedFragmentCount: number;
};

export type DrawioExportReview = {
  token: string;
  losses: string[];
  preservedFragmentCount: number;
};

export type DrawioExportOutcome = {
  displayName: string;
  warning: string | null;
};

export const localDocumentFiles = {
  get available() {
    return isTauri();
  },
  recentName: () => invoke<string | null>("get_recent_document_name"),
  loadRecent: () => invoke<LocalDocumentCandidate | null>("load_recent_document"),
  open: () => invoke<LocalDocumentCandidate | null>("open_document"),
  acceptOpen: (token: string, source: "primary" | "backup") =>
    invoke<boolean>("accept_open", { token, source }),
  discardOpen: (token: string) => invoke<void>("discard_open", { token }),
  save: (contents: string, saveAs: boolean) =>
    invoke<LocalDocumentSave | null>("save_document", { contents, saveAs }),
  importDrawio: (now: string) => invoke<DrawioImportCandidate | null>("import_drawio", { now }),
  prepareDrawioExport: (contents: string) =>
    invoke<DrawioExportReview>("prepare_drawio_export", { contents }),
  exportDrawio: (token: string, confirmLosses: boolean) =>
    invoke<DrawioExportOutcome | null>("export_drawio", { token, confirmLosses }),
  discardDrawioExport: (token: string) => invoke<void>("discard_drawio_export", { token }),
  close: () => invoke<void>("close_document"),
};
