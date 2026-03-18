import assert from "node:assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { program } from "../lib/program.ts";
import { createContext } from "../lib/context.ts";

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
let r1 = serve.parse({ args: ["--help"] });
assert(r1.ok);
assert(r1.value.help);
console.log(serve.help());

console.log("\n=== --version ===\n");
let r2 = serve.parse({ args: ["--version"] });
assert(r2.ok);
assert(r2.value.version);
console.log(r2.value.version);

console.log("\n=== app.ts -p 8080 --debug ===\n");
let r3 = serve.parse({ args: ["app.ts", "-p", "8080", "--debug"] });
assert(r3.ok);
console.log(r3.value.config);

console.log("\n=== inspect() ===\n");
console.log(serve.inspect(createContext()));

console.log("\n=== help() ===\n");
console.log(serve.help());

console.log("\n=== inspect() with env source ===\n");
console.log(serve.inspect(createContext({
  envs: [{ name: "env", value: { PORT: "9090" } }],
})));
