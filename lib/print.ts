/**
 * 😵‍💫 This file has been vibe coded 😵‍💫
 */

import type { Param } from "./param.ts";
import type {
  AnyRoute,
  Help,
  Issue,
  MethodNotAllowed,
  RoutePath,
  UnprocessableContent,
  Version,
} from "./types.ts";

export function printHelp<
  const H extends Help<RoutePath>,
>(intent: H): string {
  let route = intent.definition;
  let subject = title(intent);
  let heading = route.version ? `${subject} ${route.version}` : subject;
  let children = route.phases.flatMap((phase) => phase.routes);
  let args: Row[] = [];
  let options: Row[] = [];

  for (let param of params(route)) {
    let syntax = param.cli.syntax;
    if (!syntax) {
      continue;
    }

    let row: Row = [syntax.label, param.description];
    if (syntax.type === "argument") {
      args.push(row);
    } else {
      options.push(row);
    }
  }

  let usage = [subject, "[OPTIONS]", ...args.map(([label]) => label)].join(
    " ",
  );

  if (children.length > 0) {
    usage += route.methods.includes("execute") ? " [COMMAND]" : " <COMMAND>";
  }

  let lines = [heading];
  if (route.description) {
    lines.push(...wrap(route.description, width));
  }

  lines.push("", "Usage:", `  ${usage}`);

  if (args.length > 0) {
    lines.push("", "Arguments:", ...list(args));
  }

  if (children.length > 0) {
    lines.push(
      "",
      "Commands:",
      ...list(children.map((child) => [child.name, child.description])),
    );
  }

  options.push(["-h, --help", "Print help"]);
  if (route.methods.includes("version")) {
    options.push(["-v, --version", "Print version"]);
  }

  lines.push("", "Options:", ...list(options));

  return lines.join("\n");
}

export function printVersion<
  const V extends Version<RoutePath>,
>(intent: V): string {
  let version = intent.definition.version;
  if (!version) {
    throw new TypeError(`route ${JSON.stringify(intent.route)} has no version`);
  }

  return `${title(intent)} ${version}`;
}

export function printErrors(
  result: MethodNotAllowed | UnprocessableContent,
): string {
  let subject = title(result);

  switch (result.code) {
    case "method-not-allowed":
      return [
        `${subject} does not support ${result.method.toUpperCase()}`,
        "",
        "Available methods:",
        ...result.allowed.map((method) => `  ${method.toUpperCase()}`),
      ].join("\n");

    case "unprocessable-content": {
      return result.issues.map(problem).join("\n");
    }
  }
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

function problem(issue: Issue): string {
  let location = address(issue.path);
  return location ? `${location}: ${issue.message}` : message(issue.message);
}

function message(value: string): string {
  if (value.startsWith("unexpected ")) {
    let encoded = value.slice("unexpected ".length);

    try {
      let token = JSON.parse(encoded);
      if (typeof token === "string") {
        return `unexpected: \`${token.replaceAll("`", "\\`")}\``;
      }
    } catch {
      // Keep non-JSON diagnostics intact.
    }
  }

  return value;
}

function address(path: Issue["path"]): string | undefined {
  if (!path || path.length === 0) {
    return;
  }

  let result = "";

  for (let segment of path) {
    let key = typeof segment === "object" && segment !== null
      ? segment.key
      : segment;

    if (typeof key === "number") {
      result += `[${key}]`;
    } else if (typeof key === "symbol") {
      result += `[${String(key)}]`;
    } else if (/^[A-Za-z_$][\w$]*$/.test(key)) {
      result += result ? `.${key}` : key;
    } else {
      result += `[${JSON.stringify(key)}]`;
    }
  }

  return result;
}

const width = 80;
