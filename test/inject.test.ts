import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import assert from "node:assert";
import { type } from "arktype";
import { field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { inject } from "../lib/inject.ts";
import { createContext } from "../lib/context.ts";

describe("inject", () => {
  it("returns a resolve function that wraps the factory", () => {
    let factory = (_deps: { port: number }) =>
      object({
        port: field(type("number")),
      });

    let parser = inject(factory);
    let result = parser.parse({});
    assert(result.ok);
    expect(typeof result.value).toBe("function");
  });

  it("passes context through as remainder", () => {
    let parser = inject((_deps: void) =>
      object({
        port: field(type("number")),
      })
    );

    let result = parser.parse({ args: ["--port", "8080"] });
    assert(result.ok);
    expect(result.remainder.args).toEqual(["--port", "8080"]);
  });

  it("bakes context into the resolved parser", () => {
    let parser = inject((_deps: void) =>
      object({
        port: field(type("number")),
      })
    );

    let result = parser.parse({ args: ["--port", "8080"] });
    assert(result.ok);

    let resolved = result.value();
    let inner = resolved.parse();
    assert(inner.ok);
    expect(inner.value).toEqual({ port: 8080 });
  });

  it("merges caller input on top of baked context", () => {
    let parser = inject((_deps: void) =>
      object({
        port: field(type("number")),
        host: field(type("string")),
      })
    );

    let result = parser.parse({ args: ["--port", "8080"] });
    assert(result.ok);

    let resolved = result.value();
    let inner = resolved.parse({
      values: [{ name: "config", value: { host: "localhost" } }],
    });
    assert(inner.ok);
    expect(inner.value).toEqual({ port: 8080, host: "localhost" });
  });

  it("provides empty help info", () => {
    let parser = inject((_deps: void) =>
      object({
        port: field(type("number")),
      })
    );

    let info = parser.inspect(createContext());
    expect(info.help.args).toEqual([]);
    expect(info.help.opts).toEqual([]);
    expect(info.help.commands).toEqual([]);
  });

  it("preserves progname from context", () => {
    let parser = inject((_deps: void) =>
      object({
        port: field(type("number")),
      })
    );

    let info = parser.inspect({ ...createContext(), progname: ["myapp"] });
    expect(info.help.progname).toEqual(["myapp"]);
  });
});
