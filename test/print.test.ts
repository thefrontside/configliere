/**
 * 😵‍💫 This file has been vibe coded 😵‍💫
 */

import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { command } from "../lib/command.ts";
import { description, name } from "../lib/definition.ts";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { parse } from "../lib/parse.ts";
import { printErrors, printHelp, printVersion } from "../lib/print.ts";
import { route, routes, version } from "../lib/route.ts";
import { toggle } from "../lib/toggle.ts";

let app = route(
  name("simulacrum"),
  description("Run and manage a tree of local service simulators."),
  version("1.4.0"),
  option(
    name("config"),
    description("Load configuration from this file before starting."),
  ),
  toggle(
    name("verbose"),
    description("Show detailed startup and request diagnostics."),
  ),
  routes(
    route(
      name("database"),
      description("Inspect and maintain simulator state."),
      routes(
        command(
          name("clean"),
          description("Remove generated records and reset database state."),
          version("2.0.0"),
          option(
            name("schema"),
            description("Limit cleanup to a single database schema."),
          ),
          toggle(
            name("dryRun"),
            description("Show what would be removed without changing data."),
          ),
        ),
      ),
    ),
    command(
      name("serve"),
      description("Start every configured simulator."),
      option(
        name("port"),
        description("Listen on this port."),
      ),
    ),
  ),
);

let required = command(
  name("serve"),
  option(name("port"), schema(type("number"))),
);

describe("printHelp()", () => {
  it("prints root help with commands, options, controls, and descriptions", () => {
    expect(help([])).toBe(`simulacrum 1.4.0
Run and manage a tree of local service simulators.

Usage:
  simulacrum [OPTIONS] <COMMAND>

Commands:
  database  Inspect and maintain simulator state.
  serve     Start every configured simulator.

Options:
  --config <VALUE>         Load configuration from this file before starting.
  --verbose, --no-verbose  Show detailed startup and request diagnostics.
  -h, --help               Print help
  -v, --version            Print version`);
  });

  it("prints help relative to a deeply nested route", () => {
    expect(help(["database", "clean"])).toBe(`database clean 2.0.0
Remove generated records and reset database state.

Usage:
  database clean [OPTIONS]

Options:
  --schema <VALUE>         Limit cleanup to a single database schema.
  --dry-run, --no-dry-run  Show what would be removed without changing data.
  -h, --help               Print help
  -v, --version            Print version`);
  });

  it("shows only the immediate commands and controls for an intermediate route", () => {
    expect(help(["database"])).toBe(`database
Inspect and maintain simulator state.

Usage:
  database [OPTIONS] <COMMAND>

Commands:
  clean  Remove generated records and reset database state.

Options:
  -h, --help  Print help`);
  });
});

describe("printVersion()", () => {
  it("prints the root name and version", () => {
    expect(release([])).toBe("simulacrum 1.4.0");
  });

  it("prints a deeply nested route and its own version", () => {
    expect(release(["database", "clean"])).toBe("database clean 2.0.0");
  });
});

describe("printErrors()", () => {
  it("prints an unsupported method with the methods available on its route", () => {
    let result = parse(app, { argv: ["serve", "--version"] });

    expect(result).toMatchObject({
      ok: false,
      code: "method-not-allowed",
    });
    if (result.ok) {
      throw new Error("expected method not allowed");
    }

    expect(printErrors(result)).toBe(`serve does not support VERSION

Available methods:
  HELP
  EXECUTE`);
  });

  it("prints validation issues with their parameter addresses", () => {
    let result = parse(required, { argv: [] });

    expect(result).toMatchObject({
      ok: false,
      code: "unprocessable-content",
    });
    if (result.ok) {
      throw new Error("expected unprocessable content");
    }

    expect(printErrors(result)).toBe(
      `port: must be a number (was undefined)`,
    );
  });

  it("prints nested and pathless issues together", () => {
    expect(printErrors({
      ok: false,
      code: "unprocessable-content",
      route: "/database/clean",
      definition: command(name("clean")),
      path: ["database", "clean"],
      issues: [
        {
          message: "must be 32 characters long",
          path: ["scope", 0, { key: "clientID" }],
        },
        { message: 'unexpected "--floop"' },
      ],
    })).toBe(`scope[0].clientID: must be 32 characters long
unexpected: \`--floop\``);
  });
});

function help(path: string[]): string {
  let result = parse(app, { argv: [...path, "--help"] });

  expect(result).toMatchObject({ ok: true, method: "help" });
  if (!result.ok || result.method !== "help") {
    throw new Error("expected help");
  }

  return printHelp(result);
}

function release(path: string[]): string {
  let result = parse(app, { argv: [...path, "--version"] });

  expect(result).toMatchObject({ ok: true, method: "version" });
  if (!result.ok || result.method !== "version") {
    throw new Error("expected version");
  }

  return printVersion(result);
}
