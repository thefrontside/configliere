import { expect } from "@std/expect";
import { type } from "arktype";
import { inject } from "../lib/inject.ts";
import { object } from "../lib/object.ts";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";

Deno.test("inject produces parser-factory dependent on injected value", () => {
  let p = inject<{ host: string }, string>((prefix) =>
    object({ host: option(type("string"), { default: prefix }) })
  );

  let info = p.inspect(createContext({ args: [] }));
  expect(info.result.ok).toBe(true);
  if (info.result.ok) {
    let factory = info.result.value;
    let inner = factory("localhost");
    let r = inner.parse({ args: ["--host", "example.com"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ host: "example.com" });
  }
});

Deno.test("inject result is always ok and emits no claims", () => {
  let p = inject<{ x: string }, number>((n) => object({ x: option(type("string"), { default: String(n) }) }));
  let info = p.inspect(createContext({ args: ["--unrelated", "v"] }));
  expect(info.result.ok).toBe(true);
  expect(info.claims).toEqual([]);
});
