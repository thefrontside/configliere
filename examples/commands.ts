import assert from "node:assert";
import { type } from "arktype";
import { argument } from "../lib/argument.ts";
import { option } from "../lib/option.ts";
import { object } from "../lib/object.ts";
import { commands } from "../lib/commands.ts";
import { program } from "../lib/program.ts";

let app = program({
  name: "myapp",
  version: "3.2.0",
  config: commands([
    [
      "dev",
      object({
        port: option(type("number"), {
          description: "port to listen on",
          aliases: ["-p"],
          default: 3000,
        }),
        open: option(type("boolean"), {
          description: "open browser on start",
          default: false,
        }),
      }),
    ],
    [
      "build",
      object({
        outdir: option(type("string"), {
          description: "output directory",
          aliases: ["-o"],
          default: "dist",
        }),
        minify: option(type("boolean"), {
          description: "minify output",
          default: true,
        }),
      }),
    ],
    [
      "deploy",
      object({
        target: argument(type("string"), {
          description: "deployment target",
        }),
        dry: option(type("boolean"), {
          description: "dry run without deploying",
          default: false,
        }),
      }),
    ],
  ]),
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
assert(r3.value.help);
let cmd3 = r3.value.config;
assert(cmd3.name === "dev");
console.log(app.help());

console.log("\n=== dev --open -p 4000 ===\n");
let r4 = app.parse({ args: ["dev", "--open", "-p", "4000"] });
assert(r4.ok);
let cmd4 = r4.value.config;
assert(cmd4.name === "dev");
if (!cmd4.help) console.log(cmd4.config);

console.log("\n=== help() ===\n");
console.log(app.help());
