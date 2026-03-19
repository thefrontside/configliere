import type {
  FieldInfo,
  ParserInfo,
} from "./types.ts";
import { optionKey } from "./parse-args.ts";

export function format(info: ParserInfo<unknown>, name?: string): string {
  let { progname, args, opts, commands } = info.help;
  let sections: string[] = [];

  // usage line
  let label = progname.length ? progname.join(" ") : name ?? "";
  let usage = [`Usage: ${label}`];
  if (commands.length > 0) usage.push("<COMMAND>");
  if (opts.length > 0) usage.push("[OPTIONS]");
  for (let arg of args) {
    usage.push(printArg(arg));
  }
  sections.push(usage.join(" "));

  // commands section
  if (commands.length > 0) {
    let lines = commands.map((cmd) => {
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
  if (args.length > 0) {
    let lines = args.map((arg) => {
      let name = printArg(arg);
      let desc = arg.description ?? "";
      let source = formatSource(arg);
      let right = [desc, source].filter(Boolean).join(" ");
      return `   ${name.padEnd(25)} ${right}`;
    });
    sections.push(["Arguments:", ...lines].join("\n"));
  }

  // options section
  if (opts.length > 0) {
    let lines = opts.map((opt) => {
      let aliases = opt.aliases?.length ? opt.aliases.join(", ") + ", " : "";
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

// --- internal ---

function printArg(info: FieldInfo<unknown>): string {
  let key = info.path.join(".");
  if (info.array) {
    return `<${key}>...`;
  }
  return info.required ? `<${key}>` : `[${key}]`;
}

function formatSource(info: FieldInfo<unknown>): string {
  if (info.source.issues) return "";
  let { sourceType, sourceName, value } = info.source;
  switch (sourceType) {
    case "env": {
      let key = info.path.join("_").toUpperCase();
      return `[env: ${key}=${value}]`;
    }
    case "value":
      return `[${sourceName}: ${info.path.join(".")}=${value}]`;
    case "default":
      return `[default: ${info.default}]`;
    case "none":
      if (info.default !== undefined) {
        return `[default: ${info.default}]`;
      }
      return "";
    default:
      return `[${sourceType}: ${value}]`;
  }
}
