import type { ComponentProps } from "react";
import { DesignPropertiesPanel } from "@/components/shared/design/design-properties-panel";
import { DesignTransformPanel } from "@/components/shared/design/design-transform-panel";

export function DesignPropertiesTab(props: ComponentProps<typeof DesignPropertiesPanel>) {
  return (
    <>
      <section aria-labelledby="design-transform-title" className="space-y-3">
        <h2 id="design-transform-title" className="text-sm font-semibold">
          Transformar
        </h2>
        <DesignTransformPanel editor={props.editor} editable={props.editable} />
      </section>
      <DesignPropertiesPanel {...props} />
    </>
  );
}
