import { useEffect, useRef, useState } from "react";
import type { TextElement } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, designFontFamily } from "@/lib/shared/design/types";
import type { Viewport } from "@/lib/shared/design/viewport";

const grow = (node: HTMLTextAreaElement) => {
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight}px`;
};

export function DesignTextOverlay({
  element,
  view,
  onCommit,
  onCancel,
}: {
  element: TextElement;
  view: Viewport;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(element.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    grow(node);
    node.focus();
    node.select();
  }, []);

  const finish = (apply: boolean) => {
    if (done.current) return;
    done.current = true;
    if (apply) onCommit(value);
    else onCancel();
  };

  const zoom = view.zoom;
  return (
    <textarea
      ref={ref}
      aria-label="Texto do elemento"
      value={value}
      maxLength={DESIGN_LIMITS.maxText}
      spellCheck
      className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-none ring-1 ring-primary"
      style={{
        left: view.x + element.x * zoom,
        top: view.y + element.y * zoom,
        width: element.width * zoom,
        minHeight: element.height * zoom,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: `${(element.width * zoom) / 2}px ${(element.height * zoom) / 2}px`,
        fontFamily: `"${designFontFamily(element.font)}"`,
        fontSize: element.fontSize * zoom,
        fontWeight: element.bold ? 700 : 400,
        fontStyle: element.italic ? "italic" : "normal",
        lineHeight: element.lineHeight,
        color: element.color,
        textAlign: element.align,
        opacity: element.opacity,
      }}
      onChange={(event) => {
        setValue(event.target.value);
        grow(event.target);
      }}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
          return;
        }
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          finish(true);
        }
      }}
    />
  );
}
