import { expect } from "@std/expect";
import { type } from "arktype";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";
import type { ParseContext, Prefix } from "../lib/types.ts";

function ctx(
  args: string[] = [],
  values: { name: string; value: unknown }[] = [],
  envs: { name: string; value: Record<string, string> }[] = [],
  prefix: Prefix = { values: ["foo"], envs: "FOO_", args: ["foo"] },
): ParseContext {
  let c = createContext({ args, values, envs });
  return { ...c, prefix };
}

Deno.test("option claims --foo VAL from args", () => {
  let p = option(type("string"));
  let info = p.inspect(ctx(["--foo", "bar"]));
  expect(info.result.ok).toBe(true);
  if (info.result.ok) expect(info.result.value).toBe("bar");
  expect(info.claims.length).toBe(1);
  expect(info.claims[0]).toEqual({ type: "arg", from: 0, to: 1 });
});

Deno.test("option claims --foo=VAL from args", () => {
  let p = option(type("string"));
  let info = p.inspect(ctx(["--foo=bar"]));
  expect(info.claims[0]).toEqual({ type: "arg", from: 0, to: 0 });
  if (info.result.ok) expect(info.result.value).toBe("bar");
});

Deno.test("option boolean claims --foo as true", () => {
  let p = option(type("boolean"));
  let info = p.inspect(ctx(["--foo"]));
  expect(info.claims[0]).toEqual({ type: "arg", from: 0, to: 0 });
  if (info.result.ok) expect(info.result.value).toBe(true);
});

Deno.test("option boolean claims --no-foo as false", () => {
  let p = option(type("boolean"));
  let info = p.inspect(ctx(["--no-foo"]));
  expect(info.claims[0]).toEqual({ type: "arg", from: 0, to: 0 });
  if (info.result.ok) expect(info.result.value).toBe(false);
});

Deno.test("option scans past leading non-matching tokens", () => {
  let p = option(type("string"));
  let info = p.inspect(ctx(["other", "--foo", "bar"]));
  expect(info.claims[0]).toEqual({ type: "arg", from: 1, to: 2 });
});

Deno.test("option claims from values source by path", () => {
  let p = option(type("string"));
  let info = p.inspect(ctx([], [{ name: "config", value: { foo: "from-values" } }]));
  expect(info.claims.length).toBe(1);
  expect(info.claims[0]).toEqual({ type: "value", source: "config", path: ["foo"] });
  if (info.result.ok) expect(info.result.value).toBe("from-values");
});

Deno.test("option claims from envs source by name", () => {
  let p = option(type("string"));
  let info = p.inspect(ctx([], [], [{ name: "process", value: { FOO: "from-env" } }]));
  expect(info.claims.length).toBe(1);
  expect(info.claims[0]).toEqual({ type: "env", source: "process", name: "FOO" });
});

Deno.test("option cli wins over env wins over value", () => {
  let p = option(type("string"));
  let info = p.inspect(ctx(
    ["--foo", "from-cli"],
    [{ name: "config", value: { foo: "from-values" } }],
    [{ name: "process", value: { FOO: "from-env" } }],
  ));
  if (info.result.ok) expect(info.result.value).toBe("from-cli");
});

Deno.test("option does not match when no source", () => {
  let p = option(type("string | undefined"));
  let info = p.inspect(ctx([]));
  expect(info.claims.length).toBe(0);
});

Deno.test("option uses prefix.envs to compute env name (nested case)", () => {
  let p = option(type("string"));
  let info = p.inspect({
    ...ctx([], [], [{ name: "process", value: { PLUGIN_FOO: "from-env" } }]),
    prefix: { values: ["plugin", "foo"], envs: "PLUGIN_FOO_", args: ["plugin", "foo"] },
  });
  expect(info.claims).toEqual([{ type: "env", source: "process", name: "PLUGIN_FOO" }]);
  if (info.result.ok) expect(info.result.value).toBe("from-env");
});
