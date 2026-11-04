import { Fragment, useState } from "react";
import {
  CaptionTokenKind,
  collapseInstagramCaption,
  tokenizeCaption,
} from "@/lib/shared/preview/instagram";

export function InstagramCaption({
  profileName,
  caption,
}: {
  profileName: string;
  caption: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (caption.trim() === "") return null;
  const collapsed = collapseInstagramCaption(caption);
  const hidden = !expanded && collapsed.truncated;
  const shown = hidden ? collapsed.text : caption;
  return (
    <p className="whitespace-pre-wrap break-words px-3 text-sm text-foreground">
      <span className="font-semibold">{profileName.replace(/^@/, "")}</span>{" "}
      {tokenizeCaption(shown).map((token, index) =>
        token.kind === CaptionTokenKind.Tag ? (
          <span key={`${index}-${token.text}`} className="text-violet">
            {token.text}
          </span>
        ) : (
          <Fragment key={`${index}-${token.text}`}>{token.text}</Fragment>
        ),
      )}
      {hidden ? (
        <>
          {"… "}
          <button
            type="button"
            className="text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setExpanded(true)}
          >
            mais
          </button>
        </>
      ) : null}
    </p>
  );
}
