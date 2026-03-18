import type { StandardSchemaV1 } from "@standard-schema/spec";

export type ParseResult<T> = Done<T> | Fail;

export interface Done<T = unknown> {
  ok: true;
  value: T;
  remainder: Input;
}

export interface Fail {
  ok: false;
  error: Error;
  remainder: Input;
}

export interface Parser<T = unknown> {
  path: string[];
  description?: string;
  aliases?: string[];
  parse(input: Input): Done<T> | Fail;
  inspect(input?: Input): ParserInfo;
  help(input?: Input): string;
}

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

export interface ParserInfo {
  type: string;
}

export interface FieldInfo extends ParserInfo {
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

export interface CommandInfo extends ParserInfo {
  type: "command";
  name: string;
  description?: string;
  aliases?: string[];
  config: ParserInfo;
}

export interface ObjectInfo extends ParserInfo {
  type: "object";
  attrs: Record<string, ParserInfo>;
}

export interface ConstantInfo<T = unknown> extends ParserInfo {
  type: "constant";
  value: T;
}

export interface HelpInfo extends ParserInfo {
  type: "help";
  args: FieldInfo[];
  opts: FieldInfo[];
  commands: CommandInfo[];
}

export interface Field<T> extends Parser<T>, FieldInfo {
  schema: StandardSchemaV1<T>;
  inspect(input?: Input): FieldInfo;
}

export type Source<T> = {
  issues?: readonly StandardSchemaV1.Issue[];
  value: T;
  sourceType: string;
  sourceName: string;
};

