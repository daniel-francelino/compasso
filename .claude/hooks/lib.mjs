import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export const projectDir = resolve(process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd());

export const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const toRelative = (filePath) => {
  if (typeof filePath !== "string" || filePath === "") return "";
  const absolute = resolve(projectDir, filePath);
  return relative(projectDir, absolute).split(sep).join("/");
};

export const insideProject = (relativePath) =>
  relativePath !== "" && !relativePath.startsWith("..") && !relativePath.startsWith("/");

export const incomingText = (toolInput) => {
  if (typeof toolInput?.content === "string") return toolInput.content;
  const parts = [];
  if (typeof toolInput?.new_string === "string") parts.push(toolInput.new_string);
  if (Array.isArray(toolInput?.edits)) {
    for (const edit of toolInput.edits) {
      if (typeof edit?.new_string === "string") parts.push(edit.new_string);
    }
  }
  return parts.join("\n");
};

const stateFile = join(projectDir, ".claude", ".state", "changes.json");

export const readState = () => {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    return { src: false, supabase: false, docs: false, stopReminded: false };
  }
};

export const writeState = (state) => {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state));
};

export const hasScript = (name) => {
  try {
    const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
    return typeof pkg?.scripts?.[name] === "string";
  } catch {
    return false;
  }
};

export const toolsInstalled = () => existsSync(join(projectDir, "node_modules"));
