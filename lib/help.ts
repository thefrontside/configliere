import type { FieldInfo, HelpInfo } from "./types.ts";
import { optionKey } from "./parse-args.ts";

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

export function merge(...infos: HelpInfo[]): HelpInfo {
  let args: FieldInfo[] = [];
  let opts: FieldInfo[] = [];
  let commands: HelpInfo["commands"] = [];
  for (let info of infos) {
    args.push(...info.args);
    opts.push(...info.opts);
    commands.push(...info.commands);
  }
  return { args, opts, commands };
}

// --- internal ---

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
