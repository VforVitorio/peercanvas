import { useCallback } from "react";
import { useI18n } from "../../i18n";
import { formatMessage, type EditorMessage } from "./messages";

/** Formats structured editor messages in the current interface language. */
export function useFormatMessage() {
  const { t, message } = useI18n();
  return useCallback(
    (value: EditorMessage | null): string => (value ? formatMessage(value, { t, message }) : ""),
    [t, message],
  );
}
