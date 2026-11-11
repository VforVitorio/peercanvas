import { useId } from "react";
import type { DemoState } from "../services/demo-service";
import { fixtureLabels, scenarioLabels, useDemo } from "./context";
import Icon from "./Icon";

/** Persistent simulation notice with deterministic fixture/scenario controls and reset. */
export default function Banner() {
  const { state, service, actions } = useDemo();
  const fixtureId = useId();
  const scenarioId = useId();

  return (
    <section className="pc-banner" aria-label="Simulation notice and scenario controls">
      <p className="pc-banner-text">
        <span className="pc-pill">Simulation</span>
        <span>
          UI demonstration with fictional data. Nothing is saved to disk, shared, or sent to any
          provider. Every service result is simulated.
        </span>
      </p>
      <div className="pc-banner-controls">
        <label htmlFor={fixtureId}>Fixture</label>
        <select
          id={fixtureId}
          value={state.document ? state.fixture : ""}
          onChange={(event) => actions.loadFixture(event.target.value as DemoState["fixture"])}
        >
          {!state.document && (
            <option value="" disabled>
              Choose a fixture…
            </option>
          )}
          {(Object.keys(fixtureLabels) as DemoState["fixture"][]).map((fixture) => (
            <option key={fixture} value={fixture}>
              {fixtureLabels[fixture].title}
            </option>
          ))}
        </select>
        <label htmlFor={scenarioId}>Outcome</label>
        <select
          id={scenarioId}
          value={state.scenario}
          onChange={(event) => {
            const scenario = event.target.value as DemoState["scenario"];
            service.setScenario(scenario);
            actions.announce(
              `Simulated operations will now end with: ${scenarioLabels[scenario]}.`,
            );
          }}
        >
          {(Object.keys(scenarioLabels) as DemoState["scenario"][]).map((scenario) => (
            <option key={scenario} value={scenario}>
              {scenarioLabels[scenario]}
            </option>
          ))}
        </select>
        <button type="button" className="pc-btn pc-btn-banner" onClick={actions.resetDemo}>
          <Icon name="reset" /> Reset demo
        </button>
      </div>
    </section>
  );
}
