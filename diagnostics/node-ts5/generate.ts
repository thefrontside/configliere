import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("./fixtures/generated/", import.meta.url));
const sizes = [5, 20, 30, 50, 75, 100, 101];
const modes = ["static", "checkpoint"] as const;

await mkdir(output, { recursive: true });

for (const entry of await readdir(output)) {
  if (entry.endsWith(".ts")) await unlink(`${output}${entry}`);
}

for (const size of sizes) {
  for (const mode of modes) {
    const prefix = mode === "static" ? "" : `${mode}-`;
    const file = `${output}${prefix}options-${
      String(size).padStart(3, "0")
    }.ts`;
    await writeFile(file, source(size, mode));
    console.log(`generated ${file}`);
  }
}

function source(size: number, mode: (typeof modes)[number]) {
  const split = Math.floor(size / 2);
  const lines = Array.from({ length: size }, (_, index) => {
    const field = String(index + 1).padStart(3, "0");
    return `  option(name("p${field}"), description("p${field}"), cli(["--p${field}"]), schema(z.number())),`;
  });
  const fields = mode === "checkpoint"
    ? [...lines.slice(0, split), "  checkpoint(),", ...lines.slice(split)].join(
      "\n",
    )
    : lines.join("\n");
  const imports = mode === "checkpoint" ? "checkpoint, " : "";
  const prefix = mode === "static" ? "" : `${mode}-`;

  return `import { ${imports}cli, command, description, name, option } from "../../../../mod.ts";
import { schema } from "../../../../lib/param.ts";
import { z } from "zod";

export const app = command(
  name("${prefix}options-${size}"),
${fields}
);
`;
}
