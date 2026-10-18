import { spawnSync } from "node:child_process";
import { hasScript, projectDir, readStdin, readState, toolsInstalled, writeState } from "./lib.mjs";

const input = await readStdin();
if (input.stop_hook_active === true) process.exit(0);

const state = readState();
const touchedCode = state.src || state.supabase;
if (!touchedCode && !state.docs) process.exit(0);

const problems = [];

if (touchedCode && toolsInstalled()) {
  const scripts = ["lint", "typecheck", "check:consistency"].filter((name) => hasScript(name));
  for (const script of scripts) {
    const result = spawnSync("npm", ["run", "--silent", script], {
      cwd: projectDir,
      encoding: "utf8",
      shell: true,
    });
    if (result.status !== 0 && result.status !== null) {
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().slice(0, 2500);
      problems.push(`npm run ${script} failed:\n${output}`);
    }
  }
}

if (state.docs) {
  const docsCheck = spawnSync("node", ["scripts/check-docs.mjs"], { cwd: projectDir, encoding: "utf8", shell: true });
  if (docsCheck.status !== 0 && docsCheck.status !== null) {
    const output = `${docsCheck.stdout ?? ""}${docsCheck.stderr ?? ""}`.trim().slice(0, 2500);
    problems.push(`The documentation registries are inconsistent (node scripts/check-docs.mjs):\n${output}`);
  }
}

if (touchedCode && !state.docs && !state.stopReminded) {
  problems.push(
    "Code or migrations changed but no document was updated. Apply docs/standards/base.md section 9.2: update the module document (data model / rules / screens) and its 'Implementation status' (files, migrations, validation actually performed, what was NOT tested). If no document is affected, say so explicitly.",
  );
  state.stopReminded = true;
}

if (problems.length === 0) {
  writeState({ src: false, supabase: false, docs: false, stopReminded: false });
  process.exit(0);
}

writeState(state);
process.stderr.write(`Before finishing, resolve these (Definition of Done, base.md section 10):\n\n${problems.join("\n\n")}\n`);
process.exit(2);
