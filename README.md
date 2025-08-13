# <img src="images/configliere.jpeg" height="50"> Configliere 

Smart, FP configuration parser that validates all program inputs ahead of time,
including config files, environment variables, and command line options using a
single schema.

## Introduction

Conceptually, "config" is a palette of settings and switches that is accessed
from various portions of our program to alter its behavior without altering its
code. However the story around config is often made very messy by the fact that
it is read at _different_ times during program execution and from many
_different__ sources such as configuration files and environment variables.

![Before](images/configliere-before.svg)

As a result, configuration is often fragile and difficult to understand. Some of
the symptoms of a fragmented config are:

- **The deferred crash** Happens when a program begins running, perhaps even for
  awhile, but then it reaches for a configuration value via an interface like
  `app.getConfig("field")` only to find that the value is invalid, or missing
  altogether. Happens a lot with config files and enviroment variables.
- **conflicting configs** When a program has more than one way of specifying the
  same parameter, and they clobber each other.
  - **Unclear priority** Which parameter wins? The one coming from a CLI option
    or an environment variable?
  - **Mysterious provenance** You can see a value for a github token, but does
    it come from? It could be from `app-config.yaml`, or
    `app-config.production.yaml`. Then again, it could be specified in the
    `GITHUB_TOKEN` environment variable. But don't forget there is also a
    `--github-token` command line option.
  - **magical behavior** A furiously frustrating deployment-specific failure is
    tracked down to some random environment variable overriding a parameter that
    isn't configured like that in any other enviroment.
- **Ad-hoc, validation** - There are different ways to verify the runtime type
  of a configuration value depending on whether it comes from the CLI,
  environment, or a configuration file.

Configliere solves all of these problems by re-imagining "config" not as a
constellation of globally floating objects from which we can read in values at
any point, but instead as a _single_, _pre-validated_, type-safe data structure
that is passed as the input of our program's entry point. It tracks the _source_
of each value that ends up in the final config, so how a

This has a profound impact on our program as a whole because it let's us treat
the entire process as one function call that takes a single value as its input.

## Summary

Configiere uses [Standard Schema][standard-schema] to define the static type of
each configuration parameter as well as to validate that type at runtime. In
these examples, we'll use [Zod][zod], but you can use
[any library that implements the Standard Schema spec][schema-libs].

This basic example uses configliere to specify the host and port of a "Hello
World" server:

```ts
// server.js
import { createServer } from "node:http";
import { fileExistsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { Configliere, ObjectInput } from "configliere";

export const configliere = new Configliere({
  host: {
    schema: z.string(),
  },
  port: {
    schema: z.number(),
  },
});

// read a config file if it exists
const objects: ObjectInput[] = [];
if (fileExistsSync("./config.json")) {
  objects.push({
    value: JSON.parse(readFileSync("./config.json")),
    source: "./config.json",
  });
}

const result = configliere.parse({
  objects,
  args: process.argv.slice(1),
  env: process.env,
});

if (!result.ok) {
  console.error(result.summary);
  process.exit(1);
}

const server = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Hello World\n");
});

server.listen(config.port, config.host, () => {
  console.log(`server listening at ${config.host}:${config.port}`);
});
```

This will allow us to configure our server from the CLI

```
node server.js --port 80 --host localhost
```

But also using environment variables:

```
PORT=80 HOST=localhost node server.js
```

Or a static configuration file:

```
{
  "host": "localhost",
  "port": 80,
}
```

They can also be used in coordination with each other:

```
HOST=localhost node server.js --port 80
```

In all cases however, the values of `host` and `port` proceed through the exact
same validation and error reporting process.

## Configuration Sources

### CLI

- boolean values
- array values
- printing help

### Environment Variables

- bolean values

### Config Files

- Using typescript for statically typed configuration files.

[standard-schema]: https://standardschema.dev
[zod]: https://zod.dev
[schema-libs]: https://standardschema.dev/#what-schema-libraries-implement-the-spec
