import { expect } from "@std/expect";
import { type } from "arktype";
import { object } from "../lib/object.ts";
import { option } from "../lib/option.ts";
import { argument } from "../lib/argument.ts";
import { createContext } from "../lib/context.ts";

Deno.test("object claims --foo bar via option child", () => {
  let p = object({ foo: option(type("string")) });
  let info = p.inspect(createContext({ args: ["--foo", "bar"] }));
  expect(info.result.ok).toBe(true);
  if (info.result.ok) expect(info.result.value).toEqual({ foo: "bar" });
});

Deno.test("object threads args remainder between siblings", () => {
  let p = object({
    foo: option(type("string")),
    bar: option(type("string")),
  });
  let info = p.inspect(createContext({ args: ["--foo", "x", "--bar", "y"] }));
  if (info.result.ok) expect(info.result.value).toEqual({ foo: "x", bar: "y" });
});

Deno.test("object projects values per-child", () => {
  let p = object({ foo: option(type("string")) });
  let info = p.inspect(createContext({
    args: [],
    values: [{ name: "config", value: { foo: "from-values" } }],
  }));
  if (info.result.ok) expect(info.result.value).toEqual({ foo: "from-values" });
});

Deno.test("object projects envs by prefixed key", () => {
  let p = object({ foo: option(type("string")) });
  let info = p.inspect(createContext({
    args: [],
    envs: [{ name: "process", value: { FOO: "from-env" } }],
  }));
  if (info.result.ok) expect(info.result.value).toEqual({ foo: "from-env" });
});

Deno.test("nested object extends prefix for envs and values", () => {
  let p = object({
    plugin: object({ name: option(type("string")) }),
  });
  let info = p.inspect(createContext({
    args: [],
    envs: [{ name: "process", value: { PLUGIN_NAME: "x" } }],
  }));
  if (info.result.ok) expect(info.result.value).toEqual({ plugin: { name: "x" } });
});

Deno.test("nested object claims --plugin.name from args", () => {
  let p = object({
    plugin: object({ name: option(type("string")) }),
  });
  let info = p.inspect(createContext({ args: ["--plugin.name", "x"] }));
  if (info.result.ok) expect(info.result.value).toEqual({ plugin: { name: "x" } });
});

Deno.test("object with argument child claims first positional", () => {
  let p = object({
    cmd: argument(type("string")),
    flag: option(type("boolean")),
  });
  let info = p.inspect(createContext({ args: ["mycmd", "--flag"] }));
  if (info.result.ok) expect(info.result.value).toEqual({ cmd: "mycmd", flag: true });
});

Deno.test("siblings cannot doubly-claim the same value path", () => {
  let p = object({
    foo: option(type("string")),
    bar: option(type("string")),
  });
  let info = p.inspect(createContext({
    args: [],
    values: [{ name: "config", value: { foo: "x", bar: "y" } }],
  }));
  if (info.result.ok) expect(info.result.value).toEqual({ foo: "x", bar: "y" });
  // After both children claim, the source's tree is empty
  expect(info.remainder.values).toEqual([{ source: "config", value: {} }]);
});
