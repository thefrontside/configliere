import { assert } from "@std/assert/assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { commands, help } from "../lib/commands.ts";
import { program } from "../lib/program.ts";

let app = program({
  name: "myapp",
  version: "3.2.0",
  config: commands({
    help,
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
let r1 = app.createParser({ args: ["-h"] });
assert(r1.type === "help");
console.log(r1.print());

console.log("\n=== -v ===\n");
let r2 = app.createParser({ args: ["-v"] });
assert(r2.type === "version");
console.log(r2.print());

console.log("\n=== help dev ===\n");
let r3 = app.createParser({ args: ["help", "dev"] });
assert(r3.type === "main");
let hr = r3.parse();
assert(hr.ok);
assert(hr.value.name === "help");
console.log(hr.value.config.text);

console.log("\n=== help help ===\n");
let r3b = app.createParser({ args: ["help", "help"] });
assert(r3b.type === "main");
let hr2 = r3b.parse();
assert(hr2.ok);
assert(hr2.value.name === "help");
console.log(hr2.value.config.text);

console.log("\n=== dev --open -p 4000 ===\n");
let r4 = app.createParser({ args: ["dev", "--open", "-p", "4000"] });
assert(r4.type === "main");
let result = r4.parse();
assert(result.ok);
console.log(result.value);
