import { checkpoint, cli, command, description, name, option } from "../mod.ts";
import { schema } from "../lib/param.ts";
import type { ModelOf } from "../lib/types.ts";
import { z } from "zod";

export const app = command(
  name("auth0"),
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
  option(
    name("audience"),
    description("Auth0 audience"),
    cli(["--audience"]),
    schema(z.string()),
  ),
  option(
    name("clientID"),
    description("Auth0 client ID"),
    cli(["--client-id"]),
    schema(z.string()),
  ),
  option(
    name("protocol"),
    description("server protocol"),
    cli(["--protocol"]),
    schema(z.enum(["http", "https"])),
  ),
  checkpoint(),
  option(
    name("clientSecret"),
    description("client secret"),
    cli(["--client-secret"]),
    schema(z.string()),
  ),
  option(
    name("scope"),
    description("OAuth scope"),
    cli(["--scope"]),
    schema(z.string()),
  ),
  option(
    name("rulesDirectory"),
    description("rules directory"),
    cli(["--rules-directory"]),
    schema(z.string()),
  ),
  option(
    name("connection"),
    description("Auth0 connection"),
    cli(["--connection"]),
    schema(z.string()),
  ),
  option(
    name("config"),
    description("JSON config path"),
    cli(["--config", "-c"]),
    schema(z.string()),
  ),
);

export type Configuration = ModelOf<typeof app>;

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true
  : false
  : false;
type Assert<T extends true> = T;
type ConfigIsPresent = Assert<
  Equal<"config" extends keyof Configuration ? true : false, true>
>;
type ConnectionIsPresent = Assert<
  Equal<"connection" extends keyof Configuration ? true : false, true>
>;
type PortIsNumber = Assert<Equal<Configuration["port"], number>>;
type ConfigIsString = Assert<Equal<Configuration["config"], string>>;
