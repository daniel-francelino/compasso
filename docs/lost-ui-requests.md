# Requests to the lost-ui library

> What Aura Creative needs from `lost-ui` (the shared component library, project `lost-ui`, package `@danielsoaresf/lost-ui`) and does not find there yet. Written so that someone can make the change in the library without reading this application. The rule of the project is to ask for what is missing instead of rebuilding it here ([../CLAUDE.md](../CLAUDE.md)). Each request says what the app does **today as a workaround**, so the workaround can be removed when the request is done. Update this document in place: change the status of a request, never create a second list.

## 1. Context

The content editor uses the library block editor (`RichTextEditor`, `lost-ui/editor`, version 0.2.0) for the planning text ("Ideia inicial", [modules/content.md](modules/content.md), decision O19). The text is stored as Tiptap JSON in a **closed set** (bold, italic, headings, bullet and numbered lists, and an `image` node that points to a media version by id). The editor can write more than that, and its image flow returns a URL, so the app adds a bridge around it. The requests below would let the bridge shrink or disappear.

## 2. Requests

| ID | Request | Why the app needs it | Workaround today | Status |
|---|---|---|---|---|
| L1 | **Reference images.** Let `onUploadImage` return `string | { src: string; attrs?: Record<string, unknown> }`, and let the image node declare extra attributes (for example `mediaVersionId`) that are kept in the JSON and in the HTML. | Images live in a private bucket; the database may store only an opaque id, never a signed URL (DATA-15). | The app keeps a map `src → mediaVersionId` and rewrites the JSON on every change. | done in 0.2.1 (adopted 2026-10-30) |
| L2 | **Image source resolver.** A prop such as `resolveImageSrc(node) => string \| Promise<string>` used when the image node renders, so the stored value can be an id and the editor asks for a fresh URL. | Signed URLs expire after a few minutes, so an editor left open shows broken images. | The app signs the URLs when the editor mounts and when it regains focus. | done in 0.2.1 (adopted 2026-10-30) |
| L3 | **Restrict the schema, not only the `/` menu.** A prop such as `allow={{ nodes: [...], marks: [...] }}` that removes the other extensions, so input rules (`> `, ` ``` `, `---`), pasted HTML and keyboard shortcuts cannot create nodes or marks outside the list. Today `blocks` only filters what `/` offers. | The stored format is a closed set (SEC-8); everything else must be impossible to create. | The app normalises the editor output on every change: unknown blocks are unwrapped, unknown marks dropped. | done in 0.2.1 (adopted 2026-10-30) |
| L4 | **Choose the tools of the selection toolbar.** `bubbleMenu={{ tools: ["bold", "italic"] }}` (today it is all tools or a custom render). | The closed set has bold and italic only; the toolbar must not offer underline, strike, code, highlight, colour or link. | The app passes `renderBubbleMenu` with its own two buttons. | done in 0.2.1 (adopted 2026-10-30) |
| L5 | **Image upload by drop and paste.** Dropping or pasting an image file into the text calls `onUploadImage` (several files in a row), not only the `/` block. | The person pastes screenshots while planning. | Not available; only the `/` image block and its file picker are used. | done in 0.2.1 (adopted 2026-10-30) |
| L6 | **Limit and feedback for images.** `maxImages` (the app allows at most 10 images per plan) with a callback when the limit is hit, and an upload state (pending, failed) shown on the placeholder node. | Upload takes seconds for large files; today the person sees nothing. | The app counts the image nodes and refuses extra uploads with a toast. | done in 0.2.1 (adopted 2026-10-30) |
| L7 | **File block.** A block for non-image files (PDF, documents) with the same reference mechanism as L1. Already listed as "not ported" in the library document `docs/editor.md`. | Before O19 the planning accepted PDFs and other references; that is lost until this exists. | None: only images can be attached to a plan. | open |
| L8 | **Read-only rendering of the JSON.** A component that renders the editor JSON (with the L1 attributes and the L2 resolver) without Tiptap, for the client portal. | The portal must show the plan text and its images without loading the editor. | The app has its own `RichTextView` for the closed set. | done in 0.2.1 (adopted 2026-10-30) |
| L9 | **Slash menu crash.** In `EditorSlashMenu` (`editor-slash-menu.tsx`) write `useEffect(() => { active.current?.scrollIntoView({ block: "nearest" }); }, [selected])` (and the same block body for `setSelected(0)`). | Current Chrome returns a Promise from `scrollIntoView`; as the arrow function returns it, React throws `destroy is not a function` and the page shows its error screen when the person moves through the `/` menu. | None. | open (reproduced on 0.2.1) |

## 3. How the app will change when a request is done

- **L1 + L2:** the `src → mediaVersionId` map and the URL signing on focus are deleted from the planning editor bridge.
- **L3 + L4:** the normaliser keeps only a safety net for old content; the custom bubble menu goes away.
- **L5 + L6:** the app stops counting images itself.
- **L7:** non-image references come back to the planning (decision O9 is restored for them).
- **L8:** `RichTextView` is replaced by the library component.

## 4. Open decisions

- Who publishes the library version: the app is pinned to `^0.2.2`; a change needs a new published version and a version bump in `package.json` of this application.
