import {
  checkpoint,
  cli,
  command,
  description,
  name,
  option,
  schema,
  transform,
  version,
} from "../mod.ts";
import type { ModelOf } from "../lib/types.ts";
import { z } from "zod";

export const app = command(
  name("auth0"),
  description("Provision and inspect Auth0 tenants."),
  version("1.0.0"),
  option(
    name("config"),
    description("JSON config path"),
    cli(["--config", "-c"]),
    schema(z.string()),
  ),
  checkpoint(),
  transform(
    (options: Options, model: Before, _phase) => {
      return {
        ...model,
        port: options.port ?? model.port,
        domain: options.domain ?? model.domain,
      };
    },
    option(
      name("port"),
      description("server port"),
      cli(["--port", "-p"]),
      schema(z.number()),
    ),
    option(
      name("domain"),
      description("server domain"),
      cli(["--domain"]),
      schema(z.string()),
    ),
  ),
  option(
    name("protocol"),
    description("server protocol"),
    cli(["--protocol"]),
    schema(z.enum(["http", "https"])),
  ),
  option(
    name("audience"),
    description("Auth0 audience"),
    cli(["--audience"]),
    schema(z.string()),
  ),
);

type Options = {
  port: number;
  domain: string;
};

type Before = {
  config: string;
  port: number;
  domain: string;
};

// Production-use type: application code can use this inferred configuration shape.
export type Configuration = ModelOf<typeof app>;

// Diagnostic-only assertions: these force TypeScript to materialize representative keys.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true
  : false
  : false;
type Assert<T extends true> = T;
type ConfigIsPresent = Assert<
  Equal<"config" extends keyof Configuration ? true : false, true>
>;
type PortIsPresent = Assert<
  Equal<"port" extends keyof Configuration ? true : false, true>
>;
type PortIsNumber = Assert<Equal<Configuration["port"], number>>;
type ConfigIsString = Assert<Equal<Configuration["config"], string>>;
type ProtocolIsEnum = Assert<
  Equal<Configuration["protocol"], "http" | "https">
>;
