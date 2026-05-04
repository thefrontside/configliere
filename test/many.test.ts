import { expect } from "@std/expect";
import { type } from "arktype";
import { many } from "../lib/many.ts";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";
import type { ParseContext, Prefix } from "../lib/types.ts";

function ctx(args: string[] = []): ParseContext {
  let c = createContext({ args });
  let prefix: Prefix = { values: ["foo"], envs: "FOO_", args: ["foo"] };
  return { ...c, prefix };
}

Deno.test("many claims multiple --foo VAL pairs", () => {
  let p = many(option(type("string")));
  let info = p.inspect(ctx(["--foo", "a", "--foo", "b", "--foo", "c"]));
  if (info.result.ok) expect(info.result.value).toEqual(["a", "b", "c"]);
  expect(info.iterations.length).toBe(3);
});

Deno.test("many with no matches yields empty array", () => {
  let p = many(option(type("string")));
  let info = p.inspect(ctx(["--bar", "x"]));
  if (info.result.ok) expect(info.result.value).toEqual([]);
});
