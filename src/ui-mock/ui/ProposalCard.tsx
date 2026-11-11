import { useDemo } from "./context";
import type { Proposal } from "./types";

const sourceNames: Record<Proposal["source"], string> = {
  assistant: "simulated assistant",
  mcp: "simulated MCP client",
  import: "simulated import",
};

/**
 * Preview-first review of a pending proposal. Nothing is applied until the user activates
 * the explicit approval button; the service enforces single use and revision binding.
 */
export default function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { service } = useDemo();
  const isImport = proposal.source === "import";
  return (
    <section
      className={`pc-proposal pc-proposal-${proposal.status}`}
      aria-label={isImport ? "Import preview" : "Proposed change"}
    >
      <header>
        <h3>{proposal.title}</h3>
        <span className="pc-tag">
          {proposal.status === "pending" ? "Awaiting your review" : proposal.status}
        </span>
      </header>
      <p className="pc-small">
        From the {sourceNames[proposal.source]}. {proposal.description}
      </p>
      <h4>Preview of changes</h4>
      <ul>
        {proposal.changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
      {proposal.status === "pending" ? (
        <div className="pc-row">
          <button
            type="button"
            className="pc-btn pc-btn-primary"
            onClick={() => service.approveProposal()}
          >
            {isImport ? "Apply import" : "Approve and apply"}
          </button>
          <button type="button" className="pc-btn" onClick={() => service.rejectProposal()}>
            {isImport ? "Decline import" : "Reject"}
          </button>
        </div>
      ) : (
        <p className="pc-small" role="status">
          {proposal.status === "approved"
            ? "Applied once through validated commands. It cannot be approved again."
            : proposal.status === "stale"
              ? "The document changed after this preview was made, so it can no longer be applied."
              : isImport
                ? "Declined. The document was not changed."
                : "Rejected. The document was not changed."}
        </p>
      )}
    </section>
  );
}
