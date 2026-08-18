// deno-lint-ignore-file no-import-prefix
import { expect as base, type Expected } from "jsr:@std/expect@^1.0.19";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { parse } from "../lib/parse.ts";
import { name, option, route, version } from "../lib/route.ts";
import type { AnyRoute, Resolve, Route } from "../lib/types.ts";

let app = route(
  name("simulacrum"),
  version("1.2.0"),
  option("port", type("number")),
);

describe("parse()", () => {
  describe("help", () => {
    it("resolves either help flag against the root route", () => {
      expect(
        $("simulacrum -h"),
      ).toHaveRoute("HELP /simulacrum");

      expect(
        $("simulacrum --help"),
      ).toHaveRoute("HELP /simulacrum");
    });

    it("resolves help before validating other arguments", () => {
      expect(
        $("simulacrum --unknown --help"),
      ).toHaveRoute("HELP /simulacrum");
    });

    it("does not treat help after -- as a control", () => {
      let result = exec("simulacrum -- --help");

      expect(result).toHaveRoute("EXECUTE /simulacrum");
    });

    it.skip("accounts for options left unconsumed by help", () => undefined);
  });

  describe("version", () => {
    it("resolves either version flag against a versioned route", () => {
      expect(
        $("simulacrum -v"),
      ).toHaveRoute("VERSION /simulacrum");

      expect(
        $("simulacrum --version"),
      ).toHaveRoute("VERSION /simulacrum");
    });

    it("resolves version before validating other arguments", () => {
      expect(
        $("simulacrum --unknown --version"),
      ).toHaveRoute("VERSION /simulacrum");
    });

    it("rejects version for a route without a version", () => {
      expect(plain("simulacrum --version")).toMatchObject({
        ok: false,
        code: "method-not-allowed",
        route: { name: "simulacrum" },
        path: [],
        method: "version",
        allowed: ["help"],
      });
    });

    it("does not treat version after -- as a control", () => {
      let result = exec("simulacrum -- --version");

      expect(result).toHaveRoute("EXECUTE /simulacrum");
    });
  });

  describe("routes", () => {
    it.skip("resolves a direct child route", () => undefined);
    it.skip("resolves the deepest matching route", () => undefined);
    it.skip("resolves controls against the deepest matching route", () =>
      undefined);
    it.skip("discovers routes across unresolved parameter tokens", () =>
      undefined);
    it.skip("stops discovering routes at --", () => undefined);
    it.skip("treats child names as route selectors before binding parameters", () =>
      undefined);
  });

  describe("segments", () => {
    it.skip("preserves parameter token order within each route segment", () =>
      undefined);
    it.skip("assigns tokens on either side of a selector to their respective routes", () =>
      undefined);
    it.skip("assigns literals to the matching route", () => undefined);
    it.skip("keeps literals separate from parameter tokens", () => undefined);
  });

  describe("route methods", () => {
    it.skip("uses the methods supported by the matching route", () =>
      undefined);
    it.skip("reports the matching route when a method is unsupported", () =>
      undefined);
    it.skip("allows an executable route to contain executable children", () =>
      undefined);
  });

  describe("binding", () => {
    it.skip("treats unmatched words as arguments to the matching route", () =>
      undefined);
    it.skip("reports surplus arguments as a binding error", () => undefined);
  });

  describe("types", () => {
    it("exposes only methods supported by a route", () => {
      type Plain = Route<"simulacrum", "help", Empty, []>;
      type Versioned = Route<
        "simulacrum",
        "help" | "version",
        Empty,
        []
      >;

      expectType<Equal<Resolve<Plain, []>["type"], "help">>(true);
      expectType<
        Equal<Resolve<Versioned, []>["type"], "help" | "version">
      >(true);
    });

    it.skip("exposes the exact intents of every reachable route", () =>
      undefined);
  });
});

const requests = new WeakMap<object, Request>();
const $ = cli(app);
const plain = cli(route(name("simulacrum")));
const exec = cli({
  ...name("simulacrum"),
  methods: ["help", "execute"] as const,
});

interface RouteExpected extends Expected {
  toHaveRoute(expected: Target): unknown;
}

interface Request {
  input: string;
  root: string;
}

interface Outcome {
  input: string;
  route: string;
  target: Target;
}

type Target = `${string} /${string}`;
type Empty = Record<never, never>;

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends
  (<T>() => T extends R ? 1 : 2)
  ? (<T>() => T extends R ? 1 : 2) extends (<T>() => T extends L ? 1 : 2) ? true
  : false
  : false;

base.extend({
  toHaveRoute(context, expected: Target) {
    let outcome = inspect(context.value);
    let leaf = outcome?.target.slice(outcome.target.lastIndexOf("/") + 1);
    let pass = outcome?.target === expected && outcome.route === leaf;

    return {
      pass,
      message: () =>
        outcome
          ? `Expected ${
            JSON.stringify(outcome.input)
          } to resolve ${expected}, ` +
            `but it resolved ${outcome.target} with route ${
              JSON.stringify(outcome.route)
            }`
          : `Expected a request resolving ${expected}, but received no route intent`,
    };
  },
});

const expect = base<RouteExpected>;

function cli<R extends AnyRoute>(app: R) {
  return (input: string) => {
    let [root, ...argv] = input.trim().split(/\s+/);

    if (root !== app.name) {
      throw new Error(
        `Expected command ${JSON.stringify(app.name)}, received ${
          JSON.stringify(root)
        }`,
      );
    }

    let result = parse(app, { argv });
    requests.set(result, { input, root });
    return result;
  };
}

function inspect(value: unknown): Outcome | undefined {
  if (!record(value)) {
    return;
  }

  let request = requests.get(value);
  if (!request) {
    return;
  }

  let { input, root } = request;
  let { ok, type, route, path } = value;
  if (
    ok !== true || typeof type !== "string" || !record(route) ||
    typeof route.name !== "string" || !Array.isArray(path) ||
    !path.every((part) => typeof part === "string")
  ) {
    return;
  }

  return {
    input,
    route: route.name,
    target: `${type.toUpperCase()} /${[root, ...path].join("/")}`,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}
