import { expect } from "@std/expect";
import { subtractArgs, subtract, emptyAvailable, isEmpty } from "../lib/available.ts";
import type { AvailableInput, Token } from "../lib/types.ts";

Deno.test("subtractArgs removes claimed args by index", () => {
  let av: AvailableInput = {
    args: [{ index: 0, value: "a" }, { index: 1, value: "b" }, { index: 2, value: "c" }],
    values: [],
    envs: [],
  };
  let claims: Token[] = [{ type: "arg", from: 1, to: 1 }];
  let result = subtractArgs(av, claims);
  expect(result.args).toEqual([{ index: 0, value: "a" }, { index: 2, value: "c" }]);
});

Deno.test("subtractArgs removes range of args", () => {
  let av: AvailableInput = {
    args: [{ index: 0, value: "a" }, { index: 1, value: "b" }, { index: 2, value: "c" }],
    values: [],
    envs: [],
  };
  let claims: Token[] = [{ type: "arg", from: 0, to: 1 }];
  let result = subtractArgs(av, claims);
  expect(result.args).toEqual([{ index: 2, value: "c" }]);
});

Deno.test("subtractArgs ignores non-arg tokens", () => {
  let av: AvailableInput = {
    args: [{ index: 0, value: "a" }],
    values: [{ source: "config", value: { x: 1 } }],
    envs: [],
  };
  let claims: Token[] = [{ type: "value", source: "config", path: ["x"] }];
  let result = subtractArgs(av, claims);
  expect(result.args).toEqual([{ index: 0, value: "a" }]);
  expect(result.values).toBe(av.values);
});

Deno.test("emptyAvailable is empty", () => {
  expect(isEmpty(emptyAvailable())).toBe(true);
});

Deno.test("subtract removes value path from source tree", () => {
  let av: AvailableInput = {
    args: [],
    values: [{ source: "config", value: { foo: "x", bar: "y" } }],
    envs: [],
  };
  let claims: Token[] = [{ type: "value", source: "config", path: ["foo"] }];
  let result = subtract(av, claims);
  expect(result.values).toEqual([{ source: "config", value: { bar: "y" } }]);
});

Deno.test("subtract removes nested value path", () => {
  let av: AvailableInput = {
    args: [],
    values: [{ source: "config", value: { plugin: { name: "x", version: "1" } } }],
    envs: [],
  };
  let claims: Token[] = [{ type: "value", source: "config", path: ["plugin", "name"] }];
  let result = subtract(av, claims);
  expect(result.values).toEqual([
    { source: "config", value: { plugin: { version: "1" } } },
  ]);
});

Deno.test("subtract removes env name from source", () => {
  let av: AvailableInput = {
    args: [],
    values: [],
    envs: [{ source: "process", value: { PORT: "8080", HOST: "x" } }],
  };
  let claims: Token[] = [{ type: "env", source: "process", name: "PORT" }];
  let result = subtract(av, claims);
  expect(result.envs).toEqual([{ source: "process", value: { HOST: "x" } }]);
});

Deno.test("subtract leaves untouched sources alone", () => {
  let av: AvailableInput = {
    args: [],
    values: [
      { source: "a", value: { x: 1 } },
      { source: "b", value: { y: 2 } },
    ],
    envs: [],
  };
  let claims: Token[] = [{ type: "value", source: "a", path: ["x"] }];
  let result = subtract(av, claims);
  expect(result.values).toEqual([
    { source: "a", value: {} },
    { source: "b", value: { y: 2 } },
  ]);
});
