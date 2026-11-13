import { invoke, isTauri } from "@tauri-apps/api/core";
import type { NativeMessage } from "../native/contracts";

/**
 * Typed renderer adapter for the native local-file commands. Native failures reject with a
 * {@link NativeMessage}; warnings and draw.io loss entries are stable codes with named parameters.
 * The renderer translates them at presentation time and never shows raw native text.
 */
export type LocalDocumentCandidate = {
  token: string;
  displayName: string;
  primaryText: string | null;
  backupText: string | null;
};

export type LocalDocumentSave = {
  displayName: string;
  warning: NativeMessage | null;
  recentUpdated: boolean;
};

export type DrawioImportCandidate = {
  displayName: string;
  document: unknown;
  losses: NativeMessage[];
  preservedFragmentCount: number;
};

export type DrawioExportReview = {
  token: string;
  losses: NativeMessage[];
  preservedFragmentCount: number;
};

export type DrawioExportOutcome = {
  displayName: string;
  warning: NativeMessage | null;
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
  save: (contents: string, saveAs: boolean, locale: "en" | "es") =>
    invoke<LocalDocumentSave | null>("save_document", { contents, saveAs, locale }),
  importDrawio: (now: string) => invoke<DrawioImportCandidate | null>("import_drawio", { now }),
  prepareDrawioExport: (contents: string) =>
    invoke<DrawioExportReview>("prepare_drawio_export", { contents }),
  /** `locale` selects the language of the native overwrite confirmation. */
  exportDrawio: (token: string, confirmLosses: boolean, locale: "en" | "es") =>
    invoke<DrawioExportOutcome | null>("export_drawio", { token, confirmLosses, locale }),
  discardDrawioExport: (token: string) => invoke<void>("discard_drawio_export", { token }),
  close: () => invoke<void>("close_document"),
};
