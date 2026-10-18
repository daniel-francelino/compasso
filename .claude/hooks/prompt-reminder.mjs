import { readStdin } from "./lib.mjs";

const input = await readStdin();
const prompt = typeof input.prompt === "string" ? input.prompt : "";

const lines = [
  "Reminder: follow AGENTS.md and docs/standards/base.md (rule IDs). Search for an existing implementation before creating one; do not invent names; if this request conflicts with a documented rule or decision, stop and ask, and update the document first; update docs with the code.",
];

if (/\b(mudar|alterar|trocar|remover|ignor|em vez|ao inv[eé]s|change|replace|instead|ignore)\b/i.test(prompt)) {
  lines.push(
    "This prompt may change a decision already documented: restate the new decision in one line, list the documents and code it invalidates, update the documents first, then adapt the code (base.md section 9.3).",
  );
}

process.stdout.write(`${lines.join("\n")}\n`);
