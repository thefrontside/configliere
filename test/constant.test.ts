import { expect } from "@std/expect";
import { constant } from "../lib/constant.ts";
import { createContext } from "../lib/context.ts";

Deno.test("constant emits no claims and returns its value", () => {
  let p = constant("hello");
  let info = p.inspect(createContext({ args: ["x", "y"] }));
  expect(info.claims.length).toBe(0);
  if (info.result.ok) expect(info.result.value).toBe("hello");
});
