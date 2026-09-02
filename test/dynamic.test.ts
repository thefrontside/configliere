import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { command } from "../lib/command.ts";
import { name } from "../lib/definition.ts";
import {
  type ConjoinPhases,
  dynamic,
  type PhasesOf,
  type Seed,
} from "../lib/dynamic.ts";
import { extend } from "../lib/extend.ts";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { parse } from "../lib/parse.ts";
import { printHelp } from "../lib/print.ts";
import type { Result } from "../lib/result.ts";
import { route, routes, version } from "../lib/route.ts";
import type {
  AnyRoute,
  ChildrenOf,
  ContinuationOf,
  Done,
  MethodsOf,
  ModelOf,
  Next,
  Parse,
  ParseIncrement,
  RequirementOf,
  RequirementsOf,
  Route,
} from "../lib/types.ts";
import { toggle } from "../lib/toggle.ts";

describe("dynamic()", () => {
  it("starts its extension with aggregate state and a fresh phase", () => {
    type Child = Route<
      "serve",
      "help" | "execute",
      { port: number },
      [],
      readonly [Done<{ port: number }, []>]
    >;
    type Before = Route<
      "simulacrum",
      "help" | "execute",
      { config: string },
      readonly [Child],
      readonly [Done<{ config: string }, readonly [Child]>]
    >;
    type Next = Seed<Before>;

    expectType<Equal<ModelOf<Next>, { config: string }>>(true);
    expectType<Equal<ChildrenOf<Next>, readonly [Child]>>(true);
    expectType<
      Equal<PhasesOf<Next>, readonly [Done<{}, []>]>
    >(true);
  });

  it("replaces the terminal continuation before appending downstream phases", () => {
    type A = Route<
      "simulacrum",
      "help" | "execute",
      { a: string; b: number },
      [],
      readonly [
        Next<{ a: string }, [], Config>,
        Done<{ b: number }, []>,
      ]
    >;
    type B = Route<
      "simulacrum",
      "help" | "execute",
      { a: string; b: number; c: boolean; d: string },
      [],
      readonly [
        Next<{ c: boolean }, [], Plugins>,
        Done<{ d: string }, []>,
      ]
    >;
    type Actual = ConjoinPhases<A, B, Services>;
    type Expected = readonly [
      Next<{ a: string }, [], Config>,
      Next<{ b: number }, [], Services>,
      Next<{ c: boolean }, [], Plugins>,
      Done<{ d: string }, []>,
    ];

    expectType<Equal<Actual, Expected>>(true);
  });

  it("infers its requirements from the resolver parameters", () => {
    let app = command(
      name("simulacrum"),
      option(name("config"), schema(type("string"))),
      dynamic((_config: Config) => extend()),
    );

    expectType<Equal<RequirementsOf<typeof app>, readonly [Config]>>(true);
    expectType<Equal<RequirementOf<typeof app>, Config>>(true);
  });

  it("collects recursive requirements in resume order", () => {
    let app = command(
      name("simulacrum"),
      dynamic((_config: Config) =>
        extend(
          dynamic((_plugins: Plugins) => extend()),
        )
      ),
    );

    type Next = ContinuationOf<typeof app>;

    expectType<
      Equal<RequirementsOf<typeof app>, readonly [Config, Plugins]>
    >(true);
    expectType<Equal<RequirementOf<typeof app>, Config>>(true);
    expectType<Equal<RequirementsOf<Next>, readonly [Plugins]>>(true);
    expectType<Equal<RequirementOf<Next>, Plugins>>(true);
  });

  it("infers its continuation from the returned extension", () => {
    let app = command(
      name("simulacrum"),
      option(name("config"), schema(type("string"))),
      dynamic((_config: Config) =>
        extend(
          option(name("port"), schema(type("number"))),
          option(name("domain"), schema(type("string"))),
        )
      ),
    );

    type Next = ContinuationOf<typeof app>;

    expectType<
      Equal<
        ModelOf<Next>,
        { config: string; port: number; domain: string }
      >
    >(true);
    expectType<
      Equal<
        PhasesOf<Next>,
        readonly [Done<{ port: number; domain: string }, []>]
      >
    >(true);
  });

  it("preserves route-level controls across phases", () => {
    let app = command(
      name("simulacrum"),
      version("1.2.0"),
      option(name("config"), schema(type("string"))),
      dynamic((_config: Config) =>
        extend(
          option(name("port"), schema(type("number"))),
        )
      ),
    );

    type Next = ContinuationOf<typeof app>;

    expectType<
      Equal<MethodsOf<Next>, "help" | "execute" | "version">
    >(true);
    expectType<
      Equal<ModelOf<Next>, { config: string; port: number }>
    >(true);
  });

  it("continues composing from the conjoined route", () => {
    let app = command(
      name("simulacrum"),
      dynamic((_config: Config) => extend()),
      option(name("port"), schema(type("number"))),
    );

    expectType<Equal<ModelOf<typeof app>, { port: number }>>(true);
    expectType<
      Equal<
        PhasesOf<typeof app>,
        readonly [
          Next<{}, [], Config>,
          Done<{ port: number }, []>,
        ]
      >
    >(true);
  });

  it("rejects a resolver that does not return an extension", () => {
    check(() => {
      // @ts-expect-error a command is a definition, not a route extension.
      dynamic((_config: Config) => command(name("serve")));
    });
  });

  describe("parse()", () => {
    describe("single checkpoint", () => {
      it("returns an increment containing only its phase model", () => {
        let app = command(
          name("simulacrum"),
          option(name("config"), schema(type("string"))),
          dynamic((_config: Config) => extend()),
        );
        let result = parse(app, {
          argv: ["--config", "simulacrum.json"],
        });

        type Success = Extract<typeof result, { readonly ok: true }>;

        expectType<Equal<Success, ParseIncrement<typeof app>>>(true);
        assertIncrement(result, { config: "simulacrum.json" });
      });

      it("validates its phase before exposing an increment", () => {
        let app = command(
          name("simulacrum"),
          option(name("config"), schema(type("string"))),
          dynamic((_config: Config) => extend()),
        );
        let result = parse(app, { argv: [] });

        expect(result).toMatchObject({
          ok: false,
          code: "unprocessable-content",
          issues: [{ path: ["config"] }],
        });
      });

      it("applies the returned extension and completes the parse", () => {
        let app = command(
          name("simulacrum"),
          option(name("config"), schema(type("string"))),
          dynamic((_config: Config) =>
            extend(option(name("port"), schema(type("number"))))
          ),
        );
        let first = parse(app, {
          argv: ["--config", "simulacrum.json", "--port", "9001"],
        });

        assertIncrement(first, { config: "simulacrum.json" });
        let result = first.resume({
          ok: true,
          value: { services: [] },
        });

        expect(result).toMatchObject({
          ok: true,
          method: "execute",
          route: "/",
          model: {
            config: "simulacrum.json",
            port: 9001,
          },
        });
      });

      it("turns a failed requirement into unprocessable content", () => {
        let app = command(
          name("simulacrum"),
          option(name("config"), schema(type("string"))),
          dynamic((_config: Config) => extend()),
        );
        let first = parse(app, {
          argv: ["--config", "broken.json"],
        });

        assertIncrement(first, { config: "broken.json" });
        let result = first.resume({
          ok: false,
          issues: [{ message: "could not load broken.json" }],
        });

        expect(result).toMatchObject({
          ok: false,
          code: "unprocessable-content",
          route: "/",
          path: [],
          issues: [{ message: "could not load broken.json" }],
        });
      });
    });

    describe("recursive phases", () => {
      it("binds every phase from the original CLI source", () => {
        let app = command(
          name("simulacrum"),
          option(name("a"), schema(type("string"))),
          dynamic((_config: Config) =>
            extend(
              option(name("b"), schema(type("string"))),
              dynamic((_plugins: Plugins) =>
                extend(option(name("c"), schema(type("string"))))
              ),
            )
          ),
        );
        let first = parse(app, {
          argv: ["--a", "one", "--b", "two", "--c", "three"],
        });

        assertIncrement(first, { a: "one" });
        let second = first.resume({
          ok: true,
          value: { services: [] },
        });

        assertIncrement(second, { b: "two" });
        let result = second.resume({
          ok: true,
          value: { names: [] },
        });

        expect(result).toMatchObject({
          ok: true,
          method: "execute",
          route: "/",
          model: { a: "one", b: "two", c: "three" },
        });
      });

      it("does not let a later phase rebind a completed parameter", () => {
        let app = command(
          name("simulacrum"),
          option(name("a"), schema(type("string"))),
          dynamic((_config: Config) =>
            extend(option(name("b"), schema(type("string"))))
          ),
        );
        let first = parse(app, {
          argv: ["--a", "one", "--b", "two", "--a", "three"],
        });

        assertIncrement(first, { a: "one" });
        let result = first.resume({
          ok: true,
          value: { services: [] },
        });

        expect(result).toMatchObject({
          ok: false,
          code: "unprocessable-content",
          issues: [
            { message: 'unexpected "--a"' },
            { message: 'unexpected "three"' },
          ],
        });
      });
    });

    describe("dynamic routes", () => {
      // Runtime assertions bridge child increments until Parse<R> includes
      // them statically.
      it("assigns precursor tokens to the parent of a dynamic child", () => {
        let auth0 = command(name("auth0"));
        let clean = command(
          name("clean"),
          toggle(name("truncate")),
          dynamic(() => extend(routes(auth0))),
        );
        let app = command(name("simulacrum"), routes(clean));
        let increment = parse(app, {
          argv: ["clean", "--truncate", "auth0"],
        });

        expect(increment).toMatchObject({
          route: "/clean",
          model: { truncate: true },
        });

        assertAnyIncrement(increment);

        let result = increment.resume({
          ok: true,
          value: { names: ["auth0"] },
        });
        expect(result).toMatchObject({
          method: "execute",
          route: "/clean/auth0",
          models: {
            "/": {},
            "/clean": { truncate: true },
            "/clean/auth0": {},
          },
        });
      });

      it("assigns tokens after a dynamic selector to the child", () => {
        let auth0 = command(name("auth0"), toggle(name("verbose")));
        let clean = command(
          name("clean"),
          toggle(name("verbose")),
          dynamic((_plugins: Plugins) => extend(routes(auth0))),
        );
        let app = command(name("simulacrum"), routes(clean));
        let increment = parse(app, {
          argv: ["clean", "auth0", "--verbose"],
        });

        expect(increment).toMatchObject({
          route: "/clean",
          model: { verbose: false },
        });
        assertAnyIncrement(increment);

        let result = increment.resume({
          ok: true,
          value: { names: ["auth0"] },
        });

        expect(result).toMatchObject({
          method: "execute",
          route: "/clean/auth0",
          models: {
            "/": {},
            "/clean": { verbose: false },
            "/clean/auth0": { verbose: true },
          },
        });
      });

      it("adds parameters and children to the same later phase", () => {
        let auth0 = command(name("auth0"));
        let clean = command(
          name("clean"),
          dynamic((_plugins: Plugins) =>
            extend(
              toggle(name("audit")),
              routes(auth0),
            )
          ),
        );
        let app = command(name("simulacrum"), routes(clean));
        let increment = parse(app, {
          argv: ["clean", "--audit", "auth0"],
        });

        expect(increment).toMatchObject({
          route: "/clean",
          model: {},
        });
        assertAnyIncrement(increment);

        let result = increment.resume({
          ok: true,
          value: { names: ["auth0"] },
        });

        expect(result).toMatchObject({
          method: "execute",
          route: "/clean/auth0",
          models: {
            "/": {},
            "/clean": { audit: true },
            "/clean/auth0": {},
          },
        });
      });

      it("gives a dynamic child selector priority over an option value", () => {
        let auth0 = command(name("auth0"));
        let clean = command(
          name("clean"),
          dynamic((_plugins: Plugins) =>
            extend(
              option(name("target"), schema(type("string"))),
              routes(auth0),
            )
          ),
        );
        let app = command(name("simulacrum"), routes(clean));
        let increment = parse(app, {
          argv: ["clean", "--target", "auth0"],
        });

        assertAnyIncrement(increment);
        let result = increment.resume({
          ok: true,
          value: { names: ["auth0"] },
        });

        expect(result).toMatchObject({
          ok: false,
          code: "unprocessable-content",
          route: "/clean/auth0",
          issues: [{ message: "--target requires a value" }],
        });
      });

      it("does not let a parent claim tokens after its child selector", () => {
        let auth0 = command(name("auth0"), toggle(name("audit")));
        let clean = command(
          name("clean"),
          dynamic((_plugins: Plugins) =>
            extend(
              toggle(name("audit")),
              routes(auth0),
            )
          ),
        );
        let app = command(name("simulacrum"), routes(clean));
        let increment = parse(app, {
          argv: ["clean", "auth0", "--audit"],
        });

        expect(increment).toMatchObject({
          route: "/clean",
          model: {},
        });
        assertAnyIncrement(increment);

        let result = increment.resume({
          ok: true,
          value: { names: ["auth0"] },
        });

        expect(result).toMatchObject({
          method: "execute",
          route: "/clean/auth0",
          models: {
            "/": {},
            "/clean": { audit: false },
            "/clean/auth0": { audit: true },
          },
        });
      });

      it("defers an unknown token until the route frame is final", () => {
        let clean = command(
          name("clean"),
          dynamic((_plugins: Plugins) => extend()),
        );
        let app = command(name("simulacrum"), routes(clean));
        let increment = parse(app, { argv: ["clean", "auth0"] });

        expect(increment).toMatchObject({
          route: "/clean",
          model: {},
        });
        assertAnyIncrement(increment);

        let result = increment.resume({
          ok: true,
          value: { names: [] },
        });

        expect(result).toMatchObject({
          ok: false,
          code: "unprocessable-content",
          route: "/clean",
          issues: [{ message: 'unexpected "auth0"' }],
        });
      });
    });

    describe("nested route frames", () => {
      it("yields phase-local models and finishes with path-addressed models", () => {
        let clean = command(
          name("clean"),
          toggle(name("truncate")),
          dynamic((_child: { readonly child: true }) => extend()),
        );
        let app = command(
          name("simulacrum"),
          option(name("config"), schema(type("string"))),
          routes(clean),
          dynamic((_root: { readonly root: true }) => extend()),
        );
        let root = parse(app, {
          argv: ["--config", "app.json", "clean", "--truncate"],
        });

        assertIncrement(root, { config: "app.json" });
        let child = root.resume({
          ok: true,
          value: { root: true },
        });

        expect(child).toMatchObject({
          route: "/clean",
          model: { truncate: true },
        });
        assertAnyIncrement(child);

        let result = child.resume({
          ok: true,
          value: { child: true },
        });

        expect(result).toMatchObject({
          ok: true,
          method: "execute",
          route: "/clean",
          models: {
            "/": { config: "app.json" },
            "/clean": { truncate: true },
          },
        });
      });
    });

    describe("controls", () => {
      it("waits for a phase that can introduce the requested help route", () => {
        let auth0 = command(name("auth0"));
        let app = command(
          name("simulacrum"),
          dynamic((_plugins: Plugins) => extend(routes(auth0))),
        );
        let first = parse(app, { argv: ["auth0", "--help"] });

        assertIncrement(first, {});
        let result = first.resume({
          ok: true,
          value: { names: ["auth0"] },
        });

        expect(result).toMatchObject({
          ok: true,
          method: "help",
          route: "/auth0",
        });
      });

      it("waits for all root phases before returning root help", () => {
        let app = command(
          name("simulacrum"),
          dynamic((_plugins: Plugins) => extend()),
        );
        let first = parse(app, { argv: ["--help"] });

        assertIncrement(first, {});
        let result = first.resume({
          ok: true,
          value: { names: [] },
        });

        expect(result).toMatchObject({
          ok: true,
          method: "help",
          route: "/",
        });
      });

      it("prints declarations from both sides of a dynamic phase", () => {
        let app = route(
          name("simulacrum"),
          option(name("config")),
          dynamic((_plugins: Plugins) => option(name("dyno"))),
          option(name("delay")),
          routes(command(name("serve"))),
        );
        let first = parse(app, { argv: ["--help"] });

        assertIncrement(first, { config: undefined });
        let result = first.resume({
          ok: true,
          value: { names: [] },
        });

        expect(result).toMatchObject({
          ok: true,
          method: "help",
          route: "/",
        });
        if (!result.ok || result.method !== "help") {
          throw new Error("expected help");
        }

        expect(printHelp(result)).toBe(`simulacrum

Usage:
  simulacrum [OPTIONS] <COMMAND>

Commands:
  serve

Options:
  --config <VALUE>
  --dyno <VALUE>
  --delay <VALUE>
  -h, --help        Print help`);
      });

      it("resolves version against a route introduced by a phase", () => {
        let release = route(name("release"), version("2.0.0"));
        let app = command(
          name("simulacrum"),
          dynamic((_plugins: Plugins) => extend(routes(release))),
        );
        let first = parse(app, { argv: ["release", "--version"] });

        assertIncrement(first, {});
        let result = first.resume({
          ok: true,
          value: { names: ["release"] },
        });

        expect(result).toMatchObject({
          ok: true,
          method: "version",
          route: "/release",
        });
      });

      it("resolves execute against a route introduced by a phase", () => {
        let serve = command(name("serve"));
        let app = command(
          name("simulacrum"),
          dynamic((_plugins: Plugins) => extend(routes(serve))),
        );
        let first = parse(app, { argv: ["serve"] });

        assertIncrement(first, {});
        let result = first.resume({
          ok: true,
          value: { names: ["serve"] },
        });

        expect(result).toMatchObject({
          ok: true,
          method: "execute",
          route: "/serve",
        });
      });
    });

    describe("future sources", () => {
      // Input does not expose value or environment sources yet.
      it.skip("lets a later phase claim an existing value source", () => {
        // let app = command(
        //   name("simulacrum"),
        //   dynamic((_config: Config) =>
        //     extend(option(name("b"), prop("b")))
        //   ),
        // );
        // let first = parse(app, {
        //   argv: [],
        //   values: [{ name: "settings", value: { b: "two" } }],
        // });
        // increment(first, {});
        // let result = first.resume({
        //   ok: true,
        //   value: { services: [] },
        // });
        // expect(result).toMatchObject({
        //   method: "execute",
        //   model: { b: "two" },
        // });
      });

      it.skip("lets a later phase claim an existing environment source", () => {
        // let app = command(
        //   name("simulacrum"),
        //   dynamic((_config: Config) =>
        //     extend(option(name("b"), env("B")))
        //   ),
        // );
        // let first = parse(app, {
        //   argv: [],
        //   envs: [{ name: "process", value: { B: "two" } }],
        // });
        // increment(first, {});
        // let result = first.resume({
        //   ok: true,
        //   value: { services: [] },
        // });
        // expect(result).toMatchObject({
        //   method: "execute",
        //   model: { b: "two" },
        // });
      });
    });
  });
});

interface Config {
  readonly services: readonly string[];
}

interface Plugins {
  readonly names: readonly string[];
}

interface Services {
  readonly count: number;
}

interface RuntimeIncrement {
  readonly ok: true;
  readonly route: string;
  readonly model: object;
  resume(result: Result<unknown>): unknown;
}

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends
  (<T>() => T extends R ? 1 : 2)
  ? (<T>() => T extends R ? 1 : 2) extends (<T>() => T extends L ? 1 : 2) ? true
  : false
  : false;

function assertIncrement<R extends AnyRoute>(
  result: Parse<R>,
  model: object,
): asserts result is Parse<R> & ParseIncrement<R> {
  expect(result).toMatchObject({ ok: true, model });
  expect("resume" in result).toBe(true);
}

function assertAnyIncrement(
  result: unknown,
): asserts result is RuntimeIncrement {
  expect(result).toMatchObject({ ok: true });
  expect(
    typeof (result as { readonly resume?: unknown }).resume,
  ).toBe("function");
}

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}

function check(_body: () => void): void {
  // Compile the callback without executing it.
}
