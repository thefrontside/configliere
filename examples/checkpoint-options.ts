import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  checkpoint,
  cli,
  command,
  description,
  name,
  option,
  parse,
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
    (context) => {
      let { domain, port, protocol } = context.options;
      let parsed = domain === undefined ? undefined : parseDomain(domain);

      if (domain !== undefined && parsed === undefined) {
        context.addIssue({
          message: `domain must be an HTTP or HTTPS host, received ${domain}`,
        });
      }

      if (
        parsed?.protocol !== undefined && protocol !== undefined &&
        parsed.protocol !== protocol
      ) {
        context.addIssue({
          message:
            `domain protocol ${parsed.protocol} conflicts with protocol ${protocol}`,
        });
      }

      if (
        parsed?.port !== undefined && port !== undefined && parsed.port !== port
      ) {
        context.addIssue({
          message: `domain port ${parsed.port} conflicts with port ${port}`,
        });
      }

      let resolvedProtocol = protocol ?? parsed?.protocol ??
        (port === 80 || parsed?.port === 80 ? "http" : "https");
      let resolvedPort = port ?? parsed?.port ??
        (resolvedProtocol === "https" ? 443 : 80);
      let host = parsed?.host ?? "localhost";

      return {
        port: resolvedPort,
        domain: `${resolvedProtocol}://${host}:${resolvedPort}`,
        protocol: resolvedProtocol,
      };
    },
    option(
      name("port"),
      description("server port"),
      cli(["--port", "-p"]),
      schema(z.optional(z.number().int().min(1).max(65535))),
    ),
    option(
      name("domain"),
      description("server domain"),
      cli(["--domain"]),
      schema(z.optional(z.string())),
    ),
    option(
      name("protocol"),
      description("server protocol"),
      cli(["--protocol"]),
      schema(z.optional(z.enum(["http", "https"]))),
    ),
  ),
  option(
    name("audience"),
    description("Auth0 audience"),
    cli(["--audience"]),
    schema(z.string()),
  ),
);

type Protocol = "http" | "https";

type ParsedDomain = {
  host: string;
  port?: number;
  protocol?: Protocol;
};

function parseDomain(value: string): ParsedDomain | undefined {
  let hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
  let url: URL;

  try {
    url = new URL(hasProtocol ? value : `http://${value}`);
  } catch {
    return undefined;
  }

  if (
    !["http:", "https:"].includes(url.protocol) || url.pathname !== "/" ||
    url.search !== "" || url.hash !== "" || url.username !== "" ||
    url.password !== ""
  ) {
    return undefined;
  }

  return {
    host: url.hostname,
    port: url.port === "" ? undefined : Number(url.port),
    protocol: hasProtocol ? url.protocol.slice(0, -1) as Protocol : undefined,
  };
}

// Production-use type: application code can use this inferred configuration shape.
export type Configuration = ModelOf<typeof app>;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let step = parse(app, { argv: process.argv.slice(2) });
  let result = !step.ok || !("resume" in step)
    ? step
    : step.resume({ ok: true, value: [] });

  if (!result.ok || "resume" in result || result.method !== "execute") {
    console.dir(result, { depth: null });
  } else {
    switch (result.route) {
      case "/": {
        let instance = { route: result.route, model: result.model };
        console.log("checkpoint-options/root");
        console.dir(instance, { depth: null });
        break;
      }
    }
  }
}

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
