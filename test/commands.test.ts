import { expect } from "@std/expect";
import { type } from "arktype";
import { commands } from "../lib/commands.ts";
import { object } from "../lib/object.ts";
import { option } from "../lib/option.ts";
import { program } from "../lib/program.ts";
import { createContext } from "../lib/context.ts";

Deno.test("commands dispatches on first positional matching a name", () => {
  let p = commands([
    ["serve", object({ port: option(type("string")) })],
    ["build", object({ out: option(type("string")) })],
  ]);
  let info = p.inspect(createContext({ args: ["serve", "--port", "8000"] }));
  expect(info.result.ok).toBe(true);
  if (info.result.ok) {
    expect(info.result.value.name).toBe("serve");
    if ("config" in info.result.value) {
      expect(info.result.value.config).toEqual({ port: "8000" });
    }
  }
});

Deno.test("commands scans past leading non-positional tokens", () => {
  let p = commands([
    ["serve", object({ port: option(type("string")) })],
  ]);
  let info = p.inspect(createContext({ args: ["--unknown", "serve", "--port", "8000"] }));
  if (info.result.ok) {
    expect(info.result.value.name).toBe("serve");
  }
});

Deno.test("commands resets args-path so inner uses bare option names", () => {
  let p = commands([
    ["serve", object({ port: option(type("string")) })],
  ]);
  let info = p.inspect(createContext({ args: ["serve", "--port", "8000"] }));
  if (info.result.ok && "config" in info.result.value) {
    expect(info.result.value.config).toEqual({ port: "8000" });
  }
});

Deno.test("commands hands inner pre-and-post selector tokens (no positional barrier)", () => {
  let p = commands([
    ["serve", object({
      port: option(type("string")),
      host: option(type("string")),
    })],
  ]);
  let info = p.inspect(createContext({
    args: ["--host", "h", "serve", "--port", "8000"],
  }));
  if (info.result.ok && "config" in info.result.value) {
    expect(info.result.value.config).toEqual({ port: "8000", host: "h" });
  }
});

Deno.test("commands scopes values by command name", () => {
  let p = commands([
    ["serve", object({ port: option(type("string")) })],
  ]);
  let info = p.inspect(createContext({
    args: ["serve"],
    values: [{ name: "config", value: { serve: { port: "8000" } } }],
  }));
  if (info.result.ok && "config" in info.result.value) {
    expect(info.result.value.config).toEqual({ port: "8000" });
  }
});

Deno.test("commands scopes envs by command prefix", () => {
  let p = commands([
    ["serve", object({ port: option(type("string")) })],
  ]);
  let info = p.inspect(createContext({
    args: ["serve"],
    envs: [{ name: "process", value: { SERVE_PORT: "8000" } }],
  }));
  if (info.result.ok && "config" in info.result.value) {
    expect(info.result.value.config).toEqual({ port: "8000" });
  }
});

Deno.test("same-name option at outer and inner levels — both claim", () => {
  let p = object({
    foo: option(type("boolean")),
    cmd: commands([
      ["run", object({ foo: option(type("boolean")) })],
    ]),
  });
  let info = p.inspect(createContext({ args: ["--foo", "run", "--foo"] }));
  if (info.result.ok) {
    expect(info.result.value.foo).toBe(true);
    if ("config" in info.result.value.cmd) {
      expect(info.result.value.cmd.config).toEqual({ foo: true });
    }
  }
});

Deno.test("commands fails when no name matches and no default", () => {
  let p = commands([
    ["serve", object({ port: option(type("string")) })],
  ]);
  let info = p.inspect(createContext({ args: [] }));
  expect(info.result.ok).toBe(false);
});

Deno.test("commands uses default when no name matches", () => {
  let p = commands(
    [
      ["serve", object({ port: option(type("string"), { default: "x" }) })],
    ],
    { default: "serve" },
  );
  let info = p.inspect(createContext({ args: [] }));
  expect(info.result.ok).toBe(true);
});

Deno.test("commands populates help.commands with full registry", () => {
  let p = commands([
    ["serve", object({ port: option(type("string"), { default: "8000" }) })],
    ["build", object({ out: option(type("string"), { default: "dist" }) })],
  ]);
  let info = p.inspect(createContext({ args: ["serve"] }));
  expect(info.help.commands.length).toBe(2);
  let names = info.help.commands.map((c) => c.name).sort();
  expect(names).toEqual(["build", "serve"]);
});

Deno.test("program help shows all commands", () => {
  let p = program({
    name: "myapp",
    config: commands([
      ["serve", object({ port: option(type("string"), { default: "8000" }) })],
      ["build", object({ out: option(type("string"), { default: "dist" }) })],
    ]),
  });
  let helpText = p.help({ args: ["serve"] });
  expect(helpText).toContain("serve");
  expect(helpText).toContain("build");
});
