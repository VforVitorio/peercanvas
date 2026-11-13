import { useI18n } from "../../i18n";
import Dialog from "../ui/Dialog";
import { shortcutLabel } from "./shortcuts";

type Shortcut = { keys: string[]; description: string };

// Chords use "Mod" for Ctrl/Cmd. Named keys are conventional symbols.
const groups: { title: string; items: Shortcut[] }[] = [
  {
    title: "editor.help.groupDocument",
    items: [
      { keys: ["Mod+N"], description: "editor.help.new" },
      { keys: ["Mod+O"], description: "editor.help.open" },
      { keys: ["Mod+S"], description: "editor.help.save" },
      { keys: ["Mod+Shift+S"], description: "editor.help.saveAs" },
    ],
  },
  {
    title: "editor.help.groupEditing",
    items: [
      { keys: ["Mod+Z"], description: "editor.help.undo" },
      { keys: ["Mod+Shift+Z", "Mod+Y"], description: "editor.help.redo" },
      { keys: ["Esc"], description: "editor.help.escape" },
    ],
  },
  {
    title: "editor.help.groupCanvas",
    items: [
      { keys: ["←↑↓→"], description: "editor.help.move" },
      { keys: ["Shift+←↑↓→"], description: "editor.help.moveFar" },
      { keys: ["Alt+←↑↓→"], description: "editor.help.resize" },
      { keys: ["Alt+Shift+←↑↓→"], description: "editor.help.resizeFar" },
      { keys: ["⌦", "⌫"], description: "editor.help.delete" },
      { keys: ["Esc"], description: "editor.help.clear" },
    ],
  },
];

/** Read-only shortcut reference. It never changes the diagram. */
export default function HelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog
      title={t("editor.help.title")}
      description={t("editor.help.intro")}
      onClose={onClose}
      closeOnBackdrop
      footer={
        <button type="button" className="pc-btn pc-btn--primary pc-primary" onClick={onClose}>
          {t("editor.help.close")}
        </button>
      }
    >
      {groups.map((group) => (
        <section key={group.title} aria-labelledby={`help-${group.title}`}>
          <h3 id={`help-${group.title}`}>{t(group.title)}</h3>
          <dl className="pc-shortcut-list">
            {group.items.map((item) => (
              <div key={item.description + item.keys.join()}>
                <dt>
                  {item.keys.map((chord, index) => (
                    <span key={chord}>
                      {index > 0 && " / "}
                      <kbd>{chord.includes("+") ? shortcutLabel(chord).display : chord}</kbd>
                    </span>
                  ))}
                </dt>
                <dd>{t(item.description)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Dialog>
  );
}
