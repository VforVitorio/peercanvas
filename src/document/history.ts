import {
  executeCommand,
  type CommandContext,
  type CommandOutcome,
  type Document,
  type Layer,
  type ModelState,
  type Node,
  type Page,
  type Result,
} from "./index";

type Command = Record<string, unknown>;
interface Entry {
  forward: Command[];
  inverse: Command[];
}
export interface DocumentHistory {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  record(before: ModelState, command: unknown): void;
  undo(state: ModelState, context: CommandContext): Result<CommandOutcome> | null;
  redo(state: ModelState, context: CommandContext): Result<CommandOutcome> | null;
  clear(): void;
}

function inverseFor(command: Command, document: Document): Command[] {
  const type = String(command.type);
  const p = document.pages.find((value) => value.pageId === command.pageId);
  const l = p?.layers.find((value) => value.layerId === command.layerId);
  switch (type) {
    case "document.setMetadata":
      return [{ type, title: document.metadata.title, description: document.metadata.description }];
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
          nodeId: (command.node as Node).nodeId,
        },
      ];
    case "node.update": {
      const node = l?.nodes.find((n) => n.nodeId === (command.node as Node).nodeId);
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
    case "style.remove":
      // shortcut: style removal clears history until commands can restore canonical style order.
      return [];
    default:
      return [];
  }
}

/** Session-only command history. The canonical executor remains the only writer. */
export function createDocumentHistory(): DocumentHistory {
  let undo: Entry[] = [];
  let redo: Entry[] = [];
  const clear = () => {
    undo = [];
    redo = [];
  };
  const replay = (
    state: ModelState,
    context: CommandContext,
    source: Entry[],
    target: Entry[],
    direction: "forward" | "inverse",
  ): Result<CommandOutcome> | null => {
    const entry = source.at(-1);
    if (!entry) return null;
    const result = executeCommand(state, { type: "batch", commands: entry[direction] }, context);
    if (result.ok) {
      source.pop();
      target.push(entry);
    }
    return result;
  };
  return {
    get canUndo() {
      return undo.length > 0;
    },
    get canRedo() {
      return redo.length > 0;
    },
    clear,
    record(before, command) {
      const now = before.document.metadata.updatedAt;
      const accepted = executeCommand(before, command, { expectedRevision: before.revision, now });
      if (!accepted.ok || !accepted.value.changed) return;
      try {
        const raw = JSON.parse(JSON.stringify(command)) as Command;
        const forward = raw.type === "batch" ? (raw.commands as Command[]) : [raw];
        let candidate = before;
        let inverse: Command[] = [];
        for (const child of forward) {
          const step = executeCommand(candidate, child, {
            expectedRevision: candidate.revision,
            now,
          });
          if (!step.ok) {
            clear();
            return;
          }
          if (step.value.changed) {
            const commands = inverseFor(child, candidate.document);
            if (!commands.length) {
              clear();
              return;
            }
            inverse = [...commands, ...inverse];
          }
          candidate = step.value.state;
        }
        // shortcut: inverses exceeding the canonical batch bound clear history until chunked undo exists.
        if (!inverse.length || inverse.length > 1000) {
          clear();
          return;
        }
        const checked = executeCommand(
          candidate,
          { type: "batch", commands: inverse },
          {
            expectedRevision: candidate.revision,
            now,
          },
        );
        if (!checked.ok) {
          clear();
          return;
        }
        undo.push({ forward, inverse: JSON.parse(JSON.stringify(inverse)) as Command[] });
        redo = [];
      } catch {
        clear();
      }
    },
    undo: (state, context) => replay(state, context, undo, redo, "inverse"),
    redo: (state, context) => replay(state, context, redo, undo, "forward"),
  };
}
