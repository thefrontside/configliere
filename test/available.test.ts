import { expect } from "@std/expect";
import { subtractArgs, emptyAvailable, isEmpty } from "../lib/available.ts";
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
