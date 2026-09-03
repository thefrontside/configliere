import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { command } from "../lib/command.ts";
import { name } from "../lib/definition.ts";
import { dynamic } from "../lib/dynamic.ts";
import { extend } from "../lib/extend.ts";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { parse } from "../lib/parse.ts";
import { routes } from "../lib/route.ts";
import type { Parse } from "../lib/types.ts";

describe("value sources", () => {
  it.skip("binds top-level properties to root parameters", () => {
    let app = command(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
      option(name("domain"), schema(type("string"))),
    );
    let input = {
      argv: [],
      values: [{
        name: "settings",
        value: {
          port: 9001,
          domain: "auth0.local",
        },
      }],
    };
    let result = parse(app, input);

    expectType<Equal<typeof result, Parse<typeof app>>>(true);
    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/",
      model: {
        port: 9001,
        domain: "auth0.local",
      },
      models: {
        "/": {
          port: 9001,
          domain: "auth0.local",
        },
      },
    });
  });

  it.skip("scopes nested properties by route name", () => {
    let auth0 = command(
      name("auth0"),
      option(name("delay"), schema(type("number"))),
      option(name("port"), schema(type("number"))),
    );
    let app = command(
      name("simulacrum"),
      option(name("delay"), schema(type("number"))),
      routes(auth0),
    );
    let input = {
      argv: ["auth0"],
      values: [{
        name: "settings",
        value: {
          delay: 1000,
          auth0: {
            delay: 2000,
            port: 9001,
          },
        },
      }],
    };
    let result = parse(app, input);

    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/auth0",
      model: {
        delay: 2000,
        port: 9001,
      },
      models: {
        "/": { delay: 1000 },
        "/auth0": {
          delay: 2000,
          port: 9001,
        },
      },
    });
  });

  it.skip("combines disjoint properties from several value sources", () => {
    let app = command(
      name("simulacrum"),
      option(name("host"), schema(type("string"))),
      option(name("port"), schema(type("number"))),
    );
    let input = {
      argv: [],
      values: [
        {
          name: "defaults",
          value: { host: "localhost" },
        },
        {
          name: "settings",
          value: { port: 9001 },
        },
      ],
    };
    let result = parse(app, input);

    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/",
      model: {
        host: "localhost",
        port: 9001,
      },
    });
  });

  it.skip("validates values without applying the CLI decoder", () => {
    let app = command(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
    );
    let input = {
      argv: [],
      values: [{
        name: "settings",
        value: { port: "9001" },
      }],
    };
    let result = parse(app, input);

    expect(result).toMatchObject({
      ok: false,
      code: "unprocessable-content",
      route: "/",
      issues: [{ path: ["port"] }],
    });
  });

  it.skip("keeps values available to parameters introduced by a later phase", () => {
    let app = command(
      name("simulacrum"),
      dynamic((_plugins: Plugins) =>
        extend(
          option(name("domain"), schema(type("string"))),
        )
      ),
    );
    let input = {
      argv: [],
      values: [{
        name: "settings",
        value: { domain: "auth0.local" },
      }],
    };
    let increment = parse(app, input);

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
      models: {
        "/": { domain: "auth0.local" },
      },
    });
  });

  it.skip("handles a value key shared by a parameter and child route", () => {
    let auth0 = command(
      name("auth0"),
      option(name("port"), schema(type("number"))),
    );
    let app = command(
      name("simulacrum"),
      option(name("auth0")),
      routes(auth0),
    );
    let input = {
      argv: ["auth0"],
      values: [{
        name: "settings",
        value: {
          auth0: { port: 9001 },
        },
      }],
    };
    let result = parse(app, input);

    // Whether the root parameter also receives `value.auth0` remains open.
    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/auth0",
      models: {
        "/auth0": { port: 9001 },
      },
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

function assertIncrement<T>(
  result: T,
): asserts result is Extract<
  T,
  { readonly ok: true; readonly resume: unknown }
> {
  expect(result).toMatchObject({
    ok: true,
    route: "/",
    model: {},
  });
  expect(
    typeof (result as { readonly resume?: unknown }).resume,
  ).toBe("function");
}

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}
