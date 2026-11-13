import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  createDocument,
  parseDocument,
  serializeDocument,
  validateDocument,
  type ModelState,
} from "../document";
import { usePreferences } from "../preferences/context";
import {
  diagnostics,
  fromError,
  fromWarning,
  list,
  normalizeLoss,
  text,
  type EditorMessage,
} from "./components/messages";
import { localDocumentFiles, type LocalDocumentCandidate } from "./local-document-files";

export type DocumentReplacement =
  "new" | "open" | "import" | "reopen" | "close" | "quit" | "quit-app";

type RecoveryCandidate = {
  candidate: LocalDocumentCandidate;
  state: ModelState;
};

/** Losses are kept as one structured entry per native report, translated at render time. */
type DrawioImportReview = {
  displayName: string;
  state: ModelState;
  losses: EditorMessage[];
  preservedFragmentCount: number;
};

type DrawioExportReview = {
  token: string;
  losses: EditorMessage[];
  preservedFragmentCount: number;
};

type Options = {
  getModel: () => ModelState;
  replaceModel: (state: ModelState) => void;
  clearHistory: () => void;
  /** Reports a persistent error; `null` clears it. */
  reportError: (message: EditorMessage | null) => void;
  reportFeedback: (message: EditorMessage) => void;
  /** Title for documents created by New/Close, in the current interface language. */
  defaultTitle?: () => string;
  /** Initial page and layer names for documents created by New/Close. */
  defaultPageName?: () => string;
  defaultLayerName?: () => string;
};

type SaveOutcome =
  | { kind: "saved"; unchanged: boolean }
  | { kind: "cancelled" }
  | { kind: "failed"; message: EditorMessage };

const losses = (value: unknown) => (Array.isArray(value) ? value : []).map(normalizeLoss);

export function useLocalDocuments(options: Options) {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  }, [options]);
  // Native overwrite confirmation uses the live interface language, including session-only choices.
  const { locale } = usePreferences();
  const localeRef = useRef(locale);
  useLayoutEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  const available = localDocumentFiles.available;
  const dirtyRef = useRef(true);
  const busyRef = useRef(false);
  const sessionRef = useRef(0);
  const allowWindowClose = useRef(false);
  const pendingActionRef = useRef<DocumentReplacement | null>(null);
  const recoveryRef = useRef<RecoveryCandidate | null>(null);
  const drawioImportRef = useRef<DrawioImportReview | null>(null);
  const drawioExportRef = useRef<DrawioExportReview | null>(null);
  const [dirty, setDirtyState] = useState(true);
  const [busy, setBusyState] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [recentName, setRecentName] = useState<string | null>(null);
  const [pendingAction, setPendingActionState] = useState<DocumentReplacement | null>(null);
  const [promptError, setPromptError] = useState<EditorMessage | null>(null);
  const [recovery, setRecovery] = useState<RecoveryCandidate | null>(null);
  const [drawioImport, setDrawioImport] = useState<DrawioImportReview | null>(null);
  const [drawioExport, setDrawioExport] = useState<DrawioExportReview | null>(null);
  const [recovered, setRecovered] = useState(false);

  const setDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    setDirtyState(value);
  }, []);

  const setBusy = useCallback((value: boolean) => {
    busyRef.current = value;
    setBusyState(value);
  }, []);

  const setRecoveryCandidate = useCallback((value: RecoveryCandidate | null) => {
    recoveryRef.current = value;
    setRecovery(value);
  }, []);

  const stageDrawioImport = useCallback((value: DrawioImportReview | null) => {
    drawioImportRef.current = value;
    setDrawioImport(value);
  }, []);

  const stageDrawioExport = useCallback((value: DrawioExportReview | null) => {
    drawioExportRef.current = value;
    setDrawioExport(value);
  }, []);

  const isEditingLocked = useCallback(
    () =>
      busyRef.current ||
      pendingActionRef.current !== null ||
      recoveryRef.current !== null ||
      drawioImportRef.current !== null ||
      drawioExportRef.current !== null,
    [],
  );

  useEffect(() => {
    if (!available) return;
    let mounted = true;
    void localDocumentFiles
      .recentName()
      .then((name) => {
        if (mounted) setRecentName(name);
      })
      .catch((error: unknown) => {
        if (mounted) optionsRef.current.reportError(fromError(error));
      });
    return () => {
      mounted = false;
    };
  }, [available]);

  function installDocument(state: ModelState, name: string | null, hasChanges: boolean) {
    sessionRef.current += 1;
    optionsRef.current.clearHistory();
    optionsRef.current.replaceModel(state);
    setFileName(name);
    setDirty(hasChanges);
    setRecovered(false);
    setRecoveryCandidate(null);
    optionsRef.current.reportError(null);
  }

  function blankDocument(): ModelState | null {
    const now = new Date().toISOString();
    const result = createDocument({
      documentId: crypto.randomUUID(),
      pageId: crypto.randomUUID(),
      layerId: crypto.randomUUID(),
      title: optionsRef.current.defaultTitle?.() || "Untitled diagram",
      pageName: optionsRef.current.defaultPageName?.() || "Page 1",
      layerName: optionsRef.current.defaultLayerName?.() || "Layer 1",
      now,
    });
    if (!result.ok) {
      optionsRef.current.reportError(diagnostics(result.errors));
      return null;
    }
    return result.value;
  }

  const save = useCallback(
    async (saveAs: boolean): Promise<SaveOutcome> => {
      if (!available) {
        const message = text("documents.errors.desktopOnlySave");
        optionsRef.current.reportError(message);
        return { kind: "failed", message };
      }
      if (busyRef.current)
        return { kind: "failed", message: text("documents.errors.operationRunning") };

      const session = sessionRef.current;
      const snapshot = optionsRef.current.getModel();
      const serialized = serializeDocument(snapshot.document);
      if (!serialized.ok) {
        const message = diagnostics(serialized.errors);
        optionsRef.current.reportError(message);
        return { kind: "failed", message };
      }

      setBusy(true);
      try {
        const result = await localDocumentFiles.save(serialized.value, saveAs, localeRef.current);
        if (!result) return { kind: "cancelled" };
        if (session !== sessionRef.current) return { kind: "saved", unchanged: false };

        setFileName(result.displayName);
        setRecentName(result.recentUpdated ? result.displayName : null);
        setRecovered(false);
        const unchanged = optionsRef.current.getModel().revision === snapshot.revision;
        setDirty(!unchanged);
        if (result.warning) optionsRef.current.reportError(fromWarning(result.warning));
        else
          optionsRef.current.reportFeedback(
            text("documents.feedback.saved", { name: result.displayName }),
          );
        return { kind: "saved", unchanged };
      } catch (error) {
        const message = fromError(error);
        optionsRef.current.reportError(message);
        return { kind: "failed", message };
      } finally {
        setBusy(false);
      }
    },
    [available, setBusy, setDirty],
  );

  async function acceptCandidate(candidate: LocalDocumentCandidate) {
    const primary = candidate.primaryText === null ? null : parseDocument(candidate.primaryText);
    if (primary?.ok) {
      let recentUpdated = false;
      try {
        recentUpdated = await localDocumentFiles.acceptOpen(candidate.token, "primary");
      } catch (error) {
        await localDocumentFiles.discardOpen(candidate.token).catch(() => undefined);
        optionsRef.current.reportError(fromError(error));
        return;
      }
      installDocument(
        { document: primary.value.document, revision: 0 },
        candidate.displayName,
        primary.value.migrated,
      );
      setRecentName(recentUpdated ? candidate.displayName : null);
      optionsRef.current.reportFeedback(
        primary.value.migrated
          ? text("documents.feedback.openedMigrated", { name: candidate.displayName })
          : text("documents.feedback.opened", { name: candidate.displayName }),
      );
      if (!recentUpdated) {
        optionsRef.current.reportError(text("documents.errors.recentNotUpdated"));
      }
      return;
    }

    const backup = candidate.backupText === null ? null : parseDocument(candidate.backupText);
    if (backup?.ok) {
      setRecoveryCandidate({
        candidate,
        state: { document: backup.value.document, revision: 0 },
      });
      // Keep the specific validation reason, followed by the recovery explanation.
      optionsRef.current.reportError(
        primary
          ? list(diagnostics(primary.errors), text("documents.errors.backupAvailable"))
          : text("documents.errors.backupAvailableMissing"),
      );
      return;
    }

    await localDocumentFiles.discardOpen(candidate.token).catch(() => undefined);
    optionsRef.current.reportError(
      primary ? diagnostics(primary.errors) : text("documents.errors.fileAndBackupUnavailable"),
    );
  }

  async function execute(action: DocumentReplacement) {
    if (action === "quit-app") {
      setBusy(true);
      try {
        await invoke("quit_application");
      } catch (error) {
        setBusy(false);
        optionsRef.current.reportError(fromError(error));
      }
      return;
    }
    if (action === "quit") {
      setBusy(true);
      allowWindowClose.current = true;
      try {
        await getCurrentWindow().close();
      } catch (error) {
        allowWindowClose.current = false;
        setBusy(false);
        optionsRef.current.reportError(fromError(error));
      }
      return;
    }
    if (busyRef.current) return;

    setBusy(true);
    try {
      if (action === "new" || action === "close") {
        const blank = blankDocument();
        if (!blank) return;
        if (available) await localDocumentFiles.close();
        installDocument(blank, null, false);
        optionsRef.current.reportFeedback(
          text(action === "new" ? "documents.feedback.created" : "documents.feedback.closed"),
        );
        return;
      }

      if (action === "import") {
        const candidate = await localDocumentFiles.importDrawio(new Date().toISOString());
        if (!candidate) {
          optionsRef.current.reportFeedback(text("documents.feedback.importCanceled"));
          return;
        }
        const document = validateDocument(candidate.document);
        if (!document.ok) {
          optionsRef.current.reportError(diagnostics(document.errors));
          return;
        }
        stageDrawioImport({
          displayName: candidate.displayName,
          state: { document: document.value, revision: 0 },
          losses: losses(candidate.losses),
          preservedFragmentCount: candidate.preservedFragmentCount,
        });
        return;
      }

      const candidate =
        action === "open" ? await localDocumentFiles.open() : await localDocumentFiles.loadRecent();
      if (!candidate) {
        optionsRef.current.reportFeedback(
          text(
            action === "open" ? "documents.feedback.openCanceled" : "documents.feedback.noRecent",
          ),
        );
        return;
      }
      await acceptCandidate(candidate);
    } catch (error) {
      optionsRef.current.reportError(fromError(error));
    } finally {
      setBusy(false);
    }
  }

  function request(action: DocumentReplacement) {
    if (isEditingLocked()) return;
    if (!dirtyRef.current) {
      void execute(action);
      return;
    }
    pendingActionRef.current = action;
    setPendingActionState(action);
    setPromptError(null);
  }

  async function saveAndContinue() {
    const action = pendingActionRef.current;
    if (!action) return;
    const result = await save(false);
    if (result.kind === "saved" && result.unchanged && !dirtyRef.current) {
      pendingActionRef.current = null;
      setPendingActionState(null);
      setPromptError(null);
      await execute(action);
      return;
    }
    setPromptError(
      result.kind === "failed"
        ? result.message
        : result.kind === "cancelled"
          ? text("documents.errors.saveCanceled")
          : text("documents.errors.changedWhileSaving"),
    );
  }

  function discardAndContinue() {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setPendingActionState(null);
    setPromptError(null);
    if (action) void execute(action);
  }

  function cancelReplacement() {
    pendingActionRef.current = null;
    setPendingActionState(null);
    setPromptError(null);
  }

  function acceptDrawioImport() {
    const candidate = drawioImportRef.current;
    if (!candidate || busyRef.current) return;
    stageDrawioImport(null);
    installDocument(candidate.state, null, true);
    optionsRef.current.reportFeedback(
      text("documents.feedback.imported", { name: candidate.displayName }),
    );
  }

  function cancelDrawioImport() {
    if (!drawioImportRef.current || busyRef.current) return;
    stageDrawioImport(null);
    optionsRef.current.reportFeedback(text("documents.feedback.importCanceledKeep"));
  }

  const prepareDrawioExport = useCallback(async () => {
    if (!available) {
      optionsRef.current.reportError(text("documents.errors.desktopOnlyExport"));
      return;
    }
    if (isEditingLocked()) return;
    const session = sessionRef.current;
    const snapshot = optionsRef.current.getModel();
    const serialized = serializeDocument(snapshot.document);
    if (!serialized.ok) {
      optionsRef.current.reportError(diagnostics(serialized.errors));
      return;
    }
    setBusy(true);
    try {
      const review = await localDocumentFiles.prepareDrawioExport(serialized.value);
      if (
        session !== sessionRef.current ||
        optionsRef.current.getModel().revision !== snapshot.revision
      ) {
        await localDocumentFiles.discardDrawioExport(review.token).catch(() => undefined);
        optionsRef.current.reportError(text("documents.errors.changedWhileExporting"));
        return;
      }
      stageDrawioExport({
        token: review.token,
        losses: losses(review.losses),
        preservedFragmentCount: review.preservedFragmentCount,
      });
    } catch (error) {
      optionsRef.current.reportError(fromError(error));
    } finally {
      setBusy(false);
    }
  }, [available, isEditingLocked, setBusy, stageDrawioExport]);

  const confirmDrawioExport = useCallback(async () => {
    const review = drawioExportRef.current;
    if (!review || busyRef.current) return;
    setBusy(true);
    try {
      const result = await localDocumentFiles.exportDrawio(
        review.token,
        review.losses.length > 0,
        localeRef.current,
      );
      stageDrawioExport(null);
      if (!result) {
        optionsRef.current.reportFeedback(text("documents.feedback.exportCanceled"));
        return;
      }
      if (result.warning) optionsRef.current.reportError(fromWarning(result.warning));
      else
        optionsRef.current.reportFeedback(
          text("documents.feedback.exported", { name: result.displayName }),
        );
    } catch (error) {
      optionsRef.current.reportError(fromError(error));
      await localDocumentFiles.discardDrawioExport(review.token).catch(() => undefined);
      stageDrawioExport(null);
    } finally {
      setBusy(false);
    }
  }, [setBusy, stageDrawioExport]);

  const cancelDrawioExport = useCallback(async () => {
    const review = drawioExportRef.current;
    if (!review || busyRef.current) return;
    setBusy(true);
    try {
      await localDocumentFiles.discardDrawioExport(review.token);
      optionsRef.current.reportFeedback(text("documents.feedback.exportCanceled"));
    } catch (error) {
      optionsRef.current.reportError(fromError(error));
    } finally {
      stageDrawioExport(null);
      setBusy(false);
    }
  }, [setBusy, stageDrawioExport]);

  async function recoverBackup() {
    if (!recovery || busyRef.current) return;
    setBusy(true);
    try {
      await localDocumentFiles.acceptOpen(recovery.candidate.token, "backup");
      sessionRef.current += 1;
      optionsRef.current.clearHistory();
      optionsRef.current.replaceModel(recovery.state);
      setFileName(null);
      setRecentName(null);
      setDirty(true);
      setRecovered(true);
      setRecoveryCandidate(null);
      optionsRef.current.reportError(null);
      optionsRef.current.reportFeedback(
        text("documents.feedback.recovered", { name: recovery.candidate.displayName }),
      );
    } catch (error) {
      optionsRef.current.reportError(fromError(error));
    } finally {
      setBusy(false);
    }
  }

  async function dismissRecovery() {
    if (!recovery || busyRef.current) return;
    setBusy(true);
    try {
      await localDocumentFiles.discardOpen(recovery.candidate.token);
      setRecoveryCandidate(null);
      optionsRef.current.reportError(null);
      optionsRef.current.reportFeedback(text("documents.feedback.recoveryCanceled"));
    } catch (error) {
      optionsRef.current.reportError(fromError(error));
    } finally {
      setBusy(false);
    }
  }

  const requestRef = useRef(request);
  useLayoutEffect(() => {
    requestRef.current = request;
  });
  useEffect(() => {
    if (!available) return;
    let mounted = true;
    const unlisten: (() => void)[] = [];
    function register(listener: Promise<() => void>) {
      void listener
        .then((stop) => {
          if (mounted) unlisten.push(stop);
          else stop();
        })
        .catch((error: unknown) => {
          if (mounted) optionsRef.current.reportError(fromError(error));
        });
    }
    register(
      getCurrentWindow().onCloseRequested((event) => {
        if (allowWindowClose.current) return;
        if (busyRef.current) {
          event.preventDefault();
          optionsRef.current.reportError(text("documents.errors.closeWhileBusy"));
          return;
        }
        if (!dirtyRef.current) return;
        event.preventDefault();
        requestRef.current("quit");
      }),
    );
    register(listen("peercanvas-quit-requested", () => requestRef.current("quit-app")));
    return () => {
      mounted = false;
      unlisten.forEach((stop) => stop());
    };
  }, [available]);

  return {
    available,
    busy,
    dirty,
    fileName,
    recentName,
    recovered,
    pendingAction,
    promptError,
    recovery,
    drawioImport,
    drawioExport,
    isEditingLocked,
    markDirty: () => setDirty(true),
    newDocument: () => request("new"),
    openDocument: () => request("open"),
    importDrawio: () => request("import"),
    reopenLast: () => request("reopen"),
    closeDocument: () => request("close"),
    saveDocument: () => save(false),
    saveAs: () => save(true),
    saveAndContinue,
    discardAndContinue,
    cancelReplacement,
    recoverBackup,
    dismissRecovery,
    acceptDrawioImport,
    cancelDrawioImport,
    prepareDrawioExport,
    confirmDrawioExport,
    cancelDrawioExport,
  };
}

export type LocalDocuments = ReturnType<typeof useLocalDocuments>;
