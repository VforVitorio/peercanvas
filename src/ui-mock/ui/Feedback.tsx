import { useState } from "react";
import { useDemo } from "./context";
import ProposalCard from "./ProposalCard";

const opNames = {
  import: "Import",
  export: "Export",
  save: "Save",
  open: "Open",
  assistant: "Assistant request",
  mcp: "MCP request",
} as const;

const statusNames = {
  running: "In progress",
  waiting: "Waiting for you",
  error: "Failed",
  cancelled: "Cancelled",
  done: "Completed",
} as const;

/** Progress/result card for document-level simulated operations (import/export/save/open). */
export function OperationPanel() {
  const { state, service } = useDemo();
  // Dismissal is bound to the immutable operation snapshot (identity), so a fresh operation or
  // a reset never inherits an earlier dismissal, while unrelated updates keep the same snapshot.
  const [dismissed, setDismissed] = useState<object | null>(null);
  const op = state.operation;
  if (!op || op.kind === "assistant" || op.kind === "mcp") return null;
  if (dismissed === op) return null;
  const active = op.status === "running" || op.status === "waiting";
  return (
    <section
      className={`pc-operation pc-op-${op.status}`}
      aria-label={`${opNames[op.kind]} operation`}
      role={op.status === "error" ? "alert" : "status"}
    >
      <header>
        <strong>
          {opNames[op.kind]} · {statusNames[op.status]}
        </strong>
        <span className="pc-tag pc-tag-warn">Simulated</span>
      </header>
      <p>{op.message}</p>
      {active && (
        <progress max={100} value={op.progress} aria-label={`${opNames[op.kind]} progress`}>
          {op.progress}%
        </progress>
      )}
      <div className="pc-row">
        {op.status === "waiting" && (
          <button
            type="button"
            className="pc-btn pc-btn-small pc-btn-primary"
            onClick={() => service.finishWaiting()}
          >
            Continue
          </button>
        )}
        {active ? (
          <button
            type="button"
            className="pc-btn pc-btn-small"
            onClick={() => service.cancelOperation()}
          >
            Cancel {opNames[op.kind].toLowerCase()}
          </button>
        ) : (
          <button type="button" className="pc-btn pc-btn-small" onClick={() => setDismissed(op)}>
            Dismiss
          </button>
        )}
      </div>
    </section>
  );
}

/** Import preview: a pending import proposal must be applied or declined explicitly. */
export function ImportReview() {
  const { state } = useDemo();
  // Proposal ids are deterministic and reused after reset, so dismissal tracks the snapshot object.
  const [dismissed, setDismissed] = useState<object | null>(null);
  const proposal = state.proposal;
  if (!proposal || proposal.source !== "import" || !state.document) return null;
  if (dismissed === proposal) return null;
  return (
    <div className="pc-import-review">
      <ProposalCard proposal={proposal} />
      {proposal.status !== "pending" && (
        <button
          type="button"
          className="pc-btn pc-btn-small"
          onClick={() => setDismissed(proposal)}
        >
          Close import preview
        </button>
      )}
    </div>
  );
}

export function Toasts({
  uiNotice,
  onDismissUi,
}: {
  uiNotice: { id: number; message: string } | null;
  onDismissUi: () => void;
}) {
  const { state, service } = useDemo();
  const notice = state.notice;
  return (
    <div className="pc-toasts">
      {notice && (
        <div
          className={`pc-toast pc-toast-${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
          data-testid="service-notice"
        >
          <span className="pc-toast-kind">
            {notice.kind === "error" ? "Rejected" : notice.kind === "success" ? "Done" : "Note"}
          </span>
          <span>{notice.message}</span>
          <button
            type="button"
            className="pc-btn pc-btn-small"
            onClick={() => service.dismissNotice()}
          >
            Dismiss
          </button>
        </div>
      )}
      {uiNotice && (
        <div
          key={uiNotice.id}
          className="pc-toast pc-toast-info"
          role="status"
          data-testid="ui-notice"
        >
          <span className="pc-toast-kind">Info</span>
          <span>{uiNotice.message}</span>
          <button type="button" className="pc-btn pc-btn-small" onClick={onDismissUi}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
