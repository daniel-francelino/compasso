import { existsSync, readFileSync } from "node:fs";

const ACTIONS_FILE = "src/lib/shared/auth/actions.ts";

const actionKeys = new Set(
  existsSync(ACTIONS_FILE)
    ? [...readFileSync(ACTIONS_FILE, "utf8").matchAll(/"([a-z_]+\.[a-z_]+)"/g)].map(
        (item) => item[1],
      )
    : [],
);

const STATUS_WORDS = new Set([
  "draft",
  "in_production",
  "internal_review",
  "awaiting_approval",
  "changes_requested",
  "approved",
  "published_manually",
  "superseded",
  "cancelled",
]);

const STORAGE = new Set(["localStorage", "sessionStorage"]);
const COMPARISONS = new Set(["===", "!==", "==", "!="]);

export default {
  meta: { type: "suggestion", schema: [] },
  create(context) {
    const file = context.filename.split("\\").join("/");
    const isActions = file.endsWith(ACTIONS_FILE);
    const isStored = file.endsWith("src/lib/shared/stored-keys.ts");
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (!isActions && actionKeys.has(node.value)) {
          context.report({
            node,
            message:
              "Use the Action constant (lib/shared/auth/actions) instead of the permission text.",
          });
        }
        const parent = node.parent;
        if (
          parent.type === "BinaryExpression" &&
          COMPARISONS.has(parent.operator) &&
          STATUS_WORDS.has(node.value)
        ) {
          context.report({
            node,
            message: "Compare with the constant of the status (EditorialStatus…), not with text.",
          });
        }
        if (
          parent.type === "ArrayExpression" &&
          parent.elements[0] === node &&
          parent.parent.type === "Property" &&
          parent.parent.key.name === "queryKey"
        ) {
          context.report({
            node,
            message: "Use QueryKey (lib/shared/query-keys) as the first element of a queryKey.",
          });
        }
      },
      Identifier(node) {
        if (isStored || !STORAGE.has(node.name)) return;
        context.report({
          node,
          message:
            "Use readStored/writeStored (lib/shared/stored-keys), not the browser storage directly.",
        });
      },
    };
  },
};
