import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import * as z from "zod";
import { command } from "../lib/command.ts";
import { name } from "../lib/definition.ts";
import { dynamic } from "../lib/dynamic.ts";
import { env, withEnvs } from "../lib/env.ts";
import { extend } from "../lib/extend.ts";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { parse } from "../lib/parse.ts";
import { route, routes } from "../lib/route.ts";
import { toggle } from "../lib/toggle.ts";
import type { ModelOf } from "../lib/types.ts";

describe("environment binding", () => {
  describe("mapping", () => {
    it("maps a root parameter to its normalized environment name", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: { PORT: "9001" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/",
        model: { port: 9001 },
      });
    });

    it("prefixes a parameter with its complete route path", () => {
      let clean = command(
        name("clean"),
        option(name("dryRun"), schema(z.string())),
      );
      let database = route(name("database"), routes(clean));
      let app = command(name("simulacrum"), routes(database));
      let result = parse(app, {
        argv: ["database", "clean"],
        envs: [{
          name: "process",
          value: { DATABASE_CLEAN_DRY_RUN: "yes" },
        }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/database/clean",
        model: { dryRun: "yes" },
      });
    });

    it("normalizes acronyms and punctuation", () => {
      let clean = command(
        name("pg:clean"),
        option(name("clientID"), schema(z.string())),
      );
      let app = command(name("simulacrum"), routes(clean));
      let result = parse(app, {
        argv: ["pg:clean"],
        envs: [{
          name: "process",
          value: { PG_CLEAN_CLIENT_ID: "0012" },
        }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/pg:clean",
        model: { clientID: "0012" },
      });
    });

    it("lets an explicit environment mapping replace the default", () => {
      let app = command(
        name("simulacrum"),
        option(
          name("port"),
          env("HTTP_PORT"),
          schema(z.number()),
        ),
      );
      let result = parse(app, {
        argv: [],
        envs: [{
          name: "process",
          value: { PORT: "9001", HTTP_PORT: "9002" },
        }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/",
        model: { port: 9002 },
      });
    });

    it("does not retain the inferred environment name as an alias", () => {
      let app = command(
        name("simulacrum"),
        option(
          name("port"),
          schema(z.number()),
          env("HTTP_PORT"),
        ),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: { PORT: "9001" } }],
      });

      expect(result).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        route: "/",
        issues: [{ path: ["port"] }],
      });
    });

    it("does not change the inferred model type", () => {
      let app = command(
        name("simulacrum"),
        option(
          name("port"),
          env("HTTP_PORT"),
          schema(z.number()),
        ),
      );

      expectType<Equal<ModelOf<typeof app>, { port: number }>>(true);
    });
  });

  describe("decoding", () => {
    it("decodes environment text with the parameter decoder", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: { PORT: "9001" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { port: 9001 },
      });
    });

    it("tries later decoder candidates", () => {
      let app = command(
        name("simulacrum"),
        option(name("clientID"), schema(z.string())),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: { CLIENT_ID: "0012" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { clientID: "0012" },
      });
    });

    it("reports schema issues for an invalid decoded value", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: { PORT: "nope" } }],
      });

      expect(result).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        route: "/",
        issues: [{ path: ["port"] }],
      });
    });

    it("treats an empty string as present", () => {
      let app = command(
        name("simulacrum"),
        option(name("domain"), schema(z.string().default("localhost"))),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: { DOMAIN: "" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { domain: "" },
      });
    });

    it("decodes environment text for a toggle", () => {
      let app = command(
        name("simulacrum"),
        toggle(name("verbose")),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: { VERBOSE: "true" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { verbose: true },
      });
    });
  });

  describe("absence", () => {
    it("validates undefined when no source contains the key", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: {} }],
      });

      expect(result).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        route: "/",
        issues: [{ path: ["port"] }],
      });
    });

    it("lets an absent environment value activate a schema default", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number().default(9000))),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: {} }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { port: 9000 },
      });
    });

    it("treats an undefined process environment entry as absent", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: [],
        envs: [
          { name: "process", value: { PORT: undefined } },
          { name: "defaults", value: { PORT: "9001" } },
        ],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { port: 9001 },
      });
    });
  });

  describe("precedence", () => {
    it("prefers CLI over environment values", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: ["--port", "9002"],
        envs: [{ name: "process", value: { PORT: "nope" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { port: 9002 },
        issues: [],
      });
    });

    it("prefers environment values over JavaScript values", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: [],
        values: [{ name: "settings", value: { port: 9002 } }],
        envs: [{ name: "process", value: { PORT: "9001" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { port: 9001 },
        issues: [],
      });
    });

    it("does not hide an invalid environment value with a JavaScript value", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: [],
        values: [{ name: "settings", value: { port: 9002 } }],
        envs: [{ name: "process", value: { PORT: "nope" } }],
      });

      expect(result).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        route: "/",
        issues: [{ path: ["port"] }],
      });
    });

    it("does not hide an incomplete CLI option with an environment value", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: ["--port"],
        envs: [{ name: "process", value: { PORT: "9001" } }],
      });

      expect(result).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        route: "/",
        issues: [{ message: "--port requires a value" }],
      });
    });

    it("uses the first environment source containing the key", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: [],
        envs: [
          { name: "settings", value: { PORT: "9001" } },
          { name: "defaults", value: { PORT: "9002" } },
        ],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { port: 9001 },
      });
    });

    it("tries the next environment source when the key is absent", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: [],
        envs: [
          { name: "settings", value: { HOST: "localhost" } },
          { name: "defaults", value: { PORT: "9002" } },
        ],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { port: 9002 },
      });
    });

    it("does not hide an invalid environment value with a later source", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, {
        argv: [],
        envs: [
          { name: "settings", value: { PORT: "nope" } },
          { name: "defaults", value: { PORT: "9002" } },
        ],
      });

      expect(result).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        route: "/",
        issues: [{ path: ["port"] }],
      });
    });

    it("does not replace an invalid environment value with a default", () => {
      let app = command(
        name("simulacrum"),
        option(name("port"), schema(z.number().default(9000))),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: { PORT: "nope" } }],
      });

      expect(result).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        route: "/",
        issues: [{ path: ["port"] }],
      });
    });
  });

  describe("mounting", () => {
    it("binds sources introduced by withEnvs()", () => {
      let app = command(
        name("simulacrum"),
        withEnvs([{
          name: "defaults",
          value: { PORT: "9001" },
        }]),
        option(name("port"), schema(z.number())),
      );
      let result = parse(app, { argv: [] });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/",
        model: { port: 9001 },
      });
    });

    it("prefers a source mounted on the current route over an ancestor", () => {
      let auth0 = command(
        name("auth0"),
        withEnvs([{
          name: "auth0.json",
          value: { AUTH0_PORT: "9003" },
        }]),
        option(name("port"), schema(z.number())),
      );
      let app = command(
        name("simulacrum"),
        withEnvs([{
          name: "settings",
          value: { AUTH0_PORT: "9001" },
        }]),
        routes(auth0),
      );
      let result = parse(app, { argv: ["auth0"] });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/auth0",
        model: { port: 9003 },
      });
    });

    it("falls back to an ancestor source when the local key is absent", () => {
      let auth0 = command(
        name("auth0"),
        withEnvs([{
          name: "auth0.json",
          value: { AUTH0_DOMAIN: "auth0.local" },
        }]),
        option(name("port"), schema(z.number())),
      );
      let app = command(
        name("simulacrum"),
        withEnvs([{
          name: "settings",
          value: { AUTH0_PORT: "9001" },
        }]),
        routes(auth0),
      );
      let result = parse(app, { argv: ["auth0"] });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/auth0",
        model: { port: 9001 },
      });
    });

    it("lets distinct target addresses read the same environment key", () => {
      let auth0 = command(
        name("auth0"),
        option(
          name("secondary"),
          env("PORT"),
          schema(z.number()),
        ),
      );
      let app = command(
        name("simulacrum"),
        option(
          name("primary"),
          env("PORT"),
          schema(z.number()),
        ),
        routes(auth0),
      );
      let result = parse(app, {
        argv: ["auth0"],
        envs: [{ name: "process", value: { PORT: "9001" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/auth0",
        models: {
          "/": { primary: 9001 },
          "/auth0": { secondary: 9001 },
        },
      });
    });

    it("ignores unconsumed environment keys", () => {
      let app = command(name("simulacrum"));
      let result = parse(app, {
        argv: [],
        envs: [{
          name: "process",
          value: { UNRELATED: "value" },
        }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/",
        model: {},
      });
    });
  });

  describe("dynamic phases", () => {
    it("keeps input environment sources available to later parameters", () => {
      let app = command(
        name("simulacrum"),
        dynamic((_plugins: Plugins) =>
          extend(
            option(name("domain"), schema(z.string())),
          )
        ),
      );
      let increment = parse(app, {
        argv: [],
        envs: [{
          name: "process",
          value: { DOMAIN: "auth0.local" },
        }],
      });

      assertIncrement(increment);
      let result = increment.resume({
        ok: true,
        value: { names: ["auth0"] },
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/",
        model: { domain: "auth0.local" },
      });
    });

    it("uses the final path when mapping a dynamically introduced route", () => {
      let auth0 = command(
        name("auth0"),
        option(name("port"), schema(z.number())),
      );
      let app = command(
        name("simulacrum"),
        dynamic((_plugins: Plugins) => extend(routes(auth0))),
      );
      let increment = parse(app, {
        argv: ["auth0"],
        envs: [{
          name: "process",
          value: { AUTH0_PORT: "9001" },
        }],
      });

      assertIncrement(increment);
      let result = increment.resume({
        ok: true,
        value: { names: ["auth0"] },
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/auth0",
        model: { port: 9001 },
      });
    });

    it("keeps dynamically introduced environment sources available downstream", () => {
      let app = command(
        name("simulacrum"),
        dynamic((_plugins: Plugins) =>
          extend(
            withEnvs([{
              name: "settings",
              value: { DOMAIN: "auth0.local" },
            }]),
            dynamic((_services: Plugins) =>
              extend(
                option(name("domain"), schema(z.string())),
              )
            ),
          )
        ),
      );
      let first = parse(app, { argv: [] });

      assertIncrement(first);
      let second = first.resume({
        ok: true,
        value: { names: ["config"] },
      });

      assertIncrement(second);
      let result = second.resume({
        ok: true,
        value: { names: ["auth0"] },
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/",
        model: { domain: "auth0.local" },
      });
    });

    it("binds environment input needed to discover a help route", () => {
      let auth0 = command(name("auth0"));
      let app = command(
        name("simulacrum"),
        option(name("config"), schema(z.string())),
        dynamic((_plugins: Plugins) => extend(routes(auth0))),
      );
      let increment = parse(app, {
        argv: ["auth0", "--help"],
        envs: [{
          name: "process",
          value: { CONFIG: "plugins.json" },
        }],
      });

      assertIncrement(increment, { config: "plugins.json" });
      let result = increment.resume({
        ok: true,
        value: { names: ["auth0"] },
      });

      expect(result).toMatchObject({
        ok: true,
        method: "help",
        route: "/auth0",
      });
    });
  });
});

interface Plugins {
  readonly names: readonly string[];
}

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends
  (<T>() => T extends R ? 1 : 2)
  ? (<T>() => T extends R ? 1 : 2) extends (<T>() => T extends L ? 1 : 2) ? true
  : false
  : false;

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}

function assertIncrement<T>(
  result: T,
  model: object = {},
): asserts result is Extract<
  T,
  { readonly ok: true; readonly resume: unknown }
> {
  expect(result).toMatchObject({
    ok: true,
    route: "/",
    model,
  });
  expect(
    typeof (result as { readonly resume?: unknown }).resume,
  ).toBe("function");
}
