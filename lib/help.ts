import type {
  CommandInfo,
  FieldInfo,
  HelpInfo,
  ObjectInfo,
  ParserInfo,
} from "./types.ts";
import { optionKey } from "./parse-args.ts";

export function format(info: ParserInfo, progname: string): string {
  let { args, opts, commands } = classify(info);
  let sections: string[] = [];

  // usage line
  let usage = [`Usage: ${progname}`];
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

export function merge(...infos: ParserInfo[]): ParserInfo {
  let attrs: Record<string, ParserInfo> = {};
  let i = 0;
  for (let info of infos) {
    if (info.type === "object") {
      Object.assign(attrs, (info as ObjectInfo).attrs);
    } else {
      attrs[`_${i++}`] = info;
    }
  }
  return { type: "object", attrs } as ObjectInfo;
}

// --- internal ---

function classify(info: ParserInfo): HelpInfo {
  let args: FieldInfo[] = [];
  let opts: FieldInfo[] = [];
  let commands: CommandInfo[] = [];

  switch (info.type) {
    case "field": {
      let field = info as FieldInfo;
      if (field.argument) {
        args.push(field);
      } else {
        opts.push(field);
      }
      break;
    }
    case "command": {
      commands.push(info as CommandInfo);
      break;
    }
    case "object": {
      for (let child of Object.values((info as ObjectInfo).attrs)) {
        let classified = classify(child);
        args.push(...classified.args);
        opts.push(...classified.opts);
        commands.push(...classified.commands);
      }
      break;
    }
    case "help": {
      let help = info as HelpInfo;
      args.push(...help.args);
      opts.push(...help.opts);
      commands.push(...help.commands);
      break;
    }
  }

  return { type: "help", args, opts, commands };
}

function printArg(info: FieldInfo): string {
  let key = info.path.join(".");
  if (info.array) {
    return `<${key}>...`;
  }
  return info.required ? `<${key}>` : `[${key}]`;
}

function formatSource(info: FieldInfo): string {
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
