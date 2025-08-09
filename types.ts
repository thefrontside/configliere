import { StandardSchemaV1 } from "@standard-schema/spec";
import type { Type } from "arktype";
import type { ToSnake } from "ts-case-convert";

export type Spec = {
  [key: string]: FieldSpec<unknown>;
};

export type FieldSpec<T> = {
  schema: Type<T>;
};

export type Field<S extends Spec, K extends keyof S> = K extends string ? {
    name: K;
    spec: S[K];
    envName(): EnvCase<K>;
    optionName(): KebabCase<K>;
  }
  : never;

export interface Inputs {
  objects?: ObjectInput[];
  env?: Record<string, string>;
  args?: string[];
}

export interface ObjectInput {
  value: Record<string, unknown>;
  source: string;
}

export type Config<S extends Spec> = {
  [K in keyof S]: StandardSchemaV1.InferOutput<S[K]["schema"]>;
};

export type Sources<S extends Spec> = {
  [K in keyof S]: Source<S, K>;
};

export type Source<S extends Spec, K extends keyof S> = {
  type: "none";
  key: K;
} | {
  type: "object";
  key: K;
  value: unknown;
  name: string;
} | {
  type: "env";
  key: K;
  envKey: string;
  stringvalue: string;
};

export type Issue<S extends Spec, K extends keyof S = keyof S> = {
  field: Field<S, K>;
  message: string;
  source: Source<S, K>;
};

export type ParseResult<S extends Spec> = {
  ok: true;
  sources: Sources<S>;
  config: Config<S>;
} | {
  ok: false;
  sources: Sources<S>;
  issues: Issue<S>[];
};

export type EnvCase<S extends string> = Uppercase<ToSnake<S>>;

export type KebabCase<S extends string> = ToSnake<S> extends
  `${infer Head}_${infer Tail}` ? `${Head}-${KebabCase<Tail>}` : S;
