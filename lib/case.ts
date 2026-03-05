import { type ToSnake, toSnake } from "ts-case-convert";

export type EnvCase<S extends string> = Uppercase<ToSnake<S>>;

export type KebabCase<S extends string> = ToSnake<S> extends
  `${infer Head}_${infer Tail}` ? `${Head}-${KebabCase<Tail>}` : S;

export function toKebabCase<S extends string>(str: S): KebabCase<S> {
  return toSnake(str).replaceAll("_", "-") as KebabCase<S>;
}

export function toEnvCase<S extends string>(str: S): EnvCase<S> {
  return toSnake(str).toUpperCase() as EnvCase<S>;
}
