import EditorWorkspace from "./editor/components/EditorWorkspace";
import { PreferencesProvider } from "./preferences/PreferencesProvider";
import "./App.css";

/**
 * Application root. PreferencesProvider supplies theme, language, and translations (it renders
 * I18nProvider); the editor workspace owns the single canonical document session.
 */
export default function App() {
  return (
    <PreferencesProvider>
      <EditorWorkspace />
    </PreferencesProvider>
  );
}
