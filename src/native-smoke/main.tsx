import ReactDOM from "react-dom/client";
import NativeSmokeCanvas from "./NativeSmokeCanvas";
import NativeSmokePeer from "./NativeSmokePeer";
import "./styles.css";

type NativeInputIsolation = {
  enabled: boolean;
  suppressed: number;
  examples: Array<{ type: string; buttons: number }>;
};

declare global {
  interface Window {
    __PEERCANVAS_NATIVE_INPUT_ISOLATION__?: NativeInputIsolation;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
if (new URLSearchParams(window.location.search).has("native-smoke-peer")) {
  root.render(<NativeSmokePeer />);
} else {
  const isolation: NativeInputIsolation = { enabled: true, suppressed: 0, examples: [] };
  window.__PEERCANVAS_NATIVE_INPUT_ISOLATION__ = isolation;
  for (const type of [
    "pointerdown",
    "pointermove",
    "pointerup",
    "mousedown",
    "mousemove",
    "mouseup",
  ] as const) {
    window.addEventListener(
      type,
      (event) => {
        if (!event.isTrusted) return;
        isolation.suppressed++;
        if (isolation.examples.length < 10)
          isolation.examples.push({ type: event.type, buttons: event.buttons });
        event.stopImmediatePropagation();
        if (event.cancelable) event.preventDefault();
      },
      { capture: true },
    );
  }
  root.render(<NativeSmokeCanvas />);
}
