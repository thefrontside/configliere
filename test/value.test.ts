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
import { withValues } from "../lib/values.ts";

describe("value sources", () => {
  it("binds top-level properties to root parameters", () => {
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

  it("scopes nested properties by route name", () => {
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

  it("combines disjoint properties from several value sources", () => {
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

  it("validates values without applying the CLI decoder", () => {
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

  it("lets CLI override a value source", () => {
    let app = command(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
    );
    let result = parse(app, {
      argv: ["--port", "9001"],
      values: [{
        name: "settings",
        value: { port: "not a number" },
      }],
    });

    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/",
      model: { port: 9001 },
    });
  });

  it("retries CLI before falling back to values", () => {
    let app = command(
      name("simulacrum"),
      // Port cannot initially see beyond the value consumed by target.
      option(name("port"), schema(type("number"))),
      option(name("target"), schema(type("string"))),
    );
    let result = parse(app, {
      argv: ["--target", "local", "--port", "9001"],
      values: [{
        name: "settings",
        value: { port: 8000 },
      }],
    });

    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/",
      model: {
        port: 9001,
        target: "local",
      },
    });
  });

  it("does not hide an incomplete CLI option with a value", () => {
    let app = command(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
    );
    let result = parse(app, {
      argv: ["--port"],
      values: [{
        name: "settings",
        value: { port: 9001 },
      }],
    });

    expect(result).toMatchObject({
      ok: false,
      code: "unprocessable-content",
      route: "/",
      issues: [{ message: "--port requires a value" }],
    });
  });

  it("does not hide an invalid CLI value with a value", () => {
    let app = command(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
    );
    let result = parse(app, {
      argv: ["--port", "nope"],
      values: [{
        name: "settings",
        value: { port: 9001 },
      }],
    });

    expect(result).toMatchObject({
      ok: false,
      code: "unprocessable-content",
      route: "/",
      issues: [{ path: ["port"] }],
    });
  });

  it("does not hide an invalid value with a later value", () => {
    let app = command(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
    );
    let result = parse(app, {
      argv: [],
      values: [
        {
          name: "settings",
          value: { port: "nope" },
        },
        {
          name: "defaults",
          value: { port: 9001 },
        },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      code: "unprocessable-content",
      route: "/",
      issues: [{ path: ["port"] }],
    });
  });

  it("treats an explicit undefined value as present", () => {
    let app = command(
      name("simulacrum"),
      option(name("port"), schema(type("number | undefined"))),
    );
    let result = parse(app, {
      argv: [],
      values: [
        {
          name: "settings",
          value: { port: undefined },
        },
        {
          name: "defaults",
          value: { port: 9001 },
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/",
      model: { port: undefined },
    });
  });

  it("uses values declared on a phase", () => {
    let app = command(
      name("simulacrum"),
      withValues([{
        name: "defaults",
        value: { port: 9001 },
      }]),
      option(name("port"), schema(type("number"))),
    );
    let result = parse(app, { argv: [] });

    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/",
      model: { port: 9001 },
    });
  });

  it("prefers values mounted on the selected route", () => {
    let auth0 = command(
      name("auth0"),
      withValues([{
        name: "auth0.json",
        value: { port: 9003 },
      }]),
      option(name("port"), schema(type("number"))),
    );
    let app = command(
      name("simulacrum"),
      withValues([{
        name: "settings",
        value: { auth0: { port: 9001 } },
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

  it("keeps parent values separate from a dynamically discovered child", () => {
    let auth0 = command(
      name("auth0"),
      option(name("port"), schema(type("number"))),
    );
    let app = command(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
      option(name("target"), schema(type("string"))),
      dynamic((_plugins: Plugins) => extend(routes(auth0))),
    );
    let increment = parse(app, {
      argv: ["--target", "local", "auth0", "--port", "9001"],
      values: [{
        name: "settings",
        value: { port: 8000 },
      }],
    });

    assertIncrement(increment);
    expect(increment).toMatchObject({
      model: {
        port: 8000,
        target: "local",
      },
    });

    let result = increment.resume({
      ok: true,
      value: { names: ["auth0"] },
    });

    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/auth0",
      model: { port: 9001 },
      models: {
        "/": {
          port: 8000,
          target: "local",
        },
        "/auth0": { port: 9001 },
      },
    });
  });

  it("keeps values available to parameters introduced by a later phase", () => {
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

  it("keeps dynamically introduced values available downstream", () => {
    let app = command(
      name("simulacrum"),
      dynamic((_plugins: Plugins) =>
        extend(
          withValues([{
            name: "settings",
            value: { domain: "auth0.local" },
          }]),
          dynamic((_services: Plugins) =>
            extend(
              option(name("domain"), schema(type("string"))),
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
