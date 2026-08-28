/**
 * 😵‍💫 This file has been vibe coded 😵‍💫
 */

import type { Param } from "./param.ts";
import type { Flag } from "./tokenize.ts";
import { Tokenizer } from "./tokenizer.ts";
import type { AnyRoute, Help, RoutePath, Version } from "./types.ts";

export function printHelp<
  const H extends Help<AnyRoute, RoutePath>,
>(intent: H): string {
  let route = intent.definition;
  let subject = title(intent);
  let heading = route.version ? `${subject} ${route.version}` : subject;
  let usage = `${subject} [OPTIONS]`;

  if (route.children.length > 0) {
    usage += route.methods.includes("execute") ? " [COMMAND]" : " <COMMAND>";
  }

  let lines = [heading];
  if (route.description) {
    lines.push(...wrap(route.description, width));
  }

  lines.push("", "Usage:", `  ${usage}`);

  if (route.children.length > 0) {
    lines.push(
      "",
      "Commands:",
      ...list(route.children.map((child) => [child.name, child.description])),
    );
  }

  let options: Row[] = params(route).map((param) => [
    label(param),
    param.description,
  ]);

  options.push(["-h, --help", "Print help"]);
  if (route.methods.includes("version")) {
    options.push(["-v, --version", "Print version"]);
  }

  lines.push("", "Options:", ...list(options));

  return lines.join("\n");
}

export function printVersion<
  const V extends Version<AnyRoute, RoutePath>,
>(intent: V): string {
  let version = intent.definition.version;
  if (!version) {
    throw new TypeError(`route ${JSON.stringify(intent.route)} has no version`);
  }

  return `${title(intent)} ${version}`;
}

type Row = readonly [label: string, description?: string];

function params(route: AnyRoute): Param<string, unknown>[] {
  return route.phases.flatMap((phase) =>
    Object.values(phase.params) as Param<string, unknown>[]
  );
}

function title(intent: {
  readonly path: readonly string[];
  readonly definition: AnyRoute;
}): string {
  return intent.path.length > 0
    ? intent.path.join(" ")
    : intent.definition.name;
}

function list(rows: readonly Row[]): string[] {
  let size = Math.max(...rows.map(([label]) => label.length));
  let available = Math.max(24, width - size - 4);
  let lines: string[] = [];

  for (let [label, description] of rows) {
    let prefix = `  ${label.padEnd(size)}`;
    if (!description) {
      lines.push(prefix.trimEnd());
      continue;
    }

    let [first, ...rest] = wrap(description, available);
    lines.push(`${prefix}  ${first}`);
    lines.push(...rest.map((line) => `${" ".repeat(size + 4)}${line}`));
  }

  return lines;
}

function wrap(text: string, size: number): string[] {
  let words = text.trim().split(/\s+/);
  let lines: string[] = [];
  let line = "";

  for (let word of words) {
    if (line.length === 0) {
      line = word;
    } else if (line.length + word.length + 1 <= size) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function label(param: Param<string, unknown>): string {
  let stem = dash(param.name);
  let yes = `--${stem}`;
  let no = `--no-${stem}`;
  let positive = boolean(param, yes);
  let negative = boolean(param, no);

  return typeof positive === "boolean"
    ? negative === false ? `${yes}, ${no}` : yes
    : `--${param.name} <VALUE>`;
}

function boolean(
  param: Param<string, unknown>,
  text: string,
): boolean | undefined {
  let flag: Flag = {
    type: "flag",
    index: 0,
    text,
    flagText: text.slice(text.startsWith("--") ? 2 : 1),
    flagType: text.startsWith("--") ? "long" : "short",
  };
  let read = param.cli(new Tokenizer([flag]));

  return read.result.ok && read.result.value.exists &&
      typeof read.result.value.value === "boolean"
    ? read.result.value.value
    : undefined;
}

function dash(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

const width = 80;
