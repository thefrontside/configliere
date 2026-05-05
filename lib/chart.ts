import type {
  AvailableInput,
  Input,
  ParserInfo,
  Token,
} from "./types.ts";
import { toAvailable } from "./context.ts";

export function chart<T>(info: ParserInfo<T>, input: Input): string {
  let av = toAvailable(input);
  let lines: string[] = [];
  lines.push("input:");
  lines.push(
    "  args:    " +
      av.args.map((a) => `[${a.index}] ${JSON.stringify(a.value)}`).join("  "),
  );
  if (av.values.length) {
    for (let v of av.values) {
      lines.push(`  values:  [${v.source}] ${JSON.stringify(v.value)}`);
    }
  }
  if (av.envs.length) {
    for (let e of av.envs) {
      lines.push(`  envs:    [${e.source}] ${formatEnvs(e.value)}`);
    }
  }
  lines.push("");
  lines.push("parse:");
  renderNode(info as ParserInfo<unknown>, input, "", lines);
  lines.push("");
  lines.push("remainder:");
  lines.push(
    "  args:    " +
      (info.remainder.args.length
        ? info.remainder.args.map((a) =>
          `[${a.index}] ${JSON.stringify(a.value)}`
        ).join("  ")
        : "∅"),
  );
  lines.push(
    "  values:  " +
      (info.remainder.values.length
        ? info.remainder.values.map((v) => `[${v.source}]`).join(", ")
        : "∅"),
  );
  lines.push(
    "  envs:    " +
      (info.remainder.envs.length
        ? info.remainder.envs.map((e) => `[${e.source}]`).join(", ")
        : "∅"),
  );
  return lines.join("\n");
}

// --- internal ---

function renderNode(
  info: ParserInfo<unknown>,
  input: Input,
  indent: string,
  out: string[],
): void {
  let label = info.type;
  if (info.claims.length === 0) {
    out.push(`${indent}${label}  ⊘`);
  } else {
    out.push(`${indent}${label}`);
    out.push(`${indent}  claims:`);
    for (let claim of info.claims) {
      out.push(`${indent}    ${formatClaim(claim, input)}`);
    }
  }
  if ("attrs" in info) {
    let attrs = (info as unknown as { attrs: Record<string, ParserInfo<unknown>> }).attrs;
    for (let [k, child] of Object.entries(attrs)) {
      out.push(`${indent}  ├─ "${k}" →`);
      renderNode(child, input, indent + "  │  ", out);
    }
  }
  if ("commands" in info) {
    let cmds = (info as unknown as { commands: Record<string, ParserInfo<unknown>> }).commands;
    for (let [k, child] of Object.entries(cmds)) {
      out.push(`${indent}  └─ "${k}" →`);
      renderNode(child, input, indent + "     ", out);
    }
  }
  if ("main" in info) {
    let main = (info as unknown as { main: ParserInfo<unknown> }).main;
    out.push(`${indent}  └─`);
    renderNode(main, input, indent + "     ", out);
  }
}

function formatClaim(t: Token, input: Input): string {
  if (t.type === "arg") {
    let slice = (input.args ?? []).slice(t.from, t.to + 1).map((s) =>
      JSON.stringify(s)
    ).join(" ");
    return `args   [${t.from}..${t.to}] ${slice}`;
  }
  if (t.type === "value") {
    return `values [${t.source}:.${t.path.join(".")}]`;
  }
  return `envs   [${t.source}:${t.name}]`;
}

function formatEnvs(env: Record<string, string>): string {
  return Object.entries(env).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(
    " ",
  );
}
