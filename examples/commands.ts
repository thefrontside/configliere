import assert from "node:assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { commands } from "../lib/commands.ts";
import { program } from "../lib/program.ts";

let app = program({
  name: "myapp",
  version: "3.2.0",
  config: commands({
    dev: {
      description: "start dev server",
      ...object({
        port: {
          description: "port to listen on",
          aliases: ["-p"],
          ...field(type("number"), field.default(3000)),
        },
        open: {
          description: "open browser on start",
          ...field(type("boolean"), field.default(false)),
        },
      }),
    },
    build: {
      description: "build for production",
      ...object({
        outdir: {
          description: "output directory",
          aliases: ["-o"],
          ...field(type("string"), field.default("dist")),
        },
        minify: {
          description: "minify output",
          ...field(type("boolean"), field.default(true)),
        },
      }),
    },
    deploy: {
      description: "deploy to target",
      ...object({
        target: {
          description: "deployment target",
          ...field(type("string"), cli.argument()),
        },
        dry: {
          description: "dry run without deploying",
          ...field(type("boolean"), field.default(false)),
        },
      }),
    },
  }),
});

console.log("=== -h ===\n");
let r1 = app.parse({ args: ["-h"] });
assert(r1.ok);
assert(r1.value.help);
console.log(app.help());

console.log("\n=== -v ===\n");
let r2 = app.parse({ args: ["-v"] });
assert(r2.ok);
assert(r2.value.version);
console.log(r2.value.version);

console.log("\n=== dev --help ===\n");
let r3 = app.parse({ args: ["dev", "--help"] });
assert(r3.ok);
let cmd3 = r3.value.config;
assert(cmd3.name === "dev");
assert(cmd3.help);
console.log(cmd3.text);

console.log("\n=== dev --open -p 4000 ===\n");
let r4 = app.parse({ args: ["dev", "--open", "-p", "4000"] });
assert(r4.ok);
let cmd4 = r4.value.config;
assert(cmd4.name === "dev" && !cmd4.help);
console.log(cmd4.config);

console.log("\n=== help() ===\n");
console.log(app.help());
