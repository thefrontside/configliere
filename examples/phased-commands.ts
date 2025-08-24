import { assert } from "@std/assert/assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { commands, help } from "../lib/commands.ts";
import { sequence } from "../lib/sequence.ts";
import { program } from "../lib/program.ts";

let app = program({
  name: "myctl",
  version: "2.0.0",
  config: sequence(
    object({
      config: {
        description: "config file",
        aliases: ["-c"],
        ...field(type("string")),
      },
    }),
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
  ),
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

let step1 = r.parse();
assert(step1.ok);
console.log("phase 1:", step1.value);
console.log("remainder:", step1.remainder.args);

// simulate loading config, feed to phase 2
let step2 = step1.parse({
  args: step1.remainder.args,
  values: [{ name: "app.json", value: { serve: { host: "0.0.0.0" } } }],
});
assert(step2.ok);
console.log("phase 2:", step2.value);
