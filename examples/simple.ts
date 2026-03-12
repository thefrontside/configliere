import assert from "node:assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { program } from "../lib/program.ts";

let serve = program({
  name: "serve",
  version: "1.0.0",
  config: object({
    host: {
      description: "hostname to bind",
      aliases: ["-H"],
      ...field(type("string"), field.default("localhost")),
    },
    port: {
      description: "port to listen on",
      aliases: ["-p"],
      ...field(type("number"), field.default(3000)),
    },
    debug: {
      description: "enable debug logging",
      aliases: ["-d"],
      ...field(type("boolean"), field.default(false)),
    },
    entry: {
      description: "entrypoint file",
      ...field(type("string"), cli.argument()),
    },
  }),
});

console.log("=== --help ===\n");
let r1 = serve.createParser({ args: ["--help"] });
assert(r1.type === "help");
console.log(r1.print());

console.log("\n=== --version ===\n");
let r2 = serve.createParser({ args: ["--version"] });
assert(r2.type === "version");
console.log(r2.print());

console.log("\n=== app.ts -p 8080 --debug ===\n");
let r3 = serve.createParser({ args: ["app.ts", "-p", "8080", "--debug"] });
assert(r3.type === "main");
let result = r3.parse();
assert(result.ok);
console.log(result.value);
