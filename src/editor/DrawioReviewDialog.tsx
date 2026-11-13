import { useRef } from "react";
import { useI18n } from "../i18n";
import Dialog from "./ui/Dialog";
import "./UnsavedChangesDialog.css";

export type DrawioReview = {
  kind: "import" | "export";
  /** The user's file name, shown untouched. */
  displayName?: string;
  /** Already translated by the owner, one entry per reported loss, in reported order. */
  losses: string[];
  preservedFragmentCount: number;
};

type Props = {
  review: DrawioReview;
  busy: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
};

export default function DrawioReviewDialog({ review, busy, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  const cancel = useRef<HTMLButtonElement>(null);
  const isImport = review.kind === "import";
  const hasLosses = review.losses.length > 0;

  return (
    <Dialog
      role={hasLosses ? "alertdialog" : "dialog"}
      title={isImport ? t("documents.drawio.importTitle") : t("documents.drawio.exportTitle")}
      description={
        isImport
          ? review.displayName
            ? t("documents.drawio.importPrompt", { name: review.displayName })
            : t("documents.drawio.importPromptUnnamed")
          : t("documents.drawio.exportPrompt")
      }
      titleId="pc-drawio-title"
      descriptionId="pc-drawio-description"
      describedBy={
        hasLosses ? "pc-drawio-description pc-drawio-loss-list" : "pc-drawio-description"
      }
      className="pc-unsaved-dialog"
      busy={busy}
      onClose={() => void onCancel()}
      initialFocusRef={cancel}
      footer={
        <>
          <button
            className="pc-btn"
            type="button"
            ref={cancel}
            disabled={busy}
            onClick={() => void onCancel()}
          >
            {t("documents.drawio.cancel")}
          </button>
          <button
            className="pc-btn pc-primary"
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {isImport ? t("documents.drawio.confirmImport") : t("documents.drawio.confirmExport")}
          </button>
        </>
      }
    >
      {review.preservedFragmentCount > 0 && (
        <p className="pc-drawio-preserved" role="status">
          {t("documents.drawio.preserved", { count: review.preservedFragmentCount })}
        </p>
      )}
      {hasLosses ? (
        <section className="pc-drawio-losses" aria-labelledby="pc-drawio-losses-heading">
          <h3 id="pc-drawio-losses-heading">{t("documents.drawio.lossesTitle")}</h3>
          <ul id="pc-drawio-loss-list">
            {review.losses.map((loss, index) => (
              <li key={`${index}-${loss}`}>{loss}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p>{t("documents.drawio.noLosses")}</p>
      )}
      {busy && <p role="status">{t("documents.drawio.working")}</p>}
    </Dialog>
  );
}
