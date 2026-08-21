import { expect as base, type Expected } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { name } from "../lib/definition.ts";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { parse } from "../lib/parse.ts";
import { route, version } from "../lib/route.ts";
import type { AnyRoute, Resolve, Route } from "../lib/types.ts";

let app = {
  ...route(
    name("simulacrum"),
    version("1.2.0"),
    option(name("port"), schema(type("number"))),
  ),
  children: [
    route(name("auth0")),
    {
      ...route(name("database")),
      children: [route(name("clean"))] as const,
    },
  ] as const,
};

describe("parse()", () => {
  describe("help", () => {
    it("resolves either help flag against the root route", () => {
      expect(
        $("simulacrum -h"),
      ).toHaveRoute("HELP /");

      expect(
        $("simulacrum --help"),
      ).toHaveRoute("HELP /");
    });

    it("resolves help before validating other arguments", () => {
      expect(
        $("simulacrum --unknown --help"),
      ).toHaveRoute("HELP /");
    });

    it("does not treat help after -- as a control", () => {
      let result = exec("simulacrum -- --help");

      expect(result).toHaveRoute("EXECUTE /");
    });

    it.skip("accounts for options left unconsumed by help", () => undefined);
  });

  describe("version", () => {
    it("resolves either version flag against a versioned route", () => {
      expect(
        $("simulacrum -v"),
      ).toHaveRoute("VERSION /");

      expect(
        $("simulacrum --version"),
      ).toHaveRoute("VERSION /");
    });

    it("resolves version before validating other arguments", () => {
      expect(
        $("simulacrum --unknown --version"),
      ).toHaveRoute("VERSION /");
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

      expect(result).toHaveRoute("EXECUTE /");
    });
  });

  describe("routes", () => {
    it("resolves a direct child route", () => {
      expect(
        $("simulacrum auth0 --help"),
      ).toHaveRoute("HELP /auth0");
    });
    it("resolves the deepest matching route", () => {
      expect(
        $("simulacrum database clean --help"),
      ).toHaveRoute("HELP /database/clean");
    });
    it("resolves controls against the deepest matching route", () => {
      expect(
        $("simulacrum --help database clean"),
      ).toHaveRoute("HELP /database/clean");
    });
    it("discovers routes across unresolved parameter tokens", () => {
      expect(
        $("simulacrum --root value database --db=value clean --help"),
      ).toHaveRoute("HELP /database/clean");
    });
    it("stops discovering routes at --", () => {
      expect(
        $("simulacrum --help database -- clean"),
      ).toHaveRoute("HELP /database");
    });
    it("treats child names as route selectors before binding parameters", () => {
      expect(
        $("simulacrum --target auth0 --help"),
      ).toHaveRoute("HELP /auth0");
    });
  });

  describe("literals", () => {
    it("assigns literals to the matching route", () => {
      let result = $("simulacrum --help database -- clean --force");

      expectOk(result);

      expect(result).toHaveRoute("HELP /database");
      expect(Array.from(result.literals, (literal) => literal.text)).toEqual([
        "clean",
        "--force",
      ]);
    });

    it("keeps literals separate from parameter tokens", () => {
      let result = $(
        "simulacrum --help --value before -- literal --force",
      );

      expectOk(result);

      expect(Array.from(result.literals, (literal) => literal.text)).toEqual([
        "literal",
        "--force",
      ]);
    });
  });

  describe("route methods", () => {
    it("uses the methods supported by the matching route", () => {
      expect(
        scoped("simulacrum auth0 --version"),
      ).toHaveRoute("VERSION /auth0");
    });
    it("reports the matching route when a method is unsupported", () => {
      expect(
        $("simulacrum database clean --version"),
      ).toMatchObject({
        ok: false,
        code: "method-not-allowed",
        route: { name: "clean" },
        path: ["database", "clean"],
        method: "version",
        allowed: ["help"],
      });
    });
    it("allows an executable route to contain executable children", () => {
      expect(
        commands("simulacrum database"),
      ).toHaveRoute("EXECUTE /database");

      expect(
        commands("simulacrum database clean"),
      ).toHaveRoute("EXECUTE /database/clean");
    });
  });

  describe("binding", () => {
    it.skip("binds every route segment into its path-addressed model", () => {
      // let result = request(
      //   appWithRootHostAndServePort,
      //   "simulacrum --host localhost serve --port 4040",
      // );
      //
      // expect(result).toHaveModels({
      //   "/": { host: "localhost" },
      //   "/serve": { port: 4040 },
      // });
    });

    it.skip("validates required parameters on every matched route", () => {
      // let result = request(
      //   appWithRequiredRootHostAndServePort,
      //   "simulacrum serve --port 4040",
      // );
      //
      // expect(result).toMatchObject({
      //   ok: false,
      //   code: "unprocessable-content",
      //   issues: [{ path: ["host"] }],
      // });
    });

    it.skip("binds an option from a following token", () => {
      // expect(
      //   $("simulacrum --port 9001"),
      // ).toHaveConfig({ port: 9001 });
    });

    it.skip("binds an option from a setter", () => {
      // expect(
      //   $("simulacrum --port=9001"),
      // ).toHaveConfig({ port: 9001 });
    });

    it.skip("binds a positional argument", () => {
      // let input = cli(command(
      //   name("simulacrum"),
      //   argument("input", type("string")),
      // ));
      //
      // expect(
      //   input("simulacrum input.txt"),
      // ).toHaveConfig({ input: "input.txt" });
    });

    it.skip("reports flags left unconsumed after binding every parameter", () => {
      // expect(
      //   exec("simulacrum --floop"),
      // ).toMatchObject({
      //   ok: false,
      //   code: "unprocessable-content",
      //   issues: [{ message: "unknown flag --floop" }],
      // });
    });

    it.skip("reports an invalid option value as a binding error", () => {
      // expect(
      //   $("simulacrum --port nope"),
      // ).toMatchObject({
      //   ok: false,
      //   code: "unprocessable-content",
      // });
    });

    it.skip("reports a surplus argument as a binding error", () => {
      // expect(
      //   $("simulacrum extra"),
      // ).toMatchObject({
      //   ok: false,
      //   code: "unprocessable-content",
      // });
    });

    it.skip("preserves parameter token order while binding", () => {
      // expect(
      //   $("simulacrum --tag first --tag=second"),
      // ).toHaveConfig({ tag: ["first", "second"] });
    });

    it.skip("binds parameters to the route segment that owns them", () => {
      // expect(
      //   $("simulacrum --verbose database --verbose clean --verbose"),
      // ).toHaveConfig({
      //   verbose: true,
      //   database: {
      //     verbose: true,
      //     clean: { verbose: true },
      //   },
      // });
    });

    it.skip("reports several surplus arguments as a binding error", () => {
      // expect(
      //   $("simulacrum databaes clean"),
      // ).toMatchObject({
      //   ok: false,
      //   code: "unprocessable-content",
      // });
    });
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

      expectType<Equal<Resolve<Plain>["method"], "help">>(true);
      expectType<
        Equal<Resolve<Versioned>["method"], "help" | "version">
      >(true);
    });

    it("exposes the exact intents of every reachable route", () => {
      type Actual = TargetOf<ReturnType<typeof $>>;
      type Expected =
        | ["help", "/", []]
        | ["version", "/", []]
        | ["help", "/auth0", ["auth0"]]
        | ["help", "/database", ["database"]]
        | ["help", "/database/clean", ["database", "clean"]];

      expectType<Equal<Actual, Expected>>(true);
    });
  });
});

const requests = new WeakMap<object, Request>();
const $ = cli(app);
const plain = cli(route(name("simulacrum")));
const scoped = cli({
  ...route(name("simulacrum")),
  children: [
    route(name("auth0"), version("2.0.0")),
  ] as const,
});
const commands = cli({
  ...route(name("simulacrum")),
  children: [
    {
      ...route(name("database")),
      methods: ["help", "execute"] as const,
      children: [
        {
          ...route(name("clean")),
          methods: ["help", "execute"] as const,
        },
      ] as const,
    },
  ] as const,
});
const exec = cli({
  ...route(name("simulacrum")),
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
  root: string;
  definition: string;
  target: Target;
}

type Target = `${string} /${string}`;
type Empty = Record<never, never>;
type TargetOf<T> = T extends {
  readonly ok: true;
  readonly method: infer M;
  readonly route: infer R;
  readonly path: infer P;
} ? [M, R, P]
  : never;

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends
  (<T>() => T extends R ? 1 : 2)
  ? (<T>() => T extends R ? 1 : 2) extends (<T>() => T extends L ? 1 : 2) ? true
  : false
  : false;

base.extend({
  toHaveRoute(context, expected: Target) {
    let outcome = inspect(context.value);
    let route = expected.slice(expected.indexOf(" ") + 1);
    let leaf = route === "/"
      ? outcome?.root
      : route.slice(route.lastIndexOf("/") + 1);
    let pass = outcome?.target === expected && outcome.definition === leaf;

    return {
      pass,
      message: () =>
        outcome
          ? `Expected ${
            JSON.stringify(outcome.input)
          } to resolve ${expected}, ` +
            `but it resolved ${outcome.target} with definition ${
              JSON.stringify(outcome.definition)
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
  let { ok, method, route, definition } = value;
  if (
    ok !== true || typeof method !== "string" || typeof route !== "string" ||
    !route.startsWith("/") || !record(definition) ||
    typeof definition.name !== "string"
  ) {
    return;
  }

  return {
    input,
    root,
    definition: definition.name,
    target: `${method.toUpperCase()} ${route}` as Target,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}

function expectOk<T extends { readonly ok: boolean }>(
  result: T,
): asserts result is Extract<T, { readonly ok: true }> {
  expect(result.ok).toBe(true);
}
