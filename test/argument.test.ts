import { expect } from "@std/expect";
import { type } from "arktype";
import { argument } from "../lib/argument.ts";
import { createContext } from "../lib/context.ts";
import type { ParseContext, Prefix } from "../lib/types.ts";

function ctx(args: string[] = []): ParseContext {
  let c = createContext({ args });
  let prefix: Prefix = { values: ["x"], envs: "X_", args: ["x"] };
  return { ...c, prefix };
}

Deno.test("argument claims first non-dash token", () => {
  let p = argument(type("string"));
  let info = p.inspect(ctx(["foo", "--bar"]));
  expect(info.claims).toEqual([{ type: "arg", from: 0, to: 0 }]);
  if (info.result.ok) expect(info.result.value).toBe("foo");
});

Deno.test("argument scans past leading dash tokens", () => {
  let p = argument(type("string"));
  let info = p.inspect(ctx(["--bar", "foo"]));
  expect(info.claims).toEqual([{ type: "arg", from: 1, to: 1 }]);
  if (info.result.ok) expect(info.result.value).toBe("foo");
});

Deno.test("argument with no positional emits no claim", () => {
  let p = argument(type("string"), { default: "x" });
  let info = p.inspect(ctx(["--foo"]));
  expect(info.claims.length).toBe(0);
  if (info.result.ok) expect(info.result.value).toBe("x");
});

Deno.test("argument does not claim from values or envs", () => {
  let p = argument(type("string"));
  let c = createContext({
    args: [],
    values: [{ name: "config", value: { x: "from-values" } }],
    envs: [{ name: "process", value: { X: "from-env" } }],
  });
  let info = p.inspect({ ...c, prefix: { values: ["x"], envs: "X_", args: ["x"] } });
  expect(info.claims.length).toBe(0);
});
