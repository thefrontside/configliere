import type { Envs } from "./env.ts";
import type { Symbol } from "./read.ts";
import type { Tokenizer } from "./tokenizer.ts";
import type { Values } from "./values.ts";

export interface Rest {
  readonly tokens: Tokenizer<Symbol>;
  readonly values: Values;
  readonly envs: Envs;
}
