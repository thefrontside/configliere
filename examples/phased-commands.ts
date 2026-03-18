import assert from "node:assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { commands, help } from "../lib/commands.ts";
import { step } from "../lib/step.ts";
import { program } from "../lib/program.ts";

let app = program({
  name: "myctl",
  version: "2.0.0",
  config: step({
    resume: (_config: { serve?: { host?: string } }) =>
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
    schema: (resume) =>
      object({
        config: {
          description: "config file",
          aliases: ["-c"],
          ...field(type("string")),
        },
        resume,
      }),
  }),
});

console.log("=== --help ===\n");
let rh = app.createParser({ args: ["--help"] });
assert(rh.type === "help");
console.log(rh.print());

console.log("\n=== --version ===\n");
let rv = app.createParser({ args: ["--version"] });
assert(rv.type === "version");
console.log(rv.print());

console.log("\n=== -c app.json serve -p 8080 ===\n");
let r = app.createParser({ args: ["-c", "app.json", "serve", "-p", "8080"] });
assert(r.type === "main");

let phase1 = r.parse();
assert(phase1.ok);
console.log("phase 1:", phase1.value.config);
console.log("remainder:", phase1.remainder.args);

// simulate loading config, resume into phase 2
let parser2 = phase1.value.resume({ serve: { host: "0.0.0.0" } });
let phase2 = parser2.parse({
  values: [{ name: "app.json", value: { serve: { host: "0.0.0.0" } } }],
});
assert(phase2.ok);
console.log("phase 2:", phase2.value);
