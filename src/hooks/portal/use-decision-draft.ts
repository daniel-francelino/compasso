import { useState } from "react";
import { z } from "zod";
import { StoredKey, readStored, writeStored } from "@/lib/shared/stored-keys";

const draftsSchema = z.record(z.string(), z.string());

export const useDecisionDraft = (requestId: string) => {
  const [text, setText] = useState(
    () => readStored(StoredKey.ApprovalDraftComment, draftsSchema, {})[requestId] ?? "",
  );

  const change = (value: string) => {
    setText(value);
    const drafts = readStored(StoredKey.ApprovalDraftComment, draftsSchema, {});
    const { [requestId]: _previous, ...others } = drafts;
    writeStored(
      StoredKey.ApprovalDraftComment,
      value === "" ? others : { ...others, [requestId]: value },
    );
  };

  return { text, change, clear: () => change("") };
};
