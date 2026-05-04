import { expect } from "@std/expect";
import { passthrough } from "../lib/passthrough.ts";
import { createContext } from "../lib/context.ts";

Deno.test("passthrough claims -- and everything after", () => {
  let p = passthrough();
  let info = p.inspect(createContext({ args: ["a", "--", "b", "c"] }));
  expect(info.claims).toEqual([{ type: "arg", from: 1, to: 3 }]);
  if (info.result.ok) expect(info.result.value).toEqual(["b", "c"]);
});

Deno.test("passthrough with no -- emits no claim", () => {
  let p = passthrough();
  let info = p.inspect(createContext({ args: ["a", "b"] }));
  expect(info.claims.length).toBe(0);
  if (info.result.ok) expect(info.result.value).toBe(undefined);
});

Deno.test("passthrough with bare -- claims just the sentinel", () => {
  let p = passthrough();
  let info = p.inspect(createContext({ args: ["a", "--"] }));
  expect(info.claims).toEqual([{ type: "arg", from: 1, to: 1 }]);
  if (info.result.ok) expect(info.result.value).toEqual([]);
});
