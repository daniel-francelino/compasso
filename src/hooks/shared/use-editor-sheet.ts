import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { bypassUnsavedGuard } from "@/lib/shared/unsaved-guard";

export function useEditorSheet<T>(
  listQueryKey: readonly unknown[],
  options: { onCreated?: (id: string) => void | Promise<void> } = {},
) {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<{ item?: T } | null>(null);
  const [formState, setFormState] = useState({ dirty: false, busy: false });
  const confirmDiscard = useUnsavedChanges(formState.dirty);
  const trigger = useRef<HTMLElement | null>(null);

  function open(item?: T) {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFormState({ dirty: false, busy: false });
    setEditor(item === undefined ? {} : { item });
  }

  async function close() {
    if (formState.busy) return;
    if (formState.dirty && !(await confirmDiscard())) return;
    setEditor(null);
  }

  async function saved(createdId?: string) {
    setEditor(null);
    setFormState({ dirty: false, busy: false });
    await queryClient.invalidateQueries({ queryKey: listQueryKey });
    if (createdId && options.onCreated) {
      bypassUnsavedGuard();
      await options.onCreated(createdId);
    }
  }

  return {
    editor,
    formState,
    setFormState,
    open,
    close,
    saved,
    restoreFocus: (event: Event) => {
      event.preventDefault();
      trigger.current?.focus();
    },
  };
}
