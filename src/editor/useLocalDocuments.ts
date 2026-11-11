import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createDocument, parseDocument, serializeDocument, type ModelState } from "../document";
import { localDocumentFiles, type LocalDocumentCandidate } from "./local-document-files";

export type DocumentReplacement = "new" | "open" | "reopen" | "close" | "quit" | "quit-app";

type RecoveryCandidate = {
  candidate: LocalDocumentCandidate;
  state: ModelState;
};

type Options = {
  getModel: () => ModelState;
  replaceModel: (state: ModelState) => void;
  clearHistory: () => void;
  reportError: (message: string) => void;
  reportFeedback: (message: string) => void;
};

type SaveOutcome =
  | { kind: "saved"; unchanged: boolean }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

const diagnosticText = (errors: { message: string }[]) =>
  errors.map((diagnostic) => diagnostic.message).join(" ");

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useLocalDocuments(options: Options) {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  }, [options]);
  const available = localDocumentFiles.available;
  const dirtyRef = useRef(true);
  const busyRef = useRef(false);
  const sessionRef = useRef(0);
  const allowWindowClose = useRef(false);
  const pendingActionRef = useRef<DocumentReplacement | null>(null);
  const recoveryRef = useRef<RecoveryCandidate | null>(null);
  const [dirty, setDirtyState] = useState(true);
  const [busy, setBusyState] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [recentName, setRecentName] = useState<string | null>(null);
  const [pendingAction, setPendingActionState] = useState<DocumentReplacement | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryCandidate | null>(null);
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

  const isEditingLocked = useCallback(
    () => busyRef.current || pendingActionRef.current !== null || recoveryRef.current !== null,
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
        if (mounted) optionsRef.current.reportError(errorText(error));
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
    optionsRef.current.reportError("");
  }

  function blankDocument(): ModelState | null {
    const now = new Date().toISOString();
    const result = createDocument({
      documentId: crypto.randomUUID(),
      pageId: crypto.randomUUID(),
      layerId: crypto.randomUUID(),
      title: "Untitled diagram",
      now,
    });
    if (!result.ok) {
      optionsRef.current.reportError(diagnosticText(result.errors));
      return null;
    }
    return result.value;
  }

  const save = useCallback(
    async (saveAs: boolean): Promise<SaveOutcome> => {
      if (!available) {
        const message = "Saving is available in the PeerCanvas desktop app.";
        optionsRef.current.reportError(message);
        return { kind: "failed", message };
      }
      if (busyRef.current) return { kind: "failed", message: "Another file operation is running." };

      const session = sessionRef.current;
      const snapshot = optionsRef.current.getModel();
      const serialized = serializeDocument(snapshot.document);
      if (!serialized.ok) {
        const message = diagnosticText(serialized.errors);
        optionsRef.current.reportError(message);
        return { kind: "failed", message };
      }

      setBusy(true);
      try {
        const result = await localDocumentFiles.save(serialized.value, saveAs);
        if (!result) return { kind: "cancelled" };
        if (session !== sessionRef.current) return { kind: "saved", unchanged: false };

        setFileName(result.displayName);
        setRecentName(result.recentUpdated ? result.displayName : null);
        setRecovered(false);
        const unchanged = optionsRef.current.getModel().revision === snapshot.revision;
        setDirty(!unchanged);
        if (result.warning) optionsRef.current.reportError(result.warning);
        else optionsRef.current.reportFeedback(`Saved ${result.displayName}.`);
        return { kind: "saved", unchanged };
      } catch (error) {
        const message = errorText(error);
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
        optionsRef.current.reportError(errorText(error));
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
          ? `Opened and migrated ${candidate.displayName}. Save to update its format.`
          : `Opened ${candidate.displayName}.`,
      );
      if (!recentUpdated) {
        optionsRef.current.reportError(
          "Opened the document, but Reopen last could not be updated. Save it again to update the preference.",
        );
      }
      return;
    }

    const backup = candidate.backupText === null ? null : parseDocument(candidate.backupText);
    if (backup?.ok) {
      setRecoveryCandidate({
        candidate,
        state: { document: backup.value.document, revision: 0 },
      });
      const reason = primary ? diagnosticText(primary.errors) : "The original file is missing.";
      optionsRef.current.reportError(`${reason} A previous complete backup is available.`);
      return;
    }

    await localDocumentFiles.discardOpen(candidate.token).catch(() => undefined);
    optionsRef.current.reportError(
      primary
        ? diagnosticText(primary.errors)
        : "The selected file and its backup are unavailable.",
    );
  }

  async function execute(action: DocumentReplacement) {
    if (action === "quit-app") {
      setBusy(true);
      try {
        await invoke("quit_application");
      } catch (error) {
        setBusy(false);
        optionsRef.current.reportError(errorText(error));
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
        optionsRef.current.reportError(errorText(error));
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
          action === "new" ? "New document created." : "Document closed.",
        );
        return;
      }

      const candidate =
        action === "open" ? await localDocumentFiles.open() : await localDocumentFiles.loadRecent();
      if (!candidate) {
        optionsRef.current.reportFeedback(
          action === "open" ? "Open canceled." : "No recent document was selected.",
        );
        return;
      }
      await acceptCandidate(candidate);
    } catch (error) {
      optionsRef.current.reportError(errorText(error));
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
          ? "Save was canceled. Your document is still open."
          : "The document changed while it was saving. Save again before continuing.",
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
      optionsRef.current.reportError("");
      optionsRef.current.reportFeedback(
        `Recovered ${recovery.candidate.displayName}. Save As creates a separate file; the damaged source is unchanged.`,
      );
    } catch (error) {
      optionsRef.current.reportError(errorText(error));
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
      optionsRef.current.reportError("");
      optionsRef.current.reportFeedback("Recovery canceled; the current document remains open.");
    } catch (error) {
      optionsRef.current.reportError(errorText(error));
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
          if (mounted) optionsRef.current.reportError(errorText(error));
        });
    }
    register(
      getCurrentWindow().onCloseRequested((event) => {
        if (allowWindowClose.current) return;
        if (busyRef.current) {
          event.preventDefault();
          optionsRef.current.reportError(
            "A file operation is still running. Close again when it finishes.",
          );
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
    isEditingLocked,
    markDirty: () => setDirty(true),
    newDocument: () => request("new"),
    openDocument: () => request("open"),
    reopenLast: () => request("reopen"),
    closeDocument: () => request("close"),
    saveDocument: () => save(false),
    saveAs: () => save(true),
    saveAndContinue,
    discardAndContinue,
    cancelReplacement,
    recoverBackup,
    dismissRecovery,
  };
}
