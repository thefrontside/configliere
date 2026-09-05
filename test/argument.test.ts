import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import {
  argument,
  command,
  extend,
  type ModelOf,
  name,
  option,
  parse,
  routes,
  schema,
  toggle,
} from "@frontside/configliere";
import { dynamic } from "../lib/dynamic.ts";

describe("argument()", () => {
  describe("types", () => {
    it("adds its exact schema output to the route model", () => {
      let app = command(
        name("copy"),
        argument(name("source"), schema(type("string"))),
        argument(name("destination"), schema(type("string"))),
      );

      expectType<
        Equal<
          ModelOf<typeof app>,
          { source: string; destination: string }
        >
      >(true);
    });
  });

  describe("CLI binding", () => {
    it("binds a positional word", () => {
      let app = command(
        name("copy"),
        argument(name("source"), schema(type("string"))),
      );
      let result = parse(app, { argv: ["input.txt"] });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/",
        model: { source: "input.txt" },
      });
    });

    it("binds several arguments in declaration order", () => {
      let app = command(
        name("copy"),
        argument(name("source"), schema(type("string"))),
        argument(name("destination"), schema(type("string"))),
      );
      let result = parse(app, {
        argv: ["input.txt", "output.txt"],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/",
        model: {
          source: "input.txt",
          destination: "output.txt",
        },
      });
    });

    it("binds a positional word before a later option", () => {
      let app = command(
        name("app"),
        argument(name("input"), schema(type("string"))),
        option(name("port"), schema(type("number"))),
      );
      let result = parse(app, {
        argv: ["input.txt", "--port", "9000"],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { input: "input.txt", port: 9000 },
      });
    });

    it.skip("does not let a positional reader steal an option value", () => {
      let app = command(
        name("app"),
        argument(name("input"), schema(type("string"))),
        option(name("port"), schema(type("number"))),
      );
      let result = parse(app, {
        argv: ["--port", "9000", "input.txt"],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { input: "input.txt", port: 9000 },
      });
    });

    it("binds a positional word following a switch", () => {
      let app = command(
        name("app"),
        argument(name("input"), schema(type("string"))),
        toggle(name("verbose")),
      );
      let result = parse(app, {
        argv: ["--verbose", "input.txt"],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { input: "input.txt", verbose: true },
      });
    });
  });

  describe("routing", () => {
    it("binds words on each side of a selector to their route segments", () => {
      let auth0 = command(
        name("auth0"),
        argument(name("manifest"), schema(type("string"))),
      );
      let app = command(
        name("app"),
        argument(name("workspace"), schema(type("string"))),
        routes(auth0),
      );
      let result = parse(app, {
        argv: ["local", "auth0", "service.json"],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/auth0",
        model: { manifest: "service.json" },
        models: {
          "/": { workspace: "local" },
          "/auth0": { manifest: "service.json" },
        },
      });
    });

    it("gives a visible child selector priority over an argument", () => {
      let auth0 = command(name("auth0"));
      let app = command(
        name("app"),
        argument(name("workspace"), schema(type("string | undefined"))),
        routes(auth0),
      );
      let result = parse(app, { argv: ["auth0"] });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/auth0",
        models: {
          "/": { workspace: undefined },
          "/auth0": {},
        },
      });
    });
  });

  describe("sources", () => {
    it("prefers a positional CLI value over environment and values", () => {
      let app = command(
        name("app"),
        argument(name("input"), schema(type("string"))),
      );
      let result = parse(app, {
        argv: ["cli.txt"],
        envs: [{ name: "process", value: { INPUT: "env.txt" } }],
        values: [{ name: "config", value: { input: "value.txt" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { input: "cli.txt" },
      });
    });

    it("uses environment when the positional value is absent", () => {
      let app = command(
        name("app"),
        argument(name("input"), schema(type("string"))),
      );
      let result = parse(app, {
        argv: [],
        envs: [{ name: "process", value: { INPUT: "env.txt" } }],
        values: [{ name: "config", value: { input: "value.txt" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { input: "env.txt" },
      });
    });

    it("uses a JavaScript value when CLI and environment are absent", () => {
      let app = command(
        name("app"),
        argument(name("input"), schema(type("string"))),
      );
      let result = parse(app, {
        argv: [],
        values: [{ name: "config", value: { input: "value.txt" } }],
      });

      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        model: { input: "value.txt" },
      });
    });
  });

  describe("validation", () => {
    it("reports a missing required argument at its parameter address", () => {
      let app = command(
        name("app"),
        argument(name("input"), schema(type("string"))),
      );
      let result = parse(app, { argv: [] });

      expect(result).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        route: "/",
        issues: [{ path: ["input"] }],
      });
    });

    it("reports a word left after all arguments are bound", () => {
      let app = command(
        name("app"),
        argument(name("input"), schema(type("string"))),
      );
      let result = parse(app, {
        argv: ["input.txt", "extra.txt"],
      });

      expect(result).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        route: "/",
        issues: [{ message: 'unexpected "extra.txt"' }],
      });
    });
  });

  describe("phases", () => {
    it("lets a later phase bind an unclaimed argument on the same route", () => {
      let app = command(
        name("app"),
        option(name("config"), schema(type("string"))),
        dynamic(() =>
          extend(
            argument(name("input"), schema(type("string"))),
          )
        ),
      );
      let increment = parse(app, {
        argv: ["--config", "app.json", "input.txt"],
      });

      expect(increment).toMatchObject({
        ok: true,
        route: "/",
        model: { config: "app.json" },
      });
      assertIncrement(increment);

      let result = increment.resume({ ok: true, value: undefined });
      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/",
        model: { config: "app.json", input: "input.txt" },
      });
    });

    it("does not reinterpret an argument claimed before a route is introduced", () => {
      let app = command(
        name("app"),
        argument(name("target"), schema(type("string"))),
        dynamic(() =>
          extend(
            routes(command(name("auth0"))),
          )
        ),
      );
      let increment = parse(app, { argv: ["auth0"] });

      expect(increment).toMatchObject({
        ok: true,
        route: "/",
        model: { target: "auth0" },
      });
      assertIncrement(increment);

      let result = increment.resume({ ok: true, value: undefined });
      expect(result).toMatchObject({
        ok: true,
        method: "execute",
        route: "/",
        model: { target: "auth0" },
      });
    });
  });
});

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends
  (<T>() => T extends R ? 1 : 2) ? true
  : false;

function expectType<T extends true>(_value: T): void {}

function assertIncrement(
  result: unknown,
): asserts result is {
  resume(result: { readonly ok: true; readonly value: undefined }): unknown;
} {
  expect(result).toMatchObject({ ok: true });
  expect(
    typeof (result as { readonly resume?: unknown }).resume,
  ).toBe("function");
}
