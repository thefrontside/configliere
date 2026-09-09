import { readdir, unlink, writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const dir = fileURLToPath(new URL(".", import.meta.url));
const tsc = fileURLToPath(
  new URL("./node_modules/typescript/bin/tsc", import.meta.url),
);
const config = fileURLToPath(
  new URL("./.diagnostic.tsconfig.json", import.meta.url),
);
const examples = fileURLToPath(new URL("../../examples/", import.meta.url));
const generated = fileURLToPath(
  new URL("./fixtures/generated/", import.meta.url),
);

let failed = false;
const files = [
  ...(await filesIn(examples)),
  ...(await filesIn(generated, true)),
];

try {
  for (const file of files) {
    const path = relative(dir, file);
    await writeFile(
      config,
      JSON.stringify({
        extends: "./tsconfig.json",
        files: [path],
      }),
    );

    const result = spawnSync(process.execPath, [
      tsc,
      "--extendedDiagnostics",
      "--project",
      config,
      "--pretty",
      "false",
    ], { cwd: dir, encoding: "utf8" });

    const output = `${result.stdout}${result.stderr}`;
    const instantiations = match(output, /^Instantiations:\s+(.+)$/m);
    const checkTime = match(output, /^Check time:\s+(.+)$/m);
    const error = output.match(/^.*error TS\d+:.*$/m)?.[0];
    const status = result.status === 0 ? "PASS" : "FAIL";

    console.log(
      `${path.padEnd(34)} ${status}  ` +
        `instantiations=${instantiations ?? "n/a"}  ` +
        `check=${checkTime ?? "n/a"}`,
    );
    if (error) console.log(`             ${error}`);
    failed ||= result.status !== 0;
  }
} finally {
  await unlink(config).catch(() => {});
}

if (failed) process.exitCode = 1;

function match(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim();
}

async function filesIn(dir: string, optional = false): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => `${dir}${entry.name}`)
      .sort();
  } catch (error) {
    if (
      optional &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) return [];
    throw error;
  }
}
