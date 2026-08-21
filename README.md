# Configliere

> [!NOTE]
> Configliere is undergoing a ground-up rebuild. The ideas below are working,
> but the API is not yet stable.

Configliere models a command-line program as a tree of typed routes. Parsing
does not merely produce a bag of options: it resolves an intent such as
`HELP /`, `VERSION /`, or `EXECUTE /serve` and, for execution, binds a model for
every route that led there.

The architecture has four small pieces:

- A **route** is an application-relative address such as `/` or `/serve`.
- A **method** says what to do with that route. Every route supports help;
  `version()` adds version and `command()` creates an executable route.
- Each route owns its own **model**. An execute intent contains the current
  `model` and a path-addressed `models` map for the entire matched lineage.
- Definitions are immutable composition pipelines. Elements such as
  `description()`, `option()`, `toggle()`, `version()`, and `routes()` enrich
  both the runtime definition and its TypeScript type.

Parameters are validated with [Standard Schema](https://standardschema.dev/), so
Configliere works with ArkType, Zod, Valibot, and other conforming schema
libraries. The examples below use ArkType.

## One command, one model

`command()` is an executable route. Here it creates the root route `/` with
help, version, and execute methods:

```ts
import process from "node:process";
import {
  command,
  description,
  name,
  option,
  parse,
  printHelp,
  printVersion,
  schema,
  toggle,
  version,
} from "@frontside/configliere";
import { type } from "arktype";

const app = command(
  name("server"),
  description("Run the HTTP server."),
  version("1.0.0"),
  option(
    name("port"),
    description("Port to listen on."),
    schema(type("number")),
  ),
  toggle(
    name("verbose"),
    description("Print request diagnostics."),
  ),
);

const result = parse(app, { argv: process.argv.slice(2) });

if (!result.ok) {
  console.error(result.code, result);
  process.exit(1);
}

switch (result.method) {
  case "help":
    console.log(printHelp(result));
    break;
  case "version":
    console.log(printVersion(result));
    break;
  case "execute":
    // Exactly { port: number; verbose: boolean }, not Record<string, unknown>.
    serve(result.model);
    break;
}

function serve(model: { port: number; verbose: boolean }): void {
  console.log(`listening on ${model.port}; verbose=${model.verbose}`);
}
```

`parse()` receives the arguments _after_ the executable name, which is why the
example passes `process.argv.slice(2)`. The full command lines above resolve as
follows:

| Invocation                     | Result                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `server --help`                | `HELP /`; `printHelp()` renders the route's usage, options, and descriptions |
| `server --version`             | `VERSION /`; `printVersion()` returns `server 1.0.0`                         |
| `server --port 4000`           | `EXECUTE /`; `model` is `{ port: 4000, verbose: false }`                     |
| `server --port=4000 --verbose` | `EXECUTE /`; `model` is `{ port: 4000, verbose: true }`                      |
| `server --port nope`           | `unprocessable-content`; execution never receives an invalid model           |

The method is a discriminant. Once the switch reaches `"execute"`, TypeScript
knows that `model` exists and has exactly the shape assembled by the command's
parameters. Help and version are resolved before execution validation, so
`server --help` does not require a port.

## Add commands, keep dispatch flat

Routes form a tree, but callers do not have to mirror that tree with nested
conditionals. `Resolve<typeof app>` is a flat union of every method and route
the definition can reach, so `result.route` is another useful discriminant.

```ts
import process from "node:process";
import {
  command,
  name,
  option,
  parse,
  printHelp,
  routes,
  schema,
  toggle,
} from "@frontside/configliere";
import { type } from "arktype";

const app = command(
  name("simulacrum"),
  toggle(name("verbose")),
  routes(
    command(
      name("serve"),
      option(name("port"), schema(type("number"))),
    ),
    command(
      name("inspect"),
      toggle(name("json")),
    ),
  ),
);

const result = parse(app, { argv: process.argv.slice(2) });

if (!result.ok) {
  console.error(result.code, result);
  process.exit(1);
}

if (result.method === "help") {
  console.log(printHelp(result));
} else {
  switch (result.route) {
    case "/":
      // model:  { verbose: boolean }
      // models: { "/": { verbose: boolean } }
      start(result.model);
      break;

    case "/serve":
      // model is only the selected route's model.
      result.model.port; // number

      // models contains every model on the matched route lineage.
      result.models["/"].verbose; // boolean
      result.models["/serve"].port; // number

      // @ts-expect-error: /inspect was not part of this match.
      result.models["/inspect"];
      serve(result.model, result.models["/"]);
      break;

    case "/inspect":
      // model:  { json: boolean }
      // models: { "/": { verbose: boolean }, "/inspect": { json: boolean } }
      inspect(result.model, result.models["/"]);
      break;
  }
}

function start(model: { verbose: boolean }): void {
  console.log(`simulacrum; verbose=${model.verbose}`);
}

function serve(
  model: { port: number },
  root: { verbose: boolean },
): void {
  console.log(`serving on ${model.port}; verbose=${root.verbose}`);
}

function inspect(
  model: { json: boolean },
  root: { verbose: boolean },
): void {
  console.log(`inspecting; json=${model.json}; verbose=${root.verbose}`);
}
```

| Invocation                               | Result                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `simulacrum --verbose`                   | `EXECUTE /`; `model` and `models["/"]` are `{ verbose: true }`                                       |
| `simulacrum --verbose serve --port 4000` | `EXECUTE /serve`; `model` is `{ port: 4000 }`, while `models` also contains `"/": { verbose: true }` |
| `simulacrum inspect --json`              | `EXECUTE /inspect`; `model` is `{ json: true }` and the root model has `{ verbose: false }`          |
| `simulacrum serve --help`                | `HELP /serve`; no root or command model is validated                                                 |

Route tokens select the deepest matching route; they are not positional
arguments. Options on each segment bind only to the model owned by that route.
The root definition's name identifies the executable but is not repeated in
route IDs: the root is `/`, not `/simulacrum`.

For a deeper route such as `/database/clean`, the same rule applies:
`result.model` is the clean command's model, while `result.models` has exact
entries for `/`, `/database`, and `/database/clean`. Sibling models are absent
at runtime and from the TypeScript type.
