import type { StandardSchemaV1 } from "@standard-schema/spec";

export interface Step<T, TData> {
  value: T;
  data: TData;
}

export type AnyStep = Step<unknown, unknown>;

export interface Done<V = unknown, D = unknown> {
  ok: true;
  value: V;
  data: D;
  remainder: Input;
}

export interface Fail {
  ok: false;
  error: Error;
  remainder: Input;
}

export interface Next<V, Rest extends [unknown, ...unknown[]]>
  extends Parser<ToSteps<Rest>> {
  ok: true;
  value: V;
  data: unknown;
  remainder: Input;
}

export type ToSteps<Values extends [unknown, ...unknown[]]> = {
  [K in keyof Values]: Step<Values[K], unknown>;
} extends infer U extends [AnyStep, ...AnyStep[]] ? U : never;

export type Increment<Steps extends AnyStep[] = AnyStep[]> = Steps extends
  [infer S extends AnyStep] ? Done<S["value"], S["data"]> | Fail
  : Steps extends
    [infer S extends AnyStep, ...infer Rest extends [AnyStep, ...AnyStep[]]] ?
      | Next<
        S["value"],
        {
          [K in keyof Rest]: Rest[K] extends AnyStep ? Rest[K]["value"] : never;
        } extends infer U extends [unknown, ...unknown[]] ? U : never
      >
      | Fail
  : Done | Fail;

export interface Parser<Steps extends [AnyStep, ...AnyStep[]] = [AnyStep]> {
  path: string[];
  description?: string;
  aliases?: string[];
  parse(input: Input): Increment<Steps>;
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

export interface Field<T> extends Parser<[Step<T, FieldData<T>>]> {
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
