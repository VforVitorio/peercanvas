import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSample } from "./sample";
import type { ModelState } from "../document";

const files = vi.hoisted(() => ({
  available: true,
  recentName: vi.fn(),
  loadRecent: vi.fn(),
  open: vi.fn(),
  acceptOpen: vi.fn(),
  discardOpen: vi.fn(),
  save: vi.fn(),
  importDrawio: vi.fn(),
  prepareDrawioExport: vi.fn(),
  exportDrawio: vi.fn(),
  discardDrawioExport: vi.fn(),
  close: vi.fn(),
}));
const windowState = vi.hoisted(() => ({
  onClose: undefined as
    ((event: { preventDefault: () => void }) => void | Promise<void>) | undefined,
  close: vi.fn(),
}));
const eventState = vi.hoisted(() => ({
  onQuit: undefined as (() => void) | undefined,
  listen: vi.fn(),
  unlisten: vi.fn(),
}));
const appState = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("./local-document-files", () => ({ localDocumentFiles: files }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: appState.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: eventState.listen }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: (
      handler: (event: { preventDefault: () => void }) => void | Promise<void>,
    ) => {
      windowState.onClose = handler;
      return Promise.resolve(vi.fn());
    },
    close: windowState.close,
  }),
}));

import { serializeDocument } from "../document";
import { PreferencesContext, fallbackPreferences } from "../preferences/context";
import { useLocalDocuments } from "./useLocalDocuments";

describe("useLocalDocuments", () => {
  let current: ModelState;
  const clearHistory = vi.fn();
  const reportError = vi.fn();
  const reportFeedback = vi.fn();
  const replaceModel = vi.fn((state: ModelState) => {
    current = state;
  });

  function renderSession() {
    return renderHook(() =>
      useLocalDocuments({
        getModel: () => current,
        replaceModel,
        clearHistory,
        reportError,
        reportFeedback,
      }),
    );
  }

  beforeEach(() => {
    current = createSample("2026-11-11T10:00:00.000Z");
    files.available = true;
    files.recentName.mockResolvedValue("diagram.peercanvas");
    files.loadRecent.mockReset();
    files.open.mockReset();
    files.acceptOpen.mockReset().mockResolvedValue(true);
    files.discardOpen.mockReset().mockResolvedValue(undefined);
    files.save.mockReset().mockResolvedValue({
      displayName: "diagram.peercanvas",
      warning: null,
      recentUpdated: true,
    });
    files.importDrawio.mockReset();
    files.prepareDrawioExport.mockReset();
    files.exportDrawio.mockReset();
    files.discardDrawioExport.mockReset().mockResolvedValue(undefined);
    files.close.mockReset().mockResolvedValue(undefined);
    windowState.onClose = undefined;
    windowState.close.mockReset().mockResolvedValue(undefined);
    eventState.onQuit = undefined;
    eventState.unlisten.mockReset();
    eventState.listen.mockReset().mockImplementation((_, handler: () => void) => {
      eventState.onQuit = handler;
      return Promise.resolve(eventState.unlisten);
    });
    appState.invoke.mockReset().mockResolvedValue(undefined);
    clearHistory.mockReset();
    reportError.mockReset();
    reportFeedback.mockReset();
    replaceModel.mockClear();
  });

  it("adapts save and draw.io export locales to their native command arguments", async () => {
    const { localDocumentFiles: nativeFiles } =
      await vi.importActual<typeof import("./local-document-files")>("./local-document-files");
    appState.invoke.mockClear();

    await nativeFiles.save('{"schemaVersion":2}', false, "es");
    await nativeFiles.exportDrawio("export-1", true, "en");

    expect(appState.invoke.mock.calls).toEqual([
      ["save_document", { contents: '{"schemaVersion":2}', saveAs: false, locale: "es" }],
      ["export_drawio", { token: "export-1", confirmLosses: true, locale: "en" }],
    ]);
  });

  it("keeps a dirty document open when replacement is canceled", () => {
    const { result } = renderSession();

    expect(result.current.isEditingLocked()).toBe(false);
    act(() => {
      result.current.closeDocument();
      expect(result.current.isEditingLocked()).toBe(true);
    });
    expect(result.current.pendingAction).toBe("close");
    act(() => result.current.cancelReplacement());

    expect(result.current.dirty).toBe(true);
    expect(result.current.pendingAction).toBeNull();
    expect(result.current.isEditingLocked()).toBe(false);
    expect(files.close).not.toHaveBeenCalled();
    expect(replaceModel).not.toHaveBeenCalled();
  });

  it("closes a dirty document only after the user discards it", async () => {
    const { result } = renderSession();

    act(() => result.current.closeDocument());
    await act(async () => result.current.discardAndContinue());
    await waitFor(() => expect(files.close).toHaveBeenCalledOnce());

    expect(clearHistory).toHaveBeenCalledOnce();
    expect(current.document.metadata.title).toBe("Untitled diagram");
    expect(result.current.dirty).toBe(false);
  });

  it("validates an opened document before replacing the current model", async () => {
    const opened = createSample("2026-11-11T10:01:00.000Z");
    const serialized = serializeDocument(opened.document);
    if (!serialized.ok) throw new Error("Sample document did not serialize.");
    files.open.mockResolvedValue({
      token: "candidate-1",
      displayName: "opened.peercanvas",
      primaryText: serialized.value,
      backupText: null,
    });
    const { result } = renderSession();
    const originalDocument = current.document;

    act(() => result.current.openDocument());
    await act(async () => result.current.discardAndContinue());
    await waitFor(() => expect(files.acceptOpen).toHaveBeenCalledWith("candidate-1", "primary"));

    expect(current.document).toEqual(opened.document);
    expect(current.document).not.toBe(originalDocument);
    expect(current.revision).toBe(0);
    expect(result.current.fileName).toBe("opened.peercanvas");
    expect(result.current.dirty).toBe(false);
    expect(clearHistory).toHaveBeenCalledOnce();
  });

  it("does not advertise a stale Reopen last preference after an update fails", async () => {
    const opened = createSample("2026-11-11T10:01:00.000Z");
    const serialized = serializeDocument(opened.document);
    if (!serialized.ok) throw new Error("Sample document did not serialize.");
    files.open.mockResolvedValue({
      token: "candidate-1",
      displayName: "opened.peercanvas",
      primaryText: serialized.value,
      backupText: null,
    });
    files.acceptOpen.mockResolvedValue(false);
    const { result } = renderSession();

    act(() => result.current.openDocument());
    await act(async () => result.current.discardAndContinue());

    expect(result.current.fileName).toBe("opened.peercanvas");
    expect(result.current.recentName).toBeNull();
    expect(reportError).toHaveBeenCalledWith({
      kind: "text",
      key: "documents.errors.recentNotUpdated",
      params: undefined,
    });

    const warning = { code: "file.directoryNotDurable", params: {} };
    files.save.mockResolvedValue({
      displayName: "opened.peercanvas",
      warning,
      recentUpdated: false,
    });
    await act(async () => result.current.saveDocument());

    expect(result.current.recentName).toBeNull();
    expect(reportError).toHaveBeenLastCalledWith({ kind: "native", message: warning });
  });

  it("never forwards unstructured native or exception text", async () => {
    files.save.mockResolvedValue({
      displayName: "diagram.peercanvas",
      warning: "/Users/private/raw native text",
      recentUpdated: true,
    });
    const { result } = renderSession();
    await act(async () => result.current.saveDocument());
    expect(reportError).toHaveBeenLastCalledWith({
      kind: "text",
      key: "documents.errors.warning",
      params: undefined,
    });

    files.save.mockRejectedValue(new Error("EACCES: /Users/private/diagram.peercanvas"));
    await act(async () => result.current.saveDocument());
    expect(reportError).toHaveBeenLastCalledWith({
      kind: "text",
      key: "documents.errors.unexpected",
      params: undefined,
    });
    expect(JSON.stringify(reportError.mock.calls)).not.toContain("/Users/private");
  });

  it("saves, closes, and reopens the same model through the last-file path", async () => {
    const savedDocument = current.document;
    const serialized = serializeDocument(savedDocument);
    if (!serialized.ok) throw new Error("Sample document did not serialize.");
    files.loadRecent.mockResolvedValue({
      token: "last-file",
      displayName: "architecture.peercanvas",
      primaryText: serialized.value,
      backupText: null,
    });
    const { result } = renderSession();

    await act(async () => {
      await result.current.saveDocument();
    });
    expect(result.current.dirty).toBe(false);
    expect(result.current.fileName).toBe("diagram.peercanvas");

    act(() => result.current.closeDocument());
    await waitFor(() => expect(current.document.metadata.title).toBe("Untitled diagram"));
    act(() => result.current.reopenLast());
    await waitFor(() => expect(files.acceptOpen).toHaveBeenCalledWith("last-file", "primary"));

    expect(current.document).toEqual(savedDocument);
    expect(current.revision).toBe(0);
    expect(result.current.fileName).toBe("architecture.peercanvas");
    expect(result.current.dirty).toBe(false);
  });

  it("offers a valid backup and opens it as an unsaved copy", async () => {
    const backup = createSample("2026-11-11T10:02:00.000Z");
    const serialized = serializeDocument(backup.document);
    if (!serialized.ok) throw new Error("Backup document did not serialize.");
    files.open.mockResolvedValue({
      token: "candidate-2",
      displayName: "damaged.peercanvas",
      primaryText: "{bad json",
      backupText: serialized.value,
    });
    const { result } = renderSession();
    act(() => result.current.newDocument());
    await act(async () => result.current.discardAndContinue());
    await waitFor(() => expect(result.current.dirty).toBe(false));
    const currentId = current.document.documentId;
    act(() => result.current.openDocument());
    await waitFor(() => expect(result.current.recovery).not.toBeNull());
    expect(current.document.documentId).toBe(currentId);
    expect(result.current.busy).toBe(false);
    expect(result.current.isEditingLocked()).toBe(true);

    await act(async () => result.current.recoverBackup());

    expect(files.acceptOpen).toHaveBeenCalledWith("candidate-2", "backup");
    expect(current.document).toEqual(backup.document);
    expect(result.current.dirty).toBe(true);
    expect(result.current.recovered).toBe(true);
    expect(result.current.fileName).toBeNull();
    expect(result.current.isEditingLocked()).toBe(false);
  });

  it("does not mark a later edit as saved when a save finishes", async () => {
    let finishSave:
      ((value: { displayName: string; warning: null; recentUpdated: true }) => void) | undefined;
    files.save.mockReturnValue(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );
    const { result } = renderSession();
    act(() => result.current.newDocument());
    await act(async () => result.current.discardAndContinue());
    await waitFor(() => expect(result.current.dirty).toBe(false));
    act(() => result.current.markDirty());

    let saving!: Promise<unknown>;
    act(() => {
      saving = result.current.saveDocument();
    });
    current = { ...current, revision: current.revision + 1 };
    act(() => result.current.markDirty());
    await act(async () => {
      finishSave?.({
        displayName: "diagram.peercanvas",
        warning: null,
        recentUpdated: true,
      });
      await saving;
    });

    expect(result.current.dirty).toBe(true);
    expect(result.current.fileName).toBe("diagram.peercanvas");
  });

  it("passes the live Spanish interface language to native save", async () => {
    const { result } = renderHook(
      () =>
        useLocalDocuments({
          getModel: () => current,
          replaceModel,
          clearHistory,
          reportError,
          reportFeedback,
        }),
      {
        wrapper: ({ children }) => (
          <PreferencesContext.Provider value={{ ...fallbackPreferences, locale: "es" }}>
            {children}
          </PreferencesContext.Provider>
        ),
      },
    );

    await act(async () => result.current.saveDocument());

    expect(files.save).toHaveBeenCalledWith(expect.any(String), false, "es");
  });

  it("keeps the replacement prompt open when saving fails", async () => {
    const denied = { code: "file.permissionDenied", params: {} };
    files.save.mockRejectedValue(denied);
    const { result } = renderSession();

    act(() => result.current.closeDocument());
    await act(async () => result.current.saveAndContinue());

    expect(result.current.pendingAction).toBe("close");
    expect(result.current.dirty).toBe(true);
    expect(result.current.promptError).toEqual({ kind: "native", message: denied });
    expect(files.close).not.toHaveBeenCalled();
  });

  it("keeps the replacement prompt open with a reason when Save is canceled", async () => {
    files.save.mockResolvedValue(null);
    const { result } = renderSession();

    act(() => result.current.openDocument());
    await act(async () => result.current.saveAndContinue());

    expect(result.current.pendingAction).toBe("open");
    expect(result.current.promptError).toEqual({
      kind: "text",
      key: "documents.errors.saveCanceled",
      params: undefined,
    });
    expect(files.open).not.toHaveBeenCalled();
  });

  it("explains an unreadable file with the validation reason before offering its backup", async () => {
    const backup = createSample("2026-11-11T10:02:00.000Z");
    const serialized = serializeDocument(backup.document);
    if (!serialized.ok) throw new Error("Backup document did not serialize.");
    files.open.mockResolvedValue({
      token: "candidate-3",
      displayName: "damaged.peercanvas",
      primaryText: "{bad json",
      backupText: serialized.value,
    });
    const { result } = renderSession();
    act(() => result.current.openDocument());
    await act(async () => result.current.discardAndContinue());
    await waitFor(() => expect(result.current.recovery).not.toBeNull());

    const reported = reportError.mock.calls.at(-1)![0];
    expect(reported.kind).toBe("list");
    expect(reported.items[0]).toMatchObject({ kind: "diagnostics" });
    expect(reported.items[0].diagnostics[0].code).toBe("INVALID_JSON");
    expect(reported.items[1]).toMatchObject({ key: "documents.errors.backupAvailable" });
  });

  it("intercepts native window close and waits for the unsaved-change choice", async () => {
    const { result } = renderSession();
    await waitFor(() => expect(windowState.onClose).toBeTruthy());
    const preventDefault = vi.fn();

    act(() => windowState.onClose?.({ preventDefault }));

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(result.current.pendingAction).toBe("quit");
    await act(async () => result.current.discardAndContinue());
    await waitFor(() => expect(windowState.close).toHaveBeenCalledOnce());
  });

  it("keeps editing locked until native close finishes or fails", async () => {
    let failClose!: (error: Error) => void;
    windowState.close.mockReturnValue(new Promise((_, reject) => (failClose = reject)));
    const { result } = renderSession();
    await waitFor(() => expect(windowState.onClose).toBeTruthy());
    act(() => windowState.onClose?.({ preventDefault: vi.fn() }));
    act(() => result.current.discardAndContinue());
    expect(result.current.isEditingLocked()).toBe(true);
    await act(async () => failClose(new Error("Close failed.")));
    expect(result.current.isEditingLocked()).toBe(false);
    expect(reportError).toHaveBeenCalledWith({
      kind: "text",
      key: "documents.errors.unexpected",
      params: undefined,
    });
  });

  it("protects app-menu quit with the unsaved-change decision and removes its listener", async () => {
    const { result, unmount } = renderSession();
    await waitFor(() => expect(eventState.onQuit).toBeTruthy());
    expect(eventState.listen).toHaveBeenCalledWith(
      "peercanvas-quit-requested",
      expect.any(Function),
    );
    act(() => eventState.onQuit?.());
    expect(result.current.pendingAction).toBe("quit-app");
    act(() => result.current.cancelReplacement());
    expect(appState.invoke).not.toHaveBeenCalled();
    expect(windowState.close).not.toHaveBeenCalled();
    act(() => eventState.onQuit?.());
    act(() => result.current.discardAndContinue());
    await waitFor(() => expect(appState.invoke).toHaveBeenCalledWith("quit_application"));
    expect(windowState.close).not.toHaveBeenCalled();
    unmount();
    expect(eventState.unlisten).toHaveBeenCalledOnce();
  });

  it("removes a menu listener that finishes registering after unmount", async () => {
    let finishListening!: (stop: () => void) => void;
    eventState.listen.mockReturnValue(new Promise((resolve) => (finishListening = resolve)));
    const { unmount } = renderSession();
    unmount();
    await act(async () => finishListening(eventState.unlisten));
    expect(eventState.unlisten).toHaveBeenCalledOnce();
  });

  it("stages a draw.io import for review before replacing the active document", async () => {
    const original = current.document;
    const imported = createSample("2026-11-11T10:05:00.000Z");
    const element = { code: "drawio.unsupportedElement", params: { name: "custom" } };
    files.importDrawio.mockResolvedValue({
      displayName: "import.drawio",
      document: imported.document,
      // A legacy string entry is kept as a generic loss so the review stays complete.
      losses: [element, "Legacy native text"],
      preservedFragmentCount: 1,
    });
    const { result } = renderSession();

    act(() => result.current.importDrawio());
    expect(result.current.pendingAction).toBe("import");
    await act(async () => result.current.discardAndContinue());

    await waitFor(() => expect(result.current.drawioImport?.displayName).toBe("import.drawio"));
    expect(current.document).toBe(original);
    expect(result.current.isEditingLocked()).toBe(true);
    expect(result.current.drawioImport?.losses).toEqual([
      { kind: "native", message: element },
      { kind: "text", key: "documents.drawio.unknownLoss", params: undefined },
    ]);
    act(() => result.current.acceptDrawioImport());

    expect(current.document).toEqual(imported.document);
    expect(result.current.fileName).toBeNull();
    expect(result.current.dirty).toBe(true);
    expect(result.current.drawioImport).toBeNull();
  });

  it("keeps the active document when draw.io import review is canceled or invalid", async () => {
    const original = current.document;
    const imported = createSample("2026-11-11T10:06:00.000Z");
    files.importDrawio.mockResolvedValue({
      displayName: "import.drawio",
      document: imported.document,
      losses: [],
      preservedFragmentCount: 0,
    });
    const { result } = renderSession();

    act(() => result.current.importDrawio());
    await act(async () => result.current.discardAndContinue());
    await waitFor(() => expect(result.current.drawioImport).not.toBeNull());
    act(() => result.current.cancelDrawioImport());
    expect(current.document).toBe(original);
    expect(result.current.isEditingLocked()).toBe(false);

    files.importDrawio.mockResolvedValue({
      displayName: "invalid.drawio",
      document: { schemaVersion: 2 },
      losses: [],
      preservedFragmentCount: 0,
    });
    act(() => result.current.importDrawio());
    await act(async () => result.current.discardAndContinue());
    await waitFor(() => expect(reportError).toHaveBeenCalled());
    expect(current.document).toBe(original);
    expect(result.current.drawioImport).toBeNull();
  });

  it("holds an export snapshot for review and requires explicit loss confirmation", async () => {
    files.prepareDrawioExport.mockResolvedValue({
      token: "export-1",
      losses: [{ code: "drawio.preservedCellOmitted", params: {} }],
      preservedFragmentCount: 1,
    });
    files.exportDrawio.mockResolvedValue({ displayName: "diagram.drawio", warning: null });
    const { result } = renderSession();

    await act(async () => result.current.prepareDrawioExport());
    expect(result.current.drawioExport?.token).toBe("export-1");
    expect(result.current.isEditingLocked()).toBe(true);
    expect(files.prepareDrawioExport).toHaveBeenCalledWith(
      expect.stringContaining('"schemaVersion": 2'),
    );
    await act(async () => result.current.confirmDrawioExport());

    // The native overwrite confirmation receives the resolved interface language.
    expect(files.exportDrawio).toHaveBeenCalledWith("export-1", true, "en");
    expect(result.current.drawioExport).toBeNull();
    expect(result.current.isEditingLocked()).toBe(false);
    expect(reportFeedback).toHaveBeenCalledWith({
      kind: "text",
      key: "documents.feedback.exported",
      params: { name: "diagram.drawio" },
    });
  });

  it("passes the live Spanish interface language to the native export", async () => {
    files.prepareDrawioExport.mockResolvedValue({
      token: "export-es",
      losses: [],
      preservedFragmentCount: 0,
    });
    files.exportDrawio.mockResolvedValue(null);
    const { result } = renderHook(
      () =>
        useLocalDocuments({
          getModel: () => current,
          replaceModel,
          clearHistory,
          reportError,
          reportFeedback,
        }),
      {
        wrapper: ({ children }) => (
          <PreferencesContext.Provider value={{ ...fallbackPreferences, locale: "es" }}>
            {children}
          </PreferencesContext.Provider>
        ),
      },
    );

    await act(async () => result.current.prepareDrawioExport());
    await act(async () => result.current.confirmDrawioExport());

    expect(files.exportDrawio).toHaveBeenCalledWith("export-es", false, "es");
  });

  it("discards an export review without writing a file", async () => {
    files.prepareDrawioExport.mockResolvedValue({
      token: "export-2",
      losses: [],
      preservedFragmentCount: 0,
    });
    const { result } = renderSession();

    await act(async () => result.current.prepareDrawioExport());
    await act(async () => result.current.cancelDrawioExport());

    expect(files.discardDrawioExport).toHaveBeenCalledWith("export-2");
    expect(files.exportDrawio).not.toHaveBeenCalled();
    expect(result.current.drawioExport).toBeNull();
    expect(result.current.isEditingLocked()).toBe(false);
  });
});
