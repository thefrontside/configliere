import type { StandardSchemaV1 } from "@standard-schema/spec";

export type ParseResult<T> = Done<T> | Fail;

export interface Done<T> {
  ok: true;
  value: T;
  remainder: Input;
}

export interface Fail {
  ok: false;
  error: Error;
  remainder: Input;
}

export interface ParseContext {
  progname: string[];
  path: string[];
  commands: Record<string, Parser<Command<unknown, string>>>;
  args: string[];
  values: { name: string; value: unknown }[];
  envs: { name: string; value: Record<string, string> }[];
}

export interface Parser<T, Info extends ParserInfo<T> = ParserInfo<T>> {
  description?: string;
  aliases?: string[];
  parse(input?: Input, ctx?: ParseContext): ParseResult<T>;
  inspect(ctx: ParseContext): Info;
  help(input?: Input, ctx?: ParseContext): string;
}

export type ConfigType<P extends Parser<unknown>> = P extends Parser<infer T>
  ? T
  : never;

export type CommandsType<P extends Parser<Command<unknown, string>>> =
  ConfigType<P>;

export type CommandType<
  P extends Parser<Command<unknown, string>>,
  N extends ConfigType<P>["name"],
> = Extract<ConfigType<P>, { name: N }> extends infer C
  ? { [K in keyof C]: C[K] }
  : never;

export interface Input {
  values?: {
    name: string;
    value: unknown;
  }[];
  envs?: {
    name: string;
    value: Record<string, string>;
  }[];
  args?: string[];
}

export interface HelpInfo {
  progname: string[];
  args: FieldInfo<unknown>[];
  opts: FieldInfo<unknown>[];
  commands: CommandInfo<Command<unknown, string>>[];
}

export interface ParserInfo<T> {
  type: string;
  parser: Parser<T>;
  result: ParseResult<T>;
  remainder: Input;
  help: HelpInfo;
}

export interface FieldInfo<T> extends ParserInfo<T> {
  type: "field";
  path: string[];
  required: boolean;
  argument: boolean;
  array: boolean;
  aliases?: string[];
  description?: string;
  default?: unknown;
  boolean: boolean;
  source: Source<unknown>;
  sources: Source<unknown>[];
}

export interface CommandInfo<T extends Command<unknown, string>>
  extends ParserInfo<T> {
  type: "command";
  name: T["name"];
  description?: string;
  aliases?: string[];
  config: ParserInfo<unknown>;
  commands: Record<string, CommandInfo<Command<unknown, string>>>;
}

export interface ObjectInfo<T extends object> extends ParserInfo<T> {
  type: "object";
  attrs: {
    [K in keyof T]: ParserInfo<T[K]>;
  };
}

export interface ConstantInfo<T> extends ParserInfo<T> {
  type: "constant";
  value: T;
}

export interface CommandsInfo<T extends Command<unknown, string>>
  extends ParserInfo<T> {
  type: "commands";
  commands: { [C in T as C["name"]]: CommandInfo<C> };
}

export type Command<T, Name extends string> =
  | { name: Name; help: true; text: string }
  | { name: Name; help?: false; config: T };

export interface Field<T> extends Parser<T, FieldInfo<T>> {
  schema: StandardSchemaV1<T>;
  required: boolean;
  argument: boolean;
  array: boolean;
  boolean: boolean;
  default?: unknown;
}

export type Source<T> = {
  issues?: readonly StandardSchemaV1.Issue[];
  value: T;
  sourceType: string;
  sourceName: string;
};
