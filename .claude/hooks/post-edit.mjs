import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  insideProject,
  projectDir,
  readStdin,
  readState,
  toRelative,
  toolsInstalled,
  writeState,
} from "./lib.mjs";

const input = await readStdin();
const relativePath = toRelative(input.tool_input?.file_path);

if (!insideProject(relativePath)) process.exit(0);

const state = readState();
if (/^src\//.test(relativePath)) state.src = true;
if (/^supabase\//.test(relativePath)) state.supabase = true;
if (/^docs\//.test(relativePath) || /^AGENTS\.md$/.test(relativePath)) state.docs = true;
state.stopReminded = false;
writeState(state);

const checkable = /^src\/.+\.(ts|tsx|css)$/.test(relativePath) && !/routeTree\.gen\.ts$/.test(relativePath);
if (!checkable || !toolsInstalled() || !existsSync(join(projectDir, "package.json"))) process.exit(0);

const run = (args) =>
  spawnSync("npx", ["--no-install", ...args], { cwd: projectDir, encoding: "utf8", shell: true });

run(["prettier", "--write", relativePath]);

if (!/\.(ts|tsx)$/.test(relativePath)) process.exit(0);

const lint = run(["eslint", "--max-warnings", "0", relativePath]);
if (lint.status !== 0 && lint.status !== null) {
  const output = `${lint.stdout ?? ""}${lint.stderr ?? ""}`.trim().slice(0, 3000);
  if (output !== "") {
    process.stderr.write(
      `ESLint found problems in ${relativePath}. Fix the cause (do not add eslint-disable):\n${output}\n`,
    );
    process.exit(2);
  }
}

process.exit(0);
