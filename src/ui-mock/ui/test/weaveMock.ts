/**
 * Test double for the pinned Weave packages (jsdom has no canvas). It records the
 * projection each renderer instance receives so tests can observe what the adapter
 * derived from the canonical service snapshot. The demo service itself is never mocked.
 */
type Element = { key: string; type: string; props: Record<string, unknown> };
type Handler = (event: unknown) => void;

export const harness = {
  instances: [] as FakeWeave[],
  failNextStart: null as string | null,
  failNextConstruct: null as string | null,
  /** When true, start() parks before initStage (like the SDK awaiting fonts) until released. */
  holdStarts: false,
  held: [] as Array<() => void>,
  /** Instances whose start()/destroy() is in flight, to detect overlapping SDK lifecycles. */
  starting: new Set<FakeWeave>(),
  destroying: new Set<FakeWeave>(),
  /** Overlaps of one instance's start with another's destroy (which resets SDK globals). */
  violations: [] as string[],
  reset() {
    this.releaseStarts(); // never leave a parked start blocking later renderers
    this.instances = [];
    this.failNextStart = null;
    this.failNextConstruct = null;
    this.starting.clear();
    this.destroying.clear();
    this.violations = [];
  },
  gate(): Promise<void> {
    if (!this.holdStarts) return Promise.resolve();
    return new Promise((resolve) => this.held.push(resolve));
  },
  releaseStarts() {
    this.holdStarts = false;
    for (const resolve of this.held.splice(0)) resolve();
  },
  /** Stages created by start() and not yet destroyed. */
  liveStages() {
    return this.instances.filter((instance) => instance.started && !instance.stage.destroyed);
  },
  latest(): FakeWeave {
    const last = this.instances.at(-1);
    if (!last) throw new Error("No Weave instance created");
    return last;
  },
};

/** Konva-like rendered node: the adapter may only move it transiently for a drag preview. */
export class FakeNode {
  pos: { x: number; y: number };
  pts: number[] | null;
  constructor(
    public key: string,
    props: Record<string, unknown>,
    private parent: unknown,
  ) {
    this.pos = { x: Number(props.x ?? 0), y: Number(props.y ?? 0) };
    this.pts = Array.isArray(props.points) ? [...(props.points as number[])] : null;
  }
  id() {
    return this.key;
  }
  getParent() {
    return this.parent;
  }
  position(value?: { x: number; y: number }) {
    if (value) this.pos = { ...value };
    return this.pos;
  }
  points(value?: number[]) {
    if (value) this.pts = [...value];
    return this.pts ?? [];
  }
}

class FakeStage {
  handlers = new Map<string, Handler>();
  scaleValue = { x: 1, y: 1 };
  positionValue = { x: 0, y: 0 };
  size = { width: 0, height: 0 };
  nodes = new Map<string, FakeNode>();
  draws = 0;
  destroyed = false;
  constructor(private owner: FakeWeave) {}
  /** Handlers are deliberately kept, so tests still observe the adapter's own `off` cleanup. */
  destroy() {
    this.destroyed = true;
  }
  width(value?: number) {
    if (value !== undefined) this.size.width = value;
    return this.size.width;
  }
  height(value?: number) {
    if (value !== undefined) this.size.height = value;
    return this.size.height;
  }
  scaleX() {
    return this.scaleValue.x;
  }
  /** Rebuilds rendered nodes from the projected state, like a renderer (re)render. */
  render(elements: Element[]) {
    this.nodes = new Map(elements.map((e) => [e.key, new FakeNode(e.key, e.props, this)]));
  }
  findOne(selector: (node: FakeNode) => boolean) {
    for (const node of this.nodes.values()) if (selector(node)) return node;
    return undefined;
  }
  /**
   * Hit test at a stage-container point through the current stage transform, topmost first.
   * Returns the listening child shape, as Konva does, so the adapter must walk up to the group.
   */
  getIntersection(point: { x: number; y: number }) {
    const world = {
      x: (point.x - this.positionValue.x) / this.scaleValue.x,
      y: (point.y - this.positionValue.y) / this.scaleValue.y,
    };
    for (const element of [...this.owner.elements].reverse()) {
      if (element.type !== "rectangle" || element.props.listening === false) continue;
      const node = this.nodes.get(element.key);
      if (!node) continue;
      const { width, height } = element.props as { width: number; height: number };
      if (
        world.x >= node.pos.x &&
        world.x <= node.pos.x + width &&
        world.y >= node.pos.y &&
        world.y <= node.pos.y + height
      )
        return { id: () => `${element.key}-bg`, getParent: () => node };
    }
    return null;
  }
  on(names: string, handler: Handler) {
    for (const name of names.split(" ")) this.handlers.set(name.split(".")[0], handler);
  }
  off(names: string) {
    for (const name of names.split(" ")) this.handlers.delete(name.split(".")[0]);
  }
  scale(value: { x: number; y: number }) {
    this.scaleValue = value;
  }
  position(value?: { x: number; y: number }) {
    if (value) this.positionValue = value;
    return this.positionValue;
  }
  batchDraw() {
    this.draws++;
  }
  /** Simulates a pointer click on the projected node with the given id (null = background). */
  click(nodeId: string | null) {
    const parent = { id: () => String(nodeId), getParent: () => this };
    const target = nodeId
      ? { id: () => `${nodeId}-bg`, getParent: () => parent }
      : { id: () => "", getParent: () => null };
    this.handlers.get("click")?.({ target });
  }
}

class FakeStore {
  constructor(public config: { initialState: (doc: unknown) => void }) {}
}

export class FakeWeave {
  stage: FakeStage = new FakeStage(this);
  elements: Element[] = [];
  overlay: Element | null = null;
  destroyed = false;
  listeners = new Map<string, Handler>();
  constructor(
    public config: { store: FakeStore; plugins?: unknown[] },
    public stageConfig?: { container: HTMLElement; width: number; height: number },
  ) {
    if (harness.failNextConstruct) {
      const message = harness.failNextConstruct;
      harness.failNextConstruct = null;
      throw new Error(message);
    }
    harness.instances.push(this);
  }
  addEventListener(name: string, handler: Handler) {
    this.listeners.set(name, handler);
  }
  removeEventListener(name: string) {
    this.listeners.delete(name);
  }
  started = false;
  /** Set by start() once it reaches registerStore, as in the pinned SDK. */
  storeRegistered = false;
  startCalls = 0;
  destroyCalls = 0;
  /** Like the real renderer, there is no stage until start() has rendered. */
  getStage() {
    return this.started ? this.stage : undefined;
  }
  /**
   * Shaped like the pinned SDK's async start(): node registration, registerStore, awaited font
   * loading (optionally parked by `harness.holdStarts`), then initStage and store.connect. Like the
   * SDK it never checks whether destroy() already ran, so a late start creates a stage anyway.
   */
  async start() {
    this.startCalls++;
    if (harness.destroying.size > 0)
      harness.violations.push(`start of ${harness.instances.indexOf(this)} during a destroy`);
    harness.starting.add(this);
    try {
      await Promise.resolve(); // registerNodesHandlers
      this.storeRegistered = true;
      if (harness.failNextStart) {
        const message = harness.failNextStart;
        harness.failNextStart = null;
        throw new Error(message);
      }
      await harness.gate(); // fontsManager.loadFonts
      this.initStage();
      await Promise.resolve(); // store.connect
    } finally {
      harness.starting.delete(this);
    }
  }
  private initStage() {
    this.started = true;
    // Like the pinned SDK's initStage: sized from the container's parent, and the container
    // itself is forced to inline relative positioning.
    const container = this.stageConfig?.container;
    if (container) {
      container.style.position = "relative";
      this.stage.width(container.parentElement?.clientWidth ?? 0);
      this.stage.height(container.parentElement?.clientHeight ?? 0);
    }
    const root: Element = {
      key: "stage",
      type: "stage",
      props: { children: [{ key: "mainLayer", type: "layer", props: { children: [] } }] },
    };
    const ydoc = {
      transact: (fn: () => void) => fn(),
      getMap: () => ({
        toJSON: () => structuredClone(root),
        set: (_key: string, value: Element["props"]) => {
          root.props = value;
        },
      }),
    };
    this.config.store.config.initialState(ydoc);
    const layer = (root.props.children as Element[])[0];
    const children = layer.props.children as Element[];
    this.elements = children.filter((child) => child.key !== "pc-selection-overlay");
    this.overlay = children.find((child) => child.key === "pc-selection-overlay") ?? null;
    this.stage.render(children);
  }
  /** Writes recorded through the SDK store path; the adapter may only use it for the overlay. */
  updates: string[] = [];
  updateNode(element: Element) {
    this.updates.push(element.key);
    if (element.key === "pc-selection-overlay") {
      this.overlay = element;
      this.stage.nodes.get(element.key)?.position({
        x: Number(element.props.x ?? 0),
        y: Number(element.props.y ?? 0),
      });
    }
  }
  /**
   * Shaped like the pinned SDK's destroy(): clears listeners, awaits store.disconnect() (which
   * throws if start() never registered the store), destroys the stage only if one exists *now*,
   * then resets process globals (globalThis.Konva), which any concurrent start() would share.
   */
  async destroy() {
    this.destroyCalls++;
    for (const other of harness.starting)
      if (other !== this)
        harness.violations.push(
          `destroy of ${harness.instances.indexOf(this)} during start of ${harness.instances.indexOf(other)}`,
        );
    harness.destroying.add(this);
    try {
      this.listeners.clear();
      if (!this.storeRegistered) throw new TypeError("Cannot read properties of undefined");
      await Promise.resolve(); // store.disconnect
      if (this.started) this.stage.destroy();
      this.destroyed = true;
    } finally {
      harness.destroying.delete(this);
    }
  }
  /** Projected node props by label text, for assertions. */
  nodeByLabel(label: string) {
    return this.elements.find((element) => element.props.labelText === label)?.props;
  }
}

// Like the pinned SDK, the arrow node has no defaultState of its own and inherits "unknown";
// the adapter must declare the arrow type itself or the renderer will not draw connections.
const nodeClass = (type: string, inherited = false) =>
  class {
    static defaultState(id: string): Element {
      const effective = inherited ? "unknown" : type;
      return { key: id, type: effective, props: { id, nodeType: effective } };
    }
  };

export const sdk = {
  Weave: FakeWeave,
  WeaveArrowNode: nodeClass("arrow", true),
  WeaveRectangleNode: nodeClass("rectangle"),
  WeaveGroupNode: nodeClass("group"),
  WeaveLayerNode: nodeClass("layer"),
  WeaveStageNode: nodeClass("stage"),
  WeaveStageResizePlugin: class {},
  WeaveStateManipulation: { mapValueToYjs: (value: unknown) => value },
  defaultInitialState: () => undefined,
};

export const renderer = { WeaveKonvaBaseRenderer: class {} };
export const store = { WeaveStoreStandalone: FakeStore };
