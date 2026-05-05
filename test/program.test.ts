import { expect } from "@std/expect";
import { type } from "arktype";
import { program } from "../lib/program.ts";
import { object } from "../lib/object.ts";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";

Deno.test("program claims --help", () => {
  let p = program({
    name: "myapp",
    config: object({ x: option(type("string"), { default: "y" }) }),
  });
  let info = p.inspect(createContext({ args: ["--help"] }));
  expect(info.result.ok).toBe(true);
  if (info.result.ok) {
    expect(info.result.value.help).toBe(true);
    expect(info.result.value.version).toBe(false);
  }
});

Deno.test("program claims -v when version provided", () => {
  let p = program({
    name: "myapp",
    version: "1.0.0",
    config: object({ x: option(type("string"), { default: "y" }) }),
  });
  let info = p.inspect(createContext({ args: ["-v"] }));
  expect(info.result.ok).toBe(true);
  if (info.result.ok) {
    expect(info.result.value.version).toBe(true);
  }
});

Deno.test("program delegates to inner when no help/version", () => {
  let p = program({
    name: "myapp",
    config: object({ x: option(type("string")) }),
  });
  let info = p.inspect(createContext({ args: ["--x", "v"] }));
  expect(info.result.ok).toBe(true);
  if (info.result.ok) {
    expect(info.result.value.help).toBe(false);
    expect(info.result.value.config).toEqual({ x: "v" });
  }
});

Deno.test("program does not claim --version when no version provided", () => {
  let p = program({
    name: "myapp",
    config: object({ x: option(type("string"), { default: "y" }) }),
  });
  let info = p.inspect(createContext({ args: ["--version"] }));
  if (info.result.ok) {
    expect(info.result.value.version).toBe(false);
  }
});
