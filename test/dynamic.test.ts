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
import { version } from "../lib/route.ts";
import type {
  ChildrenOf,
  ContinuationOf,
  Done,
  MethodsOf,
  ModelOf,
  Next,
  RequirementOf,
  RequirementsOf,
  Route,
} from "../lib/types.ts";

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
    it.skip("returns an increment exposing only the cumulative model before its requirement", () => {
      let app = command(
        name("simulacrum"),
        option(name("config"), schema(type("string"))),
        dynamic((_config: Config) => extend()),
      );

      let result = parse(app, {
        argv: ["--config", "simulacrum.json"],
      });

      type Success = Extract<typeof result, { readonly ok: true }>;

      // expectType<Equal<Success, ParseIncrement<typeof app>>>(true);
      // expect(result).toMatchObject({
      //   ok: true,
      //   model: { config: "simulacrum.json" },
      // });
      // expect("method" in result).toBe(false);
      // expect("resume" in result && typeof result.resume === "function").toBe(
      //   true,
      // );
    });

    it.skip("does not expose an increment until preceding input is valid", () => {
      // let app = command(
      //   name("simulacrum"),
      //   option(name("config"), schema(type("string"))),
      //   dynamic((_config: Config) => extend()),
      // );
      // let result = parse(app, { argv: [] });
      // expect(result).toMatchObject({
      //   ok: false,
      //   code: "unprocessable-content",
      //   issues: [{ path: ["config"] }],
      // });
      // expect("resume" in result).toBe(false);
    });

    it.skip("returns a failed requirement as unprocessable content", () => {
      // let app = command(
      //   name("simulacrum"),
      //   option(name("config"), schema(type("string"))),
      //   dynamic((_config: Config) => extend()),
      // );
      // let increment = parse(app, {
      //   argv: ["--config", "broken.json"],
      // });
      // let result = increment.resume({
      //   ok: false,
      //   issues: [{ message: "could not load broken.json" }],
      // });
      //
      // expect(result).toMatchObject({
      //   ok: false,
      //   code: "unprocessable-content",
      //   route: "/",
      //   path: [],
      //   issues: [{ message: "could not load broken.json" }],
      // });
    });

    describe("same route", () => {
      it.skip("binds each phase from the same original CLI source", () => {
        // let app = command(
        //   name("simulacrum"),
        //   option(name("a"), schema(type("string"))),
        //   dynamic((_config: Config) =>
        //     extend(
        //       option(name("b"), schema(type("string"))),
        //       dynamic((_plugins: Plugins) =>
        //         extend(option(name("c"), schema(type("string"))))
        //       ),
        //     )
        //   ),
        // );
        // let first = parse(app, {
        //   argv: ["--a", "one", "--b", "two", "--c", "three"],
        // });
        //
        // expect(first).toMatchObject({ model: { a: "one" } });
        // let second = first.resume({
        //   ok: true,
        //   value: { services: [] },
        // });
        // expect(second).toMatchObject({ model: { a: "one", b: "two" } });
        //
        // let result = second.resume({
        //   ok: true,
        //   value: { names: [] },
        // });
        // expect(result).toMatchObject({
        //   method: "execute",
        //   model: { a: "one", b: "two", c: "three" },
        // });
      });

      it.skip("lets a later phase claim an existing value source", () => {
        // let app = command(
        //   name("simulacrum"),
        //   dynamic((_config: Config) =>
        //     extend(option(name("b"), prop("b")))
        //   ),
        // );
        // let increment = parse(app, {
        //   argv: [],
        //   values: [{ name: "settings", value: { b: "two" } }],
        // });
        // let result = increment.resume({
        //   ok: true,
        //   value: { services: [] },
        // });
        //
        // expect(result).toMatchObject({ model: { b: "two" } });
      });

      it.skip("lets a later phase claim an existing environment source", () => {
        // let app = command(
        //   name("simulacrum"),
        //   dynamic((_config: Config) =>
        //     extend(option(name("b"), env("B")))
        //   ),
        // );
        // let increment = parse(app, {
        //   argv: [],
        //   envs: [{ name: "process", value: { B: "two" } }],
        // });
        // let result = increment.resume({
        //   ok: true,
        //   value: { services: [] },
        // });
        //
        // expect(result).toMatchObject({ model: { b: "two" } });
      });

      it.skip("does not let a later phase rebind a completed parameter", () => {
        // let app = command(
        //   name("simulacrum"),
        //   option(name("a"), schema(type("string"))),
        //   dynamic((_config: Config) =>
        //     extend(option(name("b"), schema(type("string"))))
        //   ),
        // );
        // let increment = parse(app, {
        //   argv: ["--a", "one", "--b", "two", "--a", "three"],
        // });
        // let result = increment.resume({
        //   ok: true,
        //   value: { services: [] },
        // });
        //
        // expect(result).toMatchObject({
        //   ok: false,
        //   code: "unprocessable-content",
        //   issues: [{ message: 'unexpected "--a"' }],
        // });
      });
    });

    describe("route segments", () => {
      it.skip("assigns precursor tokens to the parent of a dynamic child", () => {
        // let auth0 = command(name("auth0"));
        // let clean = command(
        //   name("clean"),
        //   toggle(name("truncate")),
        //   dynamic((_plugins: Plugins) => extend(routes(auth0))),
        // );
        // let app = command(name("simulacrum"), routes(clean));
        // let increment = parse(app, {
        //   argv: ["clean", "--truncate", "auth0"],
        // });
        //
        // expect(increment).toMatchObject({
        //   route: "/clean",
        //   model: { truncate: true },
        // });
        // let result = increment.resume({
        //   ok: true,
        //   value: { names: ["auth0"] },
        // });
        // expect(result).toMatchObject({
        //   method: "execute",
        //   route: "/clean/auth0",
        //   models: {
        //     "/": {},
        //     "/clean": { truncate: true },
        //     "/clean/auth0": {},
        //   },
        // });
      });

      it.skip("assigns tokens after a dynamic selector to the child", () => {
        // let auth0 = command(name("auth0"), toggle(name("verbose")));
        // let clean = command(
        //   name("clean"),
        //   toggle(name("verbose")),
        //   dynamic((_plugins: Plugins) => extend(routes(auth0))),
        // );
        // let app = command(name("simulacrum"), routes(clean));
        // let increment = parse(app, {
        //   argv: ["clean", "auth0", "--verbose"],
        // });
        // let result = increment.resume({
        //   ok: true,
        //   value: { names: ["auth0"] },
        // });
        //
        // expect(result).toMatchObject({
        //   route: "/clean/auth0",
        //   models: {
        //     "/": {},
        //     "/clean": { verbose: false },
        //     "/clean/auth0": { verbose: true },
        //   },
        // });
      });

      it.skip("adds parameters and children to the same later phase", () => {
        // let auth0 = command(name("auth0"));
        // let clean = command(
        //   name("clean"),
        //   dynamic((_plugins: Plugins) =>
        //     extend(
        //       toggle(name("audit")),
        //       routes(auth0),
        //     )
        //   ),
        // );
        // let app = command(name("simulacrum"), routes(clean));
        // let increment = parse(app, {
        //   argv: ["clean", "--audit", "auth0"],
        // });
        // expect(increment).toMatchObject({
        //   ok: true,
        //   route: "/clean",
        //   model: {},
        // });
        // expect("method" in increment).toBe(false);
        //
        // let result = increment.resume({
        //   ok: true,
        //   value: { names: ["auth0"] },
        // });
        //
        // expect(result).toMatchObject({
        //   route: "/clean/auth0",
        //   models: {
        //     "/": {},
        //     "/clean": { audit: true },
        //     "/clean/auth0": {},
        //   },
        // });
      });

      it.skip("lets an active parameter capture a word before treating it as a child selector", () => {
        // let auth0 = command(name("auth0"));
        // let clean = command(
        //   name("clean"),
        //   dynamic((_plugins: Plugins) =>
        //     extend(
        //       option(name("target"), schema(type("string"))),
        //       routes(auth0),
        //     )
        //   ),
        // );
        // let app = command(name("simulacrum"), routes(clean));
        // let increment = parse(app, {
        //   argv: ["clean", "--target", "auth0"],
        // });
        // let result = increment.resume({
        //   ok: true,
        //   value: { names: ["auth0"] },
        // });
        //
        // expect(result).toMatchObject({
        //   method: "execute",
        //   route: "/clean",
        //   model: { target: "auth0" },
        // });
      });

      it.skip("does not let a parent claim tokens after its child selector", () => {
        // let auth0 = command(name("auth0"), toggle(name("audit")));
        // let clean = command(
        //   name("clean"),
        //   dynamic((_plugins: Plugins) =>
        //     extend(
        //       toggle(name("audit")),
        //       routes(auth0),
        //     )
        //   ),
        // );
        // let app = command(name("simulacrum"), routes(clean));
        // let increment = parse(app, {
        //   argv: ["clean", "auth0", "--audit"],
        // });
        // let result = increment.resume({
        //   ok: true,
        //   value: { names: ["auth0"] },
        // });
        //
        // expect(result).toMatchObject({
        //   route: "/clean/auth0",
        //   models: {
        //     "/": {},
        //     "/clean": { audit: false },
        //     "/clean/auth0": { audit: true },
        //   },
        // });
      });

      it.skip("does not reconsider a child from a completed phase", () => {
        // let auth0 = command(name("auth0"));
        // let clean = command(
        //   name("clean"),
        //   routes(auth0),
        //   dynamic((_plugins: Plugins) =>
        //     extend(toggle(name("audit")))
        //   ),
        // );
        // let app = command(name("simulacrum"), routes(clean));
        // let increment = parse(app, {
        //   argv: ["clean", "--audit", "auth0"],
        // });
        // let result = increment.resume({
        //   ok: true,
        //   value: { names: [] },
        // });
        //
        // expect(result).toMatchObject({
        //   ok: false,
        //   code: "unprocessable-content",
        //   route: "/clean",
        //   issues: [{ message: 'unexpected "auth0"' }],
        // });
      });

      it.skip("defers an unknown token until the route frame is final", () => {
        // let clean = command(
        //   name("clean"),
        //   dynamic((_plugins: Plugins) => extend()),
        // );
        // let app = command(name("simulacrum"), routes(clean));
        // let increment = parse(app, { argv: ["clean", "auth0"] });
        //
        // expect(increment).toMatchObject({ ok: true, route: "/clean" });
        // let result = increment.resume({
        //   ok: true,
        //   value: { names: [] },
        // });
        // expect(result).toMatchObject({
        //   ok: false,
        //   code: "unprocessable-content",
        //   route: "/clean",
        //   issues: [{ message: 'unexpected "auth0"' }],
        // });
      });
    });

    describe("route frames", () => {
      it.skip("carries cumulative path-addressed models through nested increments", () => {
        // let clean = command(
        //   name("clean"),
        //   option(name("truncate"), schema(type("boolean"))),
        //   dynamic((_child: Child) => extend()),
        // );
        // let app = command(
        //   name("simulacrum"),
        //   option(name("config"), schema(type("string"))),
        //   routes(clean),
        //   dynamic((_root: Root) => extend()),
        // );
        // let root = parse(app, {
        //   argv: ["--config", "app.json", "clean", "--truncate", "true"],
        // });
        // expect(root).toMatchObject({
        //   route: "/clean",
        //   models: {
        //     "/": { config: "app.json" },
        //     "/clean": { truncate: true },
        //   },
        // });
        //
        // let child = root.resume({ ok: true, value: { root: true } });
        // expect(child).toMatchObject({
        //   models: {
        //     "/": { config: "app.json" },
        //     "/clean": { truncate: true },
        //   },
        // });
      });
    });

    describe("controls", () => {
      it.skip("waits for a phase that can introduce the requested help route", () => {
        // let auth0 = command(name("auth0"));
        // let app = command(
        //   name("simulacrum"),
        //   dynamic((_plugins: Plugins) => extend(routes(auth0))),
        // );
        // let increment = parse(app, { argv: ["auth0", "--help"] });
        //
        // expect("method" in increment).toBe(false);
        // let result = increment.resume({
        //   ok: true,
        //   value: { names: ["auth0"] },
        // });
        // expect(result).toMatchObject({
        //   ok: true,
        //   method: "help",
        //   route: "/auth0",
        // });
      });

      it.skip("waits for all root phases before returning root help", () => {
        // let app = command(
        //   name("simulacrum"),
        //   dynamic((_plugins: Plugins) => extend()),
        // );
        // let increment = parse(app, { argv: ["--help"] });
        // let result = increment.resume({
        //   ok: true,
        //   value: { names: [] },
        // });
        //
        // expect(result).toMatchObject({
        //   ok: true,
        //   method: "help",
        //   route: "/",
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

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends
  (<T>() => T extends R ? 1 : 2)
  ? (<T>() => T extends R ? 1 : 2) extends (<T>() => T extends L ? 1 : 2) ? true
  : false
  : false;

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}

function check(_body: () => void): void {
  // Compile the callback without executing it.
}
