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
  reset() {
    this.instances = [];
    this.failNextStart = null;
  },
  latest(): FakeWeave {
    const last = this.instances.at(-1);
    if (!last) throw new Error("No Weave instance created");
    return last;
  },
};

class FakeStage {
  element: HTMLElement = document.createElement("div");
  handlers = new Map<string, Handler>();
  scaleValue = { x: 1, y: 1 };
  container() {
    return this.element;
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
  position() {}
  batchDraw() {}
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
  stage = new FakeStage();
  elements: Element[] = [];
  overlay: Element | null = null;
  destroyed = false;
  listeners = new Map<string, Handler>();
  constructor(
    public config: { store: FakeStore },
    view?: { container: HTMLElement },
  ) {
    if (view) this.stage.element = view.container;
    harness.instances.push(this);
  }
  addEventListener(name: string, handler: Handler) {
    this.listeners.set(name, handler);
  }
  removeEventListener(name: string) {
    this.listeners.delete(name);
  }
  started = false;
  /** Like the real renderer, there is no stage until start() has rendered. */
  getStage() {
    return this.started ? this.stage : undefined;
  }
  start() {
    if (harness.failNextStart) {
      const message = harness.failNextStart;
      harness.failNextStart = null;
      return Promise.reject(new Error(message));
    }
    this.started = true;
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
    return Promise.resolve();
  }
  updateNode(element: Element) {
    if (element.key === "pc-selection-overlay") this.overlay = element;
  }
  destroy() {
    this.destroyed = true;
    return Promise.resolve();
  }
  /** Projected node props by label text, for assertions. */
  nodeByLabel(label: string) {
    return this.elements.find((element) => element.props.labelText === label)?.props;
  }
}

const nodeClass = (type: string) =>
  class {
    static defaultState(id: string): Element {
      return { key: id, type, props: { id, nodeType: type } };
    }
  };

export const sdk = {
  Weave: FakeWeave,
  WeaveArrowNode: nodeClass("arrow"),
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
