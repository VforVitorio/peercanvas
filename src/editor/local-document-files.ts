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
  close: () => invoke<void>("close_document"),
};
