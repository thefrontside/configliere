import assert from "node:assert";
import { type } from "arktype";
import { argument } from "../lib/argument.ts";
import { option } from "../lib/option.ts";
import { object } from "../lib/object.ts";
import { program } from "../lib/program.ts";
import { createContext } from "../lib/context.ts";

let serve = program({
  name: "serve",
  version: "1.0.0",
  config: object({
    host: option(type("string"), {
      description: "hostname to bind",
      aliases: ["-H"],
      default: "localhost",
    }),
    port: option(type("number"), {
      description: "port to listen on",
      aliases: ["-p"],
      default: 3000,
    }),
    debug: option(type("boolean"), {
      description: "enable debug logging",
      aliases: ["-d"],
      default: false,
    }),
    entry: argument(type("string"), {
      description: "entrypoint file",
    }),
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
