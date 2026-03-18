import type { StandardSchemaV1 } from "@standard-schema/spec";

export interface Done<T = unknown, D = unknown> {
  ok: true;
  value: T;
  data: D;
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

export interface FieldData<T> {
  source: Source<T>;
  sources: Source<T>[];
}

export interface Field<T> extends Parser<T> {
  mods: Mods;
  schema: StandardSchemaV1<T>;
  required: boolean;
}

export type Source<T> = {
  issues?: readonly StandardSchemaV1.Issue[];
  value: T;
  sourceType: string;
  sourceName: string;
};

export interface Mods {
  default?: unknown;
  argument: boolean;
  array: boolean;
}
