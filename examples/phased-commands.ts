import assert from "node:assert";
import { type } from "arktype";
import { argument } from "../lib/argument.ts";
import { option } from "../lib/option.ts";
import { object } from "../lib/object.ts";
import { commands } from "../lib/commands.ts";
import { inject } from "../lib/inject.ts";
import { program } from "../lib/program.ts";
import type { Parser } from "../lib/types.ts";

let app = program({
  name: "myctl",
  version: "2.0.0",
  config: object({
    config: option(type("string"), {
      description: "config file",
      aliases: ["-c"],
    }),
    next: inject((_config: { serve?: { host?: string } }) =>
      commands([
        [
          "init",
          object({
            template: option(type("string"), {
              description: "project template",
              aliases: ["-t"],
              default: "default",
            }),
          }),
        ],
        [
          "serve",
          object({
            port: option(type("number"), {
              description: "port to listen on",
              aliases: ["-p"],
              default: 3000,
            }),
            host: option(type("string"), {
              description: "hostname to bind",
              aliases: ["-H"],
              default: "localhost",
            }),
          }),
        ],
        [
          "migrate",
          object({
            target: argument(type("string"), {
              description: "migration target version",
            }),
            dry: option(type("boolean"), {
              description: "dry run without applying",
              default: false,
            }),
          }),
        ],
      ])
    ),
  }),
});

console.log("=== --help ===\n");
let rh = app.parse({ args: ["--help"] });
assert(rh.ok);
assert(rh.value.help);
console.log(app.help());

console.log("\n=== --version ===\n");
let rv = app.parse({ args: ["--version"] });
assert(rv.ok);
assert(rv.value.version);
console.log(rv.value.version);

console.log("\n=== -c app.json serve -p 8080 ===\n");
let r = app.parse({ args: ["-c", "app.json", "serve", "-p", "8080"] });
assert(r.ok);

let phase1 = r.value.config;
console.log("phase 1 config:", phase1.config);

// simulate loading config, resume into phase 2
let resume = phase1.next as unknown as (
  deps: { serve?: { host?: string } },
) => Parser<unknown>;
let parser2 = resume({ serve: { host: "0.0.0.0" } });
// Phase 2 re-parses with original args + loaded config values
let phase2 = parser2.parse({
  args: ["-c", "app.json", "serve", "-p", "8080"],
  values: [{ name: "app.json", value: { serve: { host: "0.0.0.0" } } }],
});
assert(phase2.ok);
console.log("phase 2:", phase2.value);

console.log("\n=== help() ===\n");
console.log(app.help());
