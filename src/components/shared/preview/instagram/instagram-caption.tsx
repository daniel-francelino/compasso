import { Fragment, type ReactNode, useState } from "react";
import {
  CaptionTokenKind,
  collapseInstagramCaption,
  tokenizeCaption,
} from "@/lib/shared/preview/instagram";
import { cn } from "@/lib/shared/utils";

export function InstagramCaption({
  caption,
  prefix,
  full = false,
  className,
}: {
  caption: string;
  prefix?: ReactNode;
  full?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (caption.trim() === "") return null;
  const collapsed = collapseInstagramCaption(caption);
  const hidden = !full && !expanded && collapsed.truncated;
  const shown = hidden ? collapsed.text : caption;
  return (
    <p className={cn("whitespace-pre-wrap break-words px-3 text-sm text-foreground", className)}>
      {prefix}
      {prefix ? " " : null}
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
