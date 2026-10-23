import { type JSONContent, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, List, ListOrdered, Redo2, Undo2 } from "lucide-react";
import { useEffect } from "react";
import { FieldLabel, FieldMessage } from "@/components/shared/admin/form-fields";
import { IconButton } from "@/components/shared/admin/icon-button";
import {
  RICH_TEXT_MAX_CHARACTERS,
  type RichDoc,
  isRichDocEmpty,
  richDocSchema,
} from "@/lib/shared/rich-text/types";
import { cn } from "@/lib/shared/utils";

export function RichTextEditor({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  error,
  disabled = false,
}: {
  id: string;
  label: string;
  value: RichDoc | null;
  onValueChange: (value: RichDoc | null) => void;
  placeholder?: string;
  error?: string | undefined;
  disabled?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    content: value as JSONContent | null,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
      }),
    ],
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        ...(placeholder === undefined ? {} : { "aria-placeholder": placeholder }),
        "aria-label": label,
        class:
          "min-h-28 max-h-72 overflow-y-auto px-3 py-2 text-sm focus-visible:outline-none [&_h2]:text-base [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate: ({ editor: current }) => {
      const parsed = richDocSchema.safeParse(current.getJSON());
      if (!parsed.success) return;
      onValueChange(isRichDocEmpty(parsed.data) ? null : parsed.data);
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const isEmpty = useEditorState({
    editor,
    selector: (state) => state.editor?.isEmpty ?? true,
  });
  const length = editor?.getText().length ?? 0;

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div
        className={cn(
          "rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring",
          error && "border-destructive",
        )}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-1">
          <IconButton
            label="Negrito"
            icon={Bold}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <IconButton
            label="Itálico"
            icon={Italic}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <IconButton
            label="Título"
            icon={Heading2}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <IconButton
            label="Lista com marcadores"
            icon={List}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <IconButton
            label="Lista numerada"
            icon={ListOrdered}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
          <IconButton
            label="Desfazer"
            icon={Undo2}
            disabled={disabled}
            onClick={() => editor?.chain().focus().undo().run()}
          />
          <IconButton
            label="Refazer"
            icon={Redo2}
            disabled={disabled}
            onClick={() => editor?.chain().focus().redo().run()}
          />
        </div>
        <div className="relative">
          {placeholder !== undefined && isEmpty ? (
            <p
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-3 top-3 text-sm text-muted-foreground"
            >
              {placeholder}
            </p>
          ) : null}
          <EditorContent editor={editor} />
        </div>
      </div>
      <FieldMessage error={error} hint={`${length}/${RICH_TEXT_MAX_CHARACTERS} caracteres`} />
    </div>
  );
}
