import { FakeWeave, sdk } from "../ui-mock/ui/test/weaveMock";

type Element = FakeWeave["elements"][number];
type Handler = () => void;

class CanvasEvents {
  handlers = new Map<string, Handler[]>();
  on(names: string, handler: Handler) {
    for (const name of names.split(" ")) {
      const event = name.split(".")[0];
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    }
  }
  off() {
    this.handlers.clear();
  }
  fire(name: string) {
    for (const handler of this.handlers.get(name) ?? []) handler();
  }
}

class CanvasNode extends CanvasEvents {
  constructor(public element: Element) {
    super();
  }
  id() {
    return this.element.key;
  }
  x() {
    return this.element.props.x;
  }
  y() {
    return this.element.props.y;
  }
  width() {
    return this.element.props.width;
  }
  height() {
    return this.element.props.height;
  }
  rotation() {
    return this.element.props.rotation;
  }
  scaleX() {
    return this.element.props.scaleX ?? 1;
  }
  scaleY() {
    return this.element.props.scaleY ?? 1;
  }
}

export class SelectionPlugin {
  nodes: CanvasNode[] = [];
  transformer = new CanvasEvents();
  gesture = {
    resets: 0,
    reset() {
      this.resets += 1;
    },
  };
  getTransformer() {
    return this.transformer;
  }
  getGesture() {
    return this.gesture;
  }
  constructor(public options: unknown) {}
  isInitialized() {
    return true;
  }
  getSelectedNodes() {
    return this.nodes;
  }
  setSelectedNodes(nodes: CanvasNode[]) {
    this.nodes = nodes;
  }
}

export class InteractiveWeave extends FakeWeave {
  nodes = new Map<string, CanvasNode>();
  destroyCalls = 0;
  action: string | null = null;
  constructor(
    public options: ConstructorParameters<typeof FakeWeave>[0] & {
      plugins: unknown[];
      actions: unknown[];
      nodes: unknown[];
    },
    view?: { container: HTMLElement },
  ) {
    super(options, view);
    Object.assign(this.stage, { findOne: (selector: string) => this.nodes.get(selector.slice(1)) });
  }
  override start() {
    return super.start().then(() => {
      this.stage.container().tabIndex = 1;
      this.stage.container().focus();
      for (const element of this.elements) this.nodes.set(element.key, new CanvasNode(element));
    });
  }
  triggerAction(action: string) {
    this.action = action;
  }
  override destroy() {
    this.destroyCalls += 1;
    return super.destroy();
  }
}

export class RectangleNode extends sdk.WeaveRectangleNode {
  constructor(public options: unknown) {
    super();
  }
}

export const interactiveSdk = {
  ...sdk,
  Weave: InteractiveWeave,
  WeaveRectangleNode: RectangleNode,
  WeaveNodesSelectionPlugin: SelectionPlugin,
  WeaveSelectionToolAction: class {},
};
