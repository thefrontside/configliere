import type { Field, FieldData, Parser } from "./types.ts";
import { isBoolean, optionKey } from "./parse-args.ts";

export interface FieldInfo {
  path: string[];
  required: boolean;
  argument: boolean;
  array: boolean;
  aliases: string[];
  description?: string;
  default?: unknown;
  boolean: boolean;
  source?: {
    value: unknown;
    sourceName: string;
    sourceType: string;
  };
}

export interface CommandInfo {
  name: string;
  description?: string;
  aliases?: string[];
  args: FieldInfo[];
  opts: FieldInfo[];
}

export interface HelpInfo {
  args: FieldInfo[];
  opts: FieldInfo[];
  commands: CommandInfo[];
}

export function inspect(
  parser: Parser,
  data?: unknown,
): HelpInfo {
  let fields = collect(parser);
  let args: FieldInfo[] = [];
  let opts: FieldInfo[] = [];

  for (let { key, field } of fields) {
    let info = fieldInfo(key, field, data);
    if (field.mods.argument) {
      args.push(info);
    } else {
      opts.push(info);
    }
  }

  let commands = collectCommands(parser, data);

  return { args, opts, commands };
}

function fieldInfo(
  key: string,
  field: Field<unknown>,
  data?: unknown,
): FieldInfo {
  let info: FieldInfo = {
    path: field.path.length > 0 ? field.path : [key],
    required: field.required,
    argument: field.mods.argument,
    array: field.mods.array,
    aliases: field.aliases ?? [],
    description: field.description,
    default: field.mods.default,
    boolean: isBoolean(field.schema),
  };

  let source = findSource(key, data);
  if (source) {
    info.source = {
      value: source.value,
      sourceName: source.sourceName,
      sourceType: source.sourceType,
    };
  }

  return info;
}

function collect(parser: Parser): { key: string; field: Field<unknown> }[] {
  // if it's a field itself, use its path or a default key
  if (isField(parser)) {
    let key = parser.path.length > 0 ? parser.path[0] : "value";
    return [{ key, field: parser }];
  }

  // if it has attrs (object parser), walk them
  if ("attrs" in parser) {
    let attrs = parser.attrs as Record<string, Parser>;
    let result: { key: string; field: Field<unknown> }[] = [];
    for (let [key, child] of Object.entries(attrs)) {
      if (isField(child)) {
        result.push({ key, field: child });
      } else {
        result.push(...collect(child));
      }
    }
    return result;
  }

  // if it has parsers (sequence parser), walk all phases
  if ("parsers" in parser) {
    let parsers = parser.parsers as Parser[];
    let seen = new Set<string>();
    let result: { key: string; field: Field<unknown> }[] = [];
    for (let child of parsers) {
      for (let entry of collect(child)) {
        if (!seen.has(entry.key)) {
          seen.add(entry.key);
          result.push(entry);
        }
      }
    }
    return result;
  }

  // if it's a single command, walk the inner parser
  if ("name" in parser && "parser" in parser) {
    return collect(parser.parser as Parser);
  }

  return [];
}

function collectCommands(parser: Parser, data?: unknown): CommandInfo[] {
  // if it has commands (commands parser), enumerate them
  if ("commands" in parser) {
    let cmds = parser.commands as Record<
      string,
      Parser & { name: string; parser: Parser }
    >;
    return Object.entries(cmds).map(([name, cmd]) => {
      let fields = collect(cmd.parser);
      let args: FieldInfo[] = [];
      let opts: FieldInfo[] = [];
      for (let { key, field } of fields) {
        let info = fieldInfo(key, field, data);
        if (field.mods.argument) {
          args.push(info);
        } else {
          opts.push(info);
        }
      }
      return {
        name,
        description: cmd.parser.description,
        aliases: cmd.parser.aliases,
        args,
        opts,
      };
    });
  }

  // if it has parsers (sequence), check each phase for commands
  if ("parsers" in parser) {
    let parsers = parser.parsers as Parser[];
    for (let child of parsers) {
      let cmds = collectCommands(child, data);
      if (cmds.length > 0) return cmds;
    }
  }

  return [];
}

function isField(parser: Parser): parser is Field<unknown> {
  return "mods" in parser;
}

function findSource(
  key: string,
  data: unknown | undefined,
): FieldData<unknown>["source"] | undefined {
  if (!data) return undefined;

  // sequence data is an array — search in reverse (last phase wins)
  let items: unknown[] = Array.isArray(data) ? [...data].reverse() : [data];

  for (let item of items) {
    if (item && typeof item === "object" && key in item) {
      let fieldData = (item as Record<string, FieldData<unknown>>)[key];
      let source = fieldData?.source;
      if (source && source.sourceType !== "none") {
        return source;
      }
    }
  }

  return undefined;
}

export function format(info: HelpInfo, progname: string): string {
  let sections: string[] = [];

  // usage line
  let usage = [`Usage: ${progname}`];
  if (info.commands.length > 0) usage.push("<COMMAND>");
  if (info.opts.length > 0) usage.push("[OPTIONS]");
  for (let arg of info.args) {
    usage.push(printArg(arg));
  }
  sections.push(usage.join(" "));

  // commands section
  if (info.commands.length > 0) {
    let lines = info.commands.map((cmd) => {
      let label = cmd.name;
      if (cmd.aliases && cmd.aliases.length > 0) {
        label += ` (${cmd.aliases.join(", ")})`;
      }
      let desc = cmd.description ?? "";
      return `   ${label.padEnd(25)} ${desc}`;
    });
    sections.push(["Commands:", ...lines].join("\n"));
  }

  // arguments section
  if (info.args.length > 0) {
    let lines = info.args.map((arg) => {
      let name = printArg(arg);
      let desc = arg.description ?? "";
      let source = formatSource(arg);
      let right = [desc, source].filter(Boolean).join(" ");
      return `   ${name.padEnd(25)} ${right}`;
    });
    sections.push(["Arguments:", ...lines].join("\n"));
  }

  // options section
  if (info.opts.length > 0) {
    let lines = info.opts.map((opt) => {
      let aliases = opt.aliases.length ? opt.aliases.join(", ") + ", " : "";
      let key = optionKey(opt.path);
      let value = opt.boolean ? "" : " " + printArg(opt).toUpperCase();
      let optStr = `${aliases}${key}${value}`;
      let desc = opt.description ?? "";
      let source = formatSource(opt);
      let right = [desc, source].filter(Boolean).join(" ");
      return `   ${optStr.padEnd(25)} ${right}`;
    });
    sections.push(["Options:", ...lines].join("\n"));
  }

  return sections.join("\n\n");
}

function printArg(info: FieldInfo): string {
  let key = info.path.join(".");
  if (info.array) {
    return `<${key}>...`;
  }
  return info.required ? `<${key}>` : `[${key}]`;
}

function formatSource(info: FieldInfo): string {
  if (info.source) {
    let { sourceType, sourceName, value } = info.source;
    if (sourceType === "env") {
      let key = info.path.join("_").toUpperCase();
      return `[env: ${key}=${value}]`;
    } else if (sourceType === "object") {
      return `[${sourceName}: ${info.path.join(".")}=${value}]`;
    } else {
      return `[${sourceType}: ${value}]`;
    }
  }
  if (info.default !== undefined) {
    return `[default: ${info.default}]`;
  }
  return "";
}
