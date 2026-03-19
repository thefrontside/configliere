import assert from "node:assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { commands, help } from "../lib/commands.ts";
import { step } from "../lib/step.ts";
import { constant } from "../lib/constant.ts";
import { program } from "../lib/program.ts";
import type { Parser } from "../lib/types.ts";

let app = program({
  name: "myctl",
  version: "2.0.0",
  config: step({
    from: (resume) =>
      object({
        config: {
          description: "config file",
          aliases: ["-c"],
          ...field(type("string")),
        },
        resume: constant(resume),
      }),
    to: (_config: { serve?: { host?: string } }) =>
      commands({
        help,
        init: {
          description: "initialize a new project",
          ...object({
            template: {
              description: "project template",
              aliases: ["-t"],
              ...field(type("string"), field.default("default")),
            },
          }),
        },
        serve: {
          description: "start the server",
          ...object({
            port: {
              description: "port to listen on",
              aliases: ["-p"],
              ...field(type("number"), field.default(3000)),
            },
            host: {
              description: "hostname to bind",
              aliases: ["-H"],
              ...field(type("string"), field.default("localhost")),
            },
          }),
        },
        migrate: {
          description: "run database migrations",
          ...object({
            target: {
              description: "migration target version",
              ...field(type("string"), cli.argument()),
            },
            dry: {
              description: "dry run without applying",
              ...field(type("boolean"), field.default(false)),
            },
          }),
        },
      }),
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
console.log("2.0.0");

console.log("\n=== -c app.json serve -p 8080 ===\n");
let r = app.parse({ args: ["-c", "app.json", "serve", "-p", "8080"] });
assert(r.ok);

let phase1 = r.value.parser.parse({});
assert(phase1.ok);
console.log("phase 1:", (phase1.value as Record<string, unknown>).config);

// simulate loading config, resume into phase 2
let resume = (phase1.value as Record<string, unknown>).resume as (deps: { serve?: { host?: string } }) => Parser<unknown>;
let parser2 = resume({ serve: { host: "0.0.0.0" } });
let phase2 = parser2.parse({
  values: [{ name: "app.json", value: { serve: { host: "0.0.0.0" } } }],
});
assert(phase2.ok);
console.log("phase 2:", phase2.value);

console.log("\n=== help() ===\n");
console.log(app.help());

console.log("\n=== phase 2 help() with config source ===\n");
console.log(parser2.help({
  values: [{ name: "app.json", value: { serve: { host: "0.0.0.0" } } }],
}));
