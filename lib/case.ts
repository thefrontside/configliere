import type { EnvCase, KebabCase } from "./types.ts";
import { toSnake } from "ts-case-convert";

export function toKebabCase<S extends string>(str: S): KebabCase<S> {
  return toSnake(str).replace("_", "-") as KebabCase<S>;
}

export function toEnvCase<S extends string>(str: S): EnvCase<S> {
  return toSnake(str).toUpperCase() as EnvCase<S>;
}
