import { useId } from "react";
import brandMark from "../../../docs/branding/assets/peercanvas-symbol-color.png";
import type { DemoState } from "../services/demo-service";
import { fixtureLabels, useDemo } from "./context";
import Icon from "./Icon";

const recentOrder: Array<{ fixture: DemoState["fixture"]; edited: string; tag: string }> = [
  { fixture: "diagram", edited: "Edited today (fictional)", tag: "2 pages" },
  { fixture: "collaboration", edited: "Edited yesterday (fictional)", tag: "Shared" },
  { fixture: "proposal", edited: "Edited 3 days ago (fictional)", tag: "Proposal" },
  { fixture: "empty", edited: "Created last week (fictional)", tag: "Blank" },
];

function Thumbnail({ fixture }: { fixture: DemoState["fixture"] }) {
  return (
    <div className={`pc-thumb pc-thumb-${fixture}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function Home() {
  const { state, service, ui, setUi, actions } = useDemo();
  const searchId = useId();
  const query = ui.search.trim().toLowerCase();
  const recents = recentOrder.filter(({ fixture }) => {
    const label = fixtureLabels[fixture];
    return !query || `${label.title} ${label.summary}`.toLowerCase().includes(query);
  });
  const section = ui.homeSection;
  const nav = (key: typeof section, label: string, count?: number) => (
    <li>
      <button
        type="button"
        className="pc-nav-item"
        aria-current={section === key ? "page" : undefined}
        onClick={() => setUi((current) => ({ ...current, homeSection: key }))}
      >
        {label}
        {count !== undefined && (
          <span className="pc-count">
            <span className="pc-sr-only">, </span>
            {count}
          </span>
        )}
      </button>
    </li>
  );

  return (
    <div className="pc-home">
      <nav className="pc-home-nav" aria-label="Home navigation">
        <div className="pc-brand">
          <img src={brandMark} alt="" width={28} height={28} />
          <span>PeerCanvas</span>
        </div>
        <ul>
          {nav("recent", "Recent documents", recentOrder.length)}
          {nav("recovery", "Recovery", state.recovery.length)}
        </ul>
        <ul className="pc-home-nav-secondary">
          <li>
            <button
              type="button"
              className="pc-nav-item"
              onClick={() => actions.openDialog({ kind: "help" })}
            >
              Help
            </button>
          </li>
          <li>
            <button
              type="button"
              className="pc-nav-item"
              onClick={() => actions.openDialog({ kind: "shortcuts" })}
            >
              Keyboard shortcuts
            </button>
          </li>
          <li>
            <button
              type="button"
              className="pc-nav-item"
              onClick={() => actions.openDialog({ kind: "preferences" })}
            >
              Preferences
            </button>
          </li>
          <li>
            <button
              type="button"
              className="pc-nav-item"
              onClick={() => actions.openDialog({ kind: "attribution" })}
            >
              About &amp; attribution
            </button>
          </li>
        </ul>
      </nav>

      <main id="pc-main" className="pc-home-main" tabIndex={-1}>
        <header className="pc-home-header">
          <div>
            <h1>{section === "recent" ? "Recent documents" : "Recovery"}</h1>
            <p className="pc-muted">
              {section === "recent"
                ? "Bundled fictional fixtures. Opening one replaces the active document in memory."
                : "Simulated recovery candidates. Preview first, then explicitly restore."}
            </p>
          </div>
          <div className="pc-home-actions">
            {state.document && (
              <button
                type="button"
                className="pc-btn"
                onClick={() => setUi((current) => ({ ...current, view: "workspace" }))}
              >
                Return to “{state.document.metadata.title}”
              </button>
            )}
            <button
              type="button"
              className="pc-btn pc-btn-primary"
              onClick={() => actions.requestReplace({ type: "new" })}
            >
              <Icon name="plus" /> New document
            </button>
          </div>
        </header>

        {section === "recent" ? (
          <>
            <div className="pc-search">
              <Icon name="search" />
              <label htmlFor={searchId} className="pc-sr-only">
                Search recent documents
              </label>
              <input
                id={searchId}
                type="search"
                placeholder="Search recent documents"
                value={ui.search}
                onChange={(event) =>
                  setUi((current) => ({ ...current, search: event.target.value }))
                }
              />
            </div>
            <p className="pc-sr-only" aria-live="polite">
              {recents.length} {recents.length === 1 ? "document" : "documents"} shown
            </p>
            {recents.length === 0 ? (
              <div className="pc-empty">
                <p>No recent documents match “{ui.search}”.</p>
                <button
                  type="button"
                  className="pc-btn"
                  onClick={() => setUi((current) => ({ ...current, search: "" }))}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <ul className="pc-cards" aria-label="Recent documents">
                {recents.map(({ fixture, edited, tag }) => {
                  const label = fixtureLabels[fixture];
                  const isOpen = state.fixture === fixture && Boolean(state.document);
                  return (
                    <li key={fixture} className="pc-card">
                      <Thumbnail fixture={fixture} />
                      <div className="pc-card-body">
                        <h2>{label.title}</h2>
                        <p className="pc-muted">{label.summary}</p>
                        <p className="pc-card-meta">
                          <span className="pc-tag">{tag}</span>
                          <span>{edited}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        className="pc-card-open"
                        aria-label={`Open ${label.title}${isOpen ? " (currently loaded fixture)" : ""}`}
                        onClick={() =>
                          actions.requestReplace({ type: "open", fixture, label: label.title })
                        }
                      >
                        Open
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : state.recovery.length === 0 ? (
          <div className="pc-empty">
            <p>No simulated recovery candidates for this fixture.</p>
          </div>
        ) : (
          <ul className="pc-cards" aria-label="Recovery candidates">
            {state.recovery.map((candidate) => (
              <li key={candidate.id} className="pc-card pc-card-recovery">
                <div className="pc-card-body">
                  <h2>{candidate.title}</h2>
                  <p className="pc-muted">{candidate.description}</p>
                  <p className="pc-card-meta">
                    <span className="pc-tag pc-tag-warn">Simulated recovery</span>
                  </p>
                </div>
                <button
                  type="button"
                  className="pc-card-open"
                  aria-label={`Preview ${candidate.title}`}
                  onClick={() => {
                    actions.run("Preview recovery", () => service.previewRecovery(candidate.id));
                    actions.openDialog({ kind: "recovery", id: candidate.id });
                  }}
                >
                  Preview
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
