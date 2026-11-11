import {
  createDocument,
  executeCommand,
  type Document as DiagramDocument,
  type ModelState,
  type Node as DiagramNode,
  type Page,
  type Layer,
} from "../../document";

export type Fixture = "empty" | "diagram" | "collaboration" | "proposal";
export type Scenario = "success" | "wait" | "cancel" | "error";
type Origin = "ui" | "assistant" | "mcp" | "import" | "history";
type OperationKind = "import" | "export" | "assistant" | "mcp" | "save" | "open";
type Decision = "discard" | "save";
type Command = Record<string, unknown>;
export interface DemoState {
  fixture: Fixture;
  scenario: Scenario;
  document: DiagramDocument | null;
  revision: number;
  savedRevision: number | null;
  filename: string | null;
  selection: string | null;
  pageId: string | null;
  layerId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  history: Array<{ id: string; label: string; origin: string }>;
  notice: { kind: "info" | "error" | "success"; message: string } | null;
  needsDecision: boolean;
  operation: {
    kind: OperationKind;
    status: "running" | "waiting" | "error" | "cancelled" | "done";
    progress: number;
    message: string;
  } | null;
  proposal: {
    id: string;
    status: "pending" | "approved" | "rejected" | "stale";
    title: string;
    description: string;
    changes: string[];
    source: "assistant" | "mcp" | "import";
  } | null;
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    text: string;
    source: "assistant" | "mcp";
  }>;
  participants: Array<{
    id: string;
    name: string;
    role: "host" | "editor" | "viewer";
    status: "connected" | "disconnected" | "pending";
  }>;
  role: "editor" | "viewer";
  connected: boolean;
  invitation: string | null;
  recovery: Array<{ id: string; title: string; description: string }>;
}
interface HistoryEntry {
  forward: Command[];
  inverse: Command[];
  label: string;
}
const NOW = "2026-11-10T12:00:00.000Z";
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const titles: Record<Fixture, string> = {
  empty: "Untitled diagram",
  diagram: "Product architecture",
  collaboration: "Team workspace",
  proposal: "Service blueprint",
};
function makeFixture(fixture: Fixture): ModelState {
  const created = createDocument({
    documentId: id(1),
    pageId: id(2),
    layerId: id(3),
    title: titles[fixture],
    now: NOW,
  });
  if (!created.ok) throw new Error("Invalid built-in empty fixture");
  if (fixture === "empty") return created.value;
  const styles = [
    {
      styleId: id(10),
      fill: "#e8efff",
      stroke: "#3155b7",
      strokeWidth: 2,
      textColor: "#182646",
      fontSize: 16,
    },
    {
      styleId: id(11),
      fill: "#e0f6ee",
      stroke: "#28765d",
      strokeWidth: 2,
      textColor: "#183d31",
      fontSize: 16,
    },
  ];
  const node = (n: number, text: string, x: number, y: number, style = id(10)): DiagramNode => ({
    nodeId: id(n),
    type: "rectangle",
    geometry: { x, y, width: 180, height: 90, rotation: 0 },
    text,
    styleId: style,
  });
  const nodes = [
    node(20, "Web client", 100, 160),
    node(21, "API gateway", 390, 160),
    node(22, "Document service", 680, 80, id(11)),
    node(23, "Local workspace", 680, 260, id(11)),
  ];
  const commands: Command[] = [
    ...styles.map((style) => ({ type: "style.put", style })),
    ...nodes.map((value, index) => ({
      type: "node.add",
      pageId: id(2),
      layerId: id(3),
      node: value,
      index,
    })),
    ...[
      [20, 21],
      [21, 22],
      [21, 23],
    ].map(([source, target], index) => ({
      type: "connection.add",
      pageId: id(2),
      layerId: id(3),
      connection: {
        connectionId: id(30 + index),
        sourceNodeId: id(source),
        targetNodeId: id(target),
        routing: "straight",
        label: "",
        styleId: null,
      },
      index,
    })),
    { type: "layer.rename", pageId: id(2), layerId: id(3), name: "Architecture" },
    {
      type: "layer.add",
      pageId: id(2),
      index: 1,
      layer: { layerId: id(4), name: "Annotations", nodes: [], connections: [] },
    },
    { type: "page.rename", pageId: id(2), name: "System overview" },
    {
      type: "page.add",
      index: 1,
      page: {
        pageId: id(5),
        name: "Data flow",
        layers: [
          {
            layerId: id(6),
            name: "Main",
            nodes: [node(24, "Input", 180, 180), node(25, "Output", 500, 180, id(11))],
            connections: [
              {
                connectionId: id(33),
                sourceNodeId: id(24),
                targetNodeId: id(25),
                routing: "straight",
                label: "Validated commands",
                styleId: null,
              },
            ],
          },
        ],
      },
    },
  ];
  const result = executeCommand(
    created.value,
    { type: "batch", commands },
    { expectedRevision: 0, now: NOW },
  );
  if (!result.ok) throw new Error("Invalid built-in diagram fixture");
  return { document: result.value.state.document, revision: 0 };
}
function immutable<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(immutable);
    Object.freeze(value);
  }
  return value;
}
function initial(fixture: Fixture = "diagram"): DemoState {
  return {
    fixture,
    scenario: "success",
    document: null,
    revision: 0,
    savedRevision: null,
    filename: null,
    selection: null,
    pageId: null,
    layerId: null,
    canUndo: false,
    canRedo: false,
    history: [],
    notice: null,
    needsDecision: false,
    operation: null,
    proposal: null,
    messages: [],
    role: "editor",
    connected: true,
    invitation: null,
    participants: [
      { id: "host", name: "You", role: "host", status: "connected" },
      { id: "alex", name: "Alex Rivera", role: "editor", status: "connected" },
      { id: "sam", name: "Sam Chen", role: "viewer", status: "pending" },
    ],
    recovery: [
      {
        id: "recovery-architecture",
        title: "Product architecture",
        description: "Simulated checkpoint · 2 minutes ago · 4 shapes",
      },
      {
        id: "recovery-empty",
        title: "Untitled diagram",
        description: "Simulated checkpoint · 12 minutes ago · empty document",
      },
    ],
  };
}

function actionLabel(command: Command): string {
  if (command.type === "batch") {
    const commands = command.commands as Command[];
    if (commands.length === 1) return actionLabel(commands[0]);
    if (commands.some((child) => child.type === "node.update")) return "Update shape";
    return "Apply diagram changes";
  }
  const labels: Record<string, string> = {
    "document.setMetadata": "Rename document",
    "page.add": "Add page",
    "page.remove": "Remove page",
    "page.rename": "Rename page",
    "page.reorder": "Reorder pages",
    "layer.add": "Add layer",
    "layer.remove": "Remove layer",
    "layer.rename": "Rename layer",
    "layer.reorder": "Reorder layers",
    "node.add": "Add shape",
    "node.update": "Update shape",
    "node.remove": "Remove shape",
    "connection.add": "Connect shapes",
    "connection.update": "Update connector",
    "connection.remove": "Remove connector",
    "style.put": "Update style",
    "style.remove": "Remove style",
  };
  return labels[String(command.type)] ?? "Apply diagram changes";
}

/** One authoritative model state; views, history commands and operations are transient. */
export function createDemoService() {
  let state = immutable(initial());
  const listeners = new Set<() => void>();
  let nextId = 100;
  let sequence = 0;
  let generation = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let settle: ((success: boolean) => void) | null = null;
  let waiting: (() => void) | null = null;
  let pendingReplacement: (() => Promise<void>) | null = null;
  let undoStack: HistoryEntry[] = [];
  let redoStack: HistoryEntry[] = [];
  let proposalCommands: Command[] = [];
  let proposalRevision = -1;
  let proposalDocument: string | null = null;
  const publish = (patch: Partial<DemoState>) => {
    state = immutable({ ...state, ...patch });
    listeners.forEach((listener) => listener());
  };
  const notice = (message: string, kind: "info" | "error" | "success" = "info") =>
    publish({ notice: { kind, message } });
  const dirty = () => !!state.document && state.savedRevision !== state.revision;
  const page = () => state.document?.pages.find((p) => p.pageId === state.pageId);
  const layer = () => page()?.layers.find((l) => l.layerId === state.layerId);
  const selected = () =>
    page()
      ?.layers.flatMap((l) => l.nodes)
      .find((n) => n.nodeId === state.selection);
  const clearPending = () => {
    timers.forEach(clearTimeout);
    timers = [];
    waiting = null;
    const resolve = settle;
    settle = null;
    resolve?.(false);
  };
  function run(kind: OperationKind, onSuccess: () => void): Promise<boolean> {
    if (settle) {
      notice("A simulated operation is already pending. Cancel it first.", "error");
      return Promise.resolve(false);
    }
    const token = generation;
    const scenario = state.scenario;
    return new Promise((resolve) => {
      settle = resolve;
      publish({
        operation: { kind, status: "running", progress: 15, message: `Simulating ${kind}…` },
      });
      const finish = () => {
        if (token !== generation || !settle) return;
        const done = settle;
        settle = null;
        waiting = null;
        timers.forEach(clearTimeout);
        timers = [];
        if (scenario === "cancel") {
          publish({
            operation: {
              kind,
              status: "cancelled",
              progress: 0,
              message: "Simulated cancellation. Document unchanged.",
            },
          });
          done(false);
          return;
        }
        if (scenario === "error") {
          publish({
            operation: {
              kind,
              status: "error",
              progress: 45,
              message: `Simulated ${kind} error. Retry or select another scenario.`,
            },
          });
          notice(`Simulated ${kind} failed. Your document is unchanged.`, "error");
          done(false);
          return;
        }
        onSuccess();
        publish({
          operation: {
            kind,
            status: "done",
            progress: 100,
            message: `Simulated ${kind} complete. No file or external service was accessed.`,
          },
        });
        done(true);
      };
      if (scenario === "wait") {
        waiting = finish;
        publish({
          operation: {
            kind,
            status: "waiting",
            progress: 35,
            message: "Simulated wait. Complete or cancel this operation.",
          },
        });
      } else timers.push(setTimeout(finish, 360));
    });
  }
  function historyFlags() {
    return { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
  }
  function inverseFor(command: Command, document: DiagramDocument): Command[] {
    const type = String(command.type);
    const p = document.pages.find((value) => value.pageId === command.pageId);
    const l = p?.layers.find((value) => value.layerId === command.layerId);
    switch (type) {
      case "document.setMetadata":
        return [
          { type, title: document.metadata.title, description: document.metadata.description },
        ];
      case "page.reorder":
        return [{ type, pageIds: document.pages.map((p) => p.pageId) }];
      case "layer.reorder":
        return p ? [{ type, pageId: p.pageId, layerIds: p.layers.map((l) => l.layerId) }] : [];
      case "page.add":
        return [{ type: "page.remove", pageId: (command.page as Page).pageId }];
      case "page.remove":
        return p ? [{ type: "page.add", page: p, index: document.pages.indexOf(p) }] : [];
      case "page.rename":
        return p ? [{ type, pageId: p.pageId, name: p.name }] : [];
      case "layer.add":
        return [
          {
            type: "layer.remove",
            pageId: command.pageId,
            layerId: (command.layer as Layer).layerId,
          },
        ];
      case "layer.remove": {
        if (!p || !l) return [];
        const removed = new Set(l.nodes.map((n) => n.nodeId));
        return [
          { type: "layer.add", pageId: p.pageId, layer: l, index: p.layers.indexOf(l) },
          ...p.layers
            .filter((other) => other !== l)
            .flatMap((other) =>
              other.connections.flatMap((connection, index) =>
                removed.has(connection.sourceNodeId) || removed.has(connection.targetNodeId)
                  ? [
                      {
                        type: "connection.add",
                        pageId: p.pageId,
                        layerId: other.layerId,
                        connection,
                        index,
                      },
                    ]
                  : [],
              ),
            ),
        ];
      }
      case "layer.rename":
        return l ? [{ type, pageId: command.pageId, layerId: l.layerId, name: l.name }] : [];
      case "node.add":
        return [
          {
            type: "node.remove",
            pageId: command.pageId,
            layerId: command.layerId,
            nodeId: (command.node as DiagramNode).nodeId,
          },
        ];
      case "node.update": {
        const node = l?.nodes.find((n) => n.nodeId === (command.node as DiagramNode).nodeId);
        return node ? [{ type, pageId: command.pageId, layerId: command.layerId, node }] : [];
      }
      case "node.remove": {
        const node = l?.nodes.find((n) => n.nodeId === command.nodeId);
        if (!p || !l || !node) return [];
        return [
          {
            type: "node.add",
            pageId: p.pageId,
            layerId: l.layerId,
            node,
            index: l.nodes.indexOf(node),
          },
          ...p.layers.flatMap((owner) =>
            owner.connections.flatMap((connection, index) =>
              connection.sourceNodeId === node.nodeId || connection.targetNodeId === node.nodeId
                ? [
                    {
                      type: "connection.add",
                      pageId: p.pageId,
                      layerId: owner.layerId,
                      connection,
                      index,
                    },
                  ]
                : [],
            ),
          ),
        ];
      }
      case "connection.add":
        return [
          {
            type: "connection.remove",
            pageId: command.pageId,
            layerId: command.layerId,
            connectionId: (command.connection as { connectionId: string }).connectionId,
          },
        ];
      case "connection.update": {
        const connection = l?.connections.find(
          (c) => c.connectionId === (command.connection as { connectionId: string }).connectionId,
        );
        return connection
          ? [{ type, pageId: command.pageId, layerId: command.layerId, connection }]
          : [];
      }
      case "connection.remove": {
        const connection = l?.connections.find((c) => c.connectionId === command.connectionId);
        return connection && l
          ? [
              {
                type: "connection.add",
                pageId: command.pageId,
                layerId: command.layerId,
                connection,
                index: l.connections.indexOf(connection),
              },
            ]
          : [];
      }
      case "style.put": {
        const style = command.style as { styleId: string };
        const old = document.styles.find((s) => s.styleId === style.styleId);
        return old ? [{ type, style: old }] : [{ type: "style.remove", styleId: style.styleId }];
      }
      default:
        return [];
    }
  }
  function apply(command: unknown, origin: Origin = "ui", track = true): boolean {
    if (!state.document) {
      notice("Open a demo document first.", "error");
      return false;
    }
    if (state.role === "viewer") {
      notice(
        "Viewer permission: document changes are rejected by the simulated service boundary.",
        "error",
      );
      return false;
    }
    const before = state.document;
    const result = executeCommand({ document: before, revision: state.revision }, command, {
      expectedRevision: state.revision,
      now: NOW,
    });
    if (!result.ok) {
      notice(result.errors.map((error) => `${error.code}: ${error.message}`).join(" · "), "error");
      return false;
    }
    if (!result.value.changed) return true;
    // The accepted payload is JSON data. History must not retain caller-owned
    // mutable objects that could change what a later redo executes.
    const raw = immutable(JSON.parse(JSON.stringify(command)) as Command);
    if (track) {
      const forward = raw.type === "batch" ? (raw.commands as Command[]) : [raw];
      let candidate: ModelState = { document: before, revision: state.revision };
      let inverse: Command[] = [];
      let reversible = true;
      for (const child of forward) {
        const childInverse = inverseFor(child, candidate.document);
        if (!childInverse.length) reversible = false;
        inverse = [...childInverse, ...inverse];
        const step = executeCommand(candidate, child, {
          expectedRevision: candidate.revision,
          now: NOW,
        });
        if (step.ok) candidate = step.value.state;
      }
      // Only expose undo for actions for which the service has a complete inverse.
      if (reversible && inverse.length)
        undoStack.push({ forward, inverse, label: actionLabel(raw) });
      else undoStack = [];
      redoStack = [];
    }
    const doc = result.value.state.document;
    const activePage = doc.pages.find((p) => p.pageId === state.pageId) ?? doc.pages[0];
    const activeLayer =
      activePage.layers.find((l) => l.layerId === state.layerId) ?? activePage.layers[0];
    const selection = activePage.layers.some((l) =>
      l.nodes.some((n) => n.nodeId === state.selection),
    )
      ? state.selection
      : null;
    publish({
      document: doc,
      revision: result.value.state.revision,
      pageId: activePage.pageId,
      layerId: activeLayer.layerId,
      selection,
      ...historyFlags(),
      history: [...state.history, { id: `action-${++sequence}`, label: actionLabel(raw), origin }],
      proposal:
        state.proposal?.status === "pending"
          ? { ...state.proposal, status: "stale" }
          : state.proposal,
    });
    notice("Diagram updated in memory. Nothing was saved or sent.", "success");
    return true;
  }
  function activate(model: ModelState, fixture: Fixture, recovered = false) {
    undoStack = [];
    redoStack = [];
    proposalCommands = [];
    const p = model.document.pages[0];
    publish({
      document: model.document,
      revision: model.revision,
      savedRevision: recovered || fixture === "empty" ? null : model.revision,
      filename: recovered || fixture === "empty" ? null : `${titles[fixture]}.peercanvas`,
      fixture,
      pageId: p.pageId,
      layerId: p.layers[0].layerId,
      selection: null,
      needsDecision: false,
      history: [],
      canUndo: false,
      canRedo: false,
      proposal: null,
      messages: [],
    });
    if (fixture === "proposal") propose("assistant");
  }
  async function saveOperation(): Promise<boolean> {
    if (!state.document) {
      notice("Open a demo document first.", "error");
      return false;
    }
    const capturedDocument = state.document.documentId;
    const capturedRevision = state.revision;
    const token = generation;
    return run("save", () => {
      if (token === generation && state.document?.documentId === capturedDocument) {
        publish({
          savedRevision: capturedRevision,
          filename: state.filename ?? `${state.document.metadata.title}.peercanvas`,
        });
        notice("Simulated save complete — no file was written.", "success");
      }
    });
  }
  async function save(): Promise<void> {
    await saveOperation();
  }
  async function replace(fixture: Fixture | null, decision?: Decision, recovered = false) {
    if (dirty() && !decision) {
      pendingReplacement = () => replace(fixture, "discard", recovered);
      publish({ needsDecision: true });
      return;
    }
    if (decision === "save") {
      const beforeSave = state.document;
      const revisionBeforeSave = state.revision;
      const tokenBeforeSave = generation;
      const saved = await saveOperation();
      if (
        !saved ||
        tokenBeforeSave !== generation ||
        state.document !== beforeSave ||
        state.revision !== revisionBeforeSave ||
        dirty()
      )
        return;
    }
    const staged = fixture ? makeFixture(fixture) : null;
    const before = state.document;
    const revision = state.revision;
    const token = generation;
    const success = await run("open", () => {
      if (token !== generation || state.document !== before || state.revision !== revision) {
        notice("Document changed while opening. Retry the simulated operation.", "error");
        return;
      }
      pendingReplacement = null;
      if (staged && fixture) activate(staged, fixture, recovered);
      else {
        undoStack = [];
        redoStack = [];
        publish({
          document: null,
          revision: 0,
          savedRevision: null,
          filename: null,
          selection: null,
          pageId: null,
          layerId: null,
          canUndo: false,
          canRedo: false,
          history: [],
          proposal: null,
          needsDecision: false,
        });
      }
    });
    if (!success) publish({ needsDecision: false });
  }
  function propose(source: "assistant" | "mcp" | "import") {
    if (!state.document || !page() || !layer()) {
      notice("Open a document before requesting a proposal.", "error");
      return;
    }
    const nodeId = id(nextId++);
    const node: DiagramNode = {
      nodeId,
      type: "rectangle",
      text: source === "import" ? "Imported service" : "Review queue",
      geometry: { x: 390, y: 370, width: 180, height: 90, rotation: 0 },
      styleId: null,
    };
    proposalCommands = [
      {
        type: "node.add",
        pageId: state.pageId,
        layerId: state.layerId,
        node,
        index: layer()!.nodes.length,
      },
    ];
    proposalRevision = state.revision;
    proposalDocument = state.document.documentId;
    publish({
      proposal: {
        id: `proposal-${++sequence}`,
        status: "pending",
        source,
        title: source === "import" ? "Simulated import preview" : "Add a review queue",
        description:
          source === "import"
            ? "Supported: one rectangle. Incompatible: custom stencil and embedded image omitted in this fictional example. No XML or file was read."
            : "A simulated suggestion. Inspect the change and explicitly approve it before it can affect the diagram.",
        changes: [
          `Add one rectangle: ${node.text}`,
          "Keep all existing pages and nodes",
          "No external service is contacted",
        ],
      },
    });
  }
  const service = {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    reset(fixture?: Fixture) {
      generation++;
      clearPending();
      nextId = 100;
      sequence = 0;
      undoStack = [];
      redoStack = [];
      proposalCommands = [];
      pendingReplacement = null;
      state = immutable(initial(fixture));
      if (fixture) activate(makeFixture(fixture), fixture);
      publish({ notice: { kind: "info", message: "Demo reset. All simulated changes cleared." } });
    },
    setScenario(scenario: Scenario) {
      publish({ scenario });
    },
    open: (fixture: Fixture, decision?: Decision) => replace(fixture, decision),
    newDocument: (decision?: Decision) => replace("empty", decision),
    close: (decision?: Decision) => replace(null, decision),
    save,
    rename(title: string) {
      apply({
        type: "document.setMetadata",
        title,
        description: state.document?.metadata.description ?? "",
      });
    },
    execute: (command: unknown) => {
      apply(command);
    },
    select(selection: string | null) {
      if (
        selection !== null &&
        !page()?.layers.some((l) => l.nodes.some((n) => n.nodeId === selection))
      ) {
        notice("That shape is not on the current page.", "error");
        return;
      }
      const owner = page()?.layers.find((l) => l.nodes.some((n) => n.nodeId === selection));
      publish({ selection, layerId: owner?.layerId ?? state.layerId });
    },
    setPage(pageId: string) {
      const p = state.document?.pages.find((p) => p.pageId === pageId);
      if (p) publish({ pageId, layerId: p.layers[0].layerId, selection: null });
    },
    setLayer(layerId: string) {
      if (page()?.layers.some((l) => l.layerId === layerId)) publish({ layerId, selection: null });
    },
    undo() {
      const entry = undoStack.at(-1);
      if (!entry) {
        notice("Nothing to undo.");
        return;
      }
      if (apply({ type: "batch", commands: entry.inverse }, "history", false)) {
        undoStack.pop();
        redoStack.push(entry);
        publish(historyFlags());
      }
    },
    redo() {
      const entry = redoStack.at(-1);
      if (!entry) {
        notice("Nothing to redo.");
        return;
      }
      if (apply({ type: "batch", commands: entry.forward }, "history", false)) {
        redoStack.pop();
        undoStack.push(entry);
        publish(historyFlags());
      }
    },
    startOperation(kind: "import" | "export" | "assistant" | "mcp") {
      if (!state.document) {
        notice("Open a demo document first.", "error");
        return;
      }
      const revision = state.revision;
      const documentId = state.document.documentId;
      void run(kind, () => {
        if (state.document?.documentId !== documentId || state.revision !== revision) {
          notice("Document changed. Request a new simulated result.", "error");
          return;
        }
        if (kind === "import" || kind === "assistant" || kind === "mcp") propose(kind);
        else
          notice(
            "Simulated export report: rectangles, text and straight connectors supported; custom stencils incompatible. No file was generated.",
            "success",
          );
      });
    },
    cancelOperation() {
      if (settle) {
        const kind = state.operation!.kind;
        clearPending();
        publish({
          operation: {
            kind,
            status: "cancelled",
            progress: 0,
            message: "Simulated operation cancelled. No pending result can apply.",
          },
        });
      }
      if (state.proposal?.status === "pending") {
        proposalCommands = [];
        publish({ proposal: { ...state.proposal, status: "rejected" } });
      }
      notice("Cancelled. The document is unchanged.");
    },
    finishWaiting() {
      waiting?.();
    },
    approveProposal() {
      const proposal = state.proposal;
      if (!proposal || proposal.status !== "pending") {
        notice("This proposal is no longer pending.", "error");
        return;
      }
      if (state.document?.documentId !== proposalDocument || state.revision !== proposalRevision) {
        publish({ proposal: { ...proposal, status: "stale" } });
        notice("The document changed. Request a fresh proposal.", "error");
        return;
      }
      if (apply({ type: "batch", commands: proposalCommands }, proposal.source)) {
        proposalCommands = [];
        publish({ proposal: { ...proposal, status: "approved" } });
      }
    },
    rejectProposal() {
      if (state.proposal?.status === "pending") {
        proposalCommands = [];
        publish({ proposal: { ...state.proposal, status: "rejected" } });
        notice("Proposal rejected. Document unchanged.");
      }
    },
    sendMessage(text: string, source: "assistant" | "mcp" = "assistant") {
      if (!text.trim()) return;
      const requestedRevision = state.revision;
      const requestedDocument = state.document;
      publish({
        messages: [
          ...state.messages,
          { id: `message-${++sequence}`, role: "user", text: text.slice(0, 4000), source },
        ],
      });
      void run(source, () => {
        if (state.revision !== requestedRevision || state.document !== requestedDocument) {
          notice(
            "Document changed during the simulated response. Request a fresh proposal.",
            "error",
          );
          return;
        }
        publish({
          messages: [
            ...state.messages,
            {
              id: `message-${++sequence}`,
              role: "assistant",
              text: "Simulated response: I suggest adding a review queue. No prompt or diagram data left this device. Review the proposal before applying it.",
              source,
            },
          ],
        });
        propose(source);
      });
    },
    setRole(role: "editor" | "viewer") {
      publish({ role });
      notice(`Simulated local role: ${role}.`);
    },
    admit(participantId: string, role: "editor" | "viewer") {
      publish({
        participants: state.participants.map((p) =>
          p.id === participantId && p.status === "pending"
            ? { ...p, role, status: "connected" }
            : p,
        ),
      });
      notice("Participant admitted to the simulated session.");
    },
    deny(participantId: string) {
      publish({
        participants: state.participants.filter(
          (p) => p.id !== participantId || p.status !== "pending",
        ),
      });
      notice("Simulated admission denied.");
    },
    revoke(participantId: string) {
      publish({
        participants: state.participants.filter((p) => p.id !== participantId || p.role === "host"),
      });
      notice("Simulated access revoked. Previously copied data cannot be erased.");
    },
    toggleConnection() {
      const connected = !state.connected;
      publish({
        connected,
        participants: state.participants.map((p) =>
          p.status === "pending" || p.role === "host"
            ? p
            : { ...p, status: connected ? "connected" : "disconnected" },
        ),
      });
      notice(
        connected
          ? "Simulated session reconnected."
          : "Simulated session disconnected. Local editing remains available.",
      );
    },
    invite() {
      publish({ invitation: "DEMO-INVITATION-NOT-A-REAL-LINK" });
      notice("Fictional invitation created. It cannot connect anyone.");
    },
    dismissNotice() {
      publish({ notice: null, needsDecision: false });
    },
    async resolveDecision(decision: "discard" | "save" | "cancel") {
      if (decision === "cancel") {
        pendingReplacement = null;
        publish({ needsDecision: false });
        return;
      }
      if (decision === "save") {
        const beforeSave = state.document;
        const revisionBeforeSave = state.revision;
        const tokenBeforeSave = generation;
        const saved = await saveOperation();
        if (
          !saved ||
          tokenBeforeSave !== generation ||
          state.document !== beforeSave ||
          state.revision !== revisionBeforeSave ||
          dirty()
        )
          return;
      }
      const pending = pendingReplacement;
      publish({ needsDecision: false });
      await pending?.();
    },
    recover(recoveryId: string, decision?: Decision) {
      if (!state.recovery.some((candidate) => candidate.id === recoveryId)) {
        notice("That simulated recovery candidate is unavailable.", "error");
        return Promise.resolve();
      }
      return replace(recoveryId === "recovery-empty" ? "empty" : "diagram", decision, true);
    },
    previewRecovery(recoveryId: string) {
      const candidate = state.recovery.find((c) => c.id === recoveryId);
      if (candidate)
        notice(
          `Simulated recovery preview: ${candidate.title}. ${candidate.description}. Explicit activation required; original fixture stays intact.`,
        );
    },
    addShape(type: "rectangle" | "text") {
      const l = layer();
      if (!l) {
        notice("Open a document first.", "error");
        return;
      }
      const nodeId = id(nextId++);
      const node: DiagramNode = {
        nodeId,
        type,
        text: type === "text" ? "Your text" : "New service",
        geometry: {
          x: 140 + l.nodes.length * 35,
          y: 160 + l.nodes.length * 30,
          width: 180,
          height: 90,
          rotation: 0,
        },
        styleId: null,
      };
      if (
        apply({
          type: "node.add",
          pageId: state.pageId,
          layerId: state.layerId,
          node,
          index: l.nodes.length,
        })
      )
        service.select(nodeId);
    },
    updateSelected(patch: {
      text?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      fill?: string;
    }) {
      const node = selected();
      const l = layer();
      if (!node || !l) {
        notice("Select a shape first.");
        return;
      }
      const geometry = { ...node.geometry };
      for (const key of ["x", "y", "width", "height"] as const)
        if (patch[key] !== undefined) geometry[key] = patch[key];
      const commands: Command[] = [];
      let styleId = node.styleId;
      if (patch.fill !== undefined) {
        const old = state.document!.styles.find((s) => s.styleId === node.styleId);
        styleId = id(nextId++);
        commands.push({
          type: "style.put",
          style: {
            styleId,
            fill: patch.fill,
            stroke: old?.stroke ?? "#182646",
            strokeWidth: old?.strokeWidth ?? 1,
            textColor: old?.textColor ?? "#182646",
            fontSize: old?.fontSize ?? 16,
          },
        });
      }
      commands.push({
        type: "node.update",
        pageId: state.pageId,
        layerId: l.layerId,
        node: { ...node, geometry, styleId, text: patch.text ?? node.text },
      });
      apply({ type: "batch", commands });
    },
    removeSelected() {
      if (state.selection)
        apply({
          type: "node.remove",
          pageId: state.pageId,
          layerId: state.layerId,
          nodeId: state.selection,
        });
      else notice("Select a shape first.");
    },
    addPage() {
      const doc = state.document;
      if (!doc) return;
      const pageId = id(nextId++);
      const layerId = id(nextId++);
      if (
        apply({
          type: "page.add",
          index: doc.pages.length,
          page: {
            pageId,
            name: `Page ${doc.pages.length + 1}`,
            layers: [{ layerId, name: "Main", nodes: [], connections: [] }],
          },
        })
      )
        service.setPage(pageId);
    },
    renamePage(name: string) {
      apply({ type: "page.rename", pageId: state.pageId, name });
    },
    removePage() {
      apply({ type: "page.remove", pageId: state.pageId });
    },
    addLayer() {
      const p = page();
      if (!p) return;
      const layerId = id(nextId++);
      if (
        apply({
          type: "layer.add",
          pageId: p.pageId,
          index: p.layers.length,
          layer: { layerId, name: `Layer ${p.layers.length + 1}`, nodes: [], connections: [] },
        })
      )
        service.setLayer(layerId);
    },
    renameLayer(name: string) {
      apply({ type: "layer.rename", pageId: state.pageId, layerId: state.layerId, name });
    },
    removeLayer() {
      apply({ type: "layer.remove", pageId: state.pageId, layerId: state.layerId });
    },
    connectSelected() {
      const p = page();
      const l = layer();
      const node = selected();
      const target = p?.layers.flatMap((l) => l.nodes).find((n) => n.nodeId !== node?.nodeId);
      if (!node || !target || !l) {
        notice("Select a shape on a page containing at least two shapes.");
        return;
      }
      apply({
        type: "connection.add",
        pageId: state.pageId,
        layerId: state.layerId,
        index: l.connections.length,
        connection: {
          connectionId: id(nextId++),
          sourceNodeId: node.nodeId,
          targetNodeId: target.nodeId,
          routing: "straight",
          label: "",
          styleId: null,
        },
      });
    },
    dispose() {
      generation++;
      clearPending();
      listeners.clear();
    },
  };
  return service;
}
export type DemoService = ReturnType<typeof createDemoService>;
