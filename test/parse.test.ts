import { expect as base, type Expected } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { command } from "../lib/command.ts";
import { name } from "../lib/definition.ts";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { parse } from "../lib/parse.ts";
import { route, routes, version } from "../lib/route.ts";
import { toggle } from "../lib/toggle.ts";
import type { AnyRoute, Done, IntentsOf, Route } from "../lib/types.ts";

let app = route(
  name("simulacrum"),
  version("1.2.0"),
  option(name("port"), schema(type("number"))),
  routes(
    route(name("auth0")),
    route(
      name("database"),
      routes(route(name("clean"))),
    ),
  ),
);

let tree = command(
  name("simulacrum"),
  toggle(name("verbose")),
  routes(
    command(
      name("database"),
      toggle(name("verbose")),
      routes(
        command(
          name("clean"),
          toggle(name("verbose")),
        ),
      ),
    ),
  ),
);

let toggles = command(
  name("simulacrum"),
  toggle(name("dryRun")),
);

let fields = command(
  name("simulacrum"),
  option(name("port"), schema(type("number"))),
);

let segments = command(
  name("simulacrum"),
  option(name("host"), schema(type("string"))),
  routes(
    command(
      name("serve"),
      option(name("port"), schema(type("number"))),
    ),
  ),
);

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
      let result = plain("simulacrum --version");

      expect(result).toMatchObject({
        ok: false,
        code: "method-not-allowed",
        path: [],
        method: "version",
        allowed: ["help"],
      });
      expect(typeof result.route).toBe("string");
      expect(result.route).toBe("/");
      expect(result.definition).toMatchObject({ name: "simulacrum" });
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
    it("does not let an unknown option hide a known child route", () => {
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
      let result = $("simulacrum database clean --version");

      expect(result).toMatchObject({
        ok: false,
        code: "method-not-allowed",
        path: ["database", "clean"],
        method: "version",
        allowed: ["help"],
      });
      expect(typeof result.route).toBe("string");
      expect(result.route).toBe("/database/clean");
      expect(result.definition).toMatchObject({ name: "clean" });
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
    it("binds every route segment into its path-addressed model", () => {
      let result = segmented(
        "simulacrum --host localhost serve --port 4040",
      );

      expect(result).toHaveModels({
        "/": { host: "localhost" },
        "/serve": { port: 4040 },
      });
    });

    it("validates required parameters on every matched route", () => {
      let result = segmented("simulacrum serve --port 4040");

      expect(result).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        path: ["serve"],
        issues: [{ path: ["host"] }],
      });
      expect(result.route).toBe("/serve");
      expect(result.definition).toMatchObject({ name: "serve" });
    });

    it("binds an option from a following token", () => {
      expect(
        configured("simulacrum --port 9001"),
      ).toHaveModels({ "/": { port: 9001 } });
    });

    it("binds an option from a setter", () => {
      expect(
        configured("simulacrum --port=9001"),
      ).toHaveModels({ "/": { port: 9001 } });
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

    it("reports flags left unconsumed after binding every parameter", () => {
      expect(
        exec("simulacrum --floop"),
      ).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        issues: [{ message: `unexpected "--floop"` }],
      });
    });

    it("reports an invalid option value as a binding error", () => {
      expect(
        configured("simulacrum --port nope"),
      ).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        issues: [{ path: ["port"] }],
      });
    });

    it("reports unconsumed tokens alongside terminal validation errors", () => {
      expect(
        configured("simulacrum --floop"),
      ).toMatchObject({
        ok: false,
        code: "unprocessable-content",
        issues: [
          { message: `unexpected "--floop"` },
          { path: ["port"] },
        ],
      });
    });

    it("reports a surplus argument as a binding error", () => {
      expect(
        exec("simulacrum extra"),
      ).toMatchObject({
        ok: false,
        code: "unprocessable-content",
      });
    });

    it.skip("preserves parameter token order while binding", () => {
      // expect(
      //   $("simulacrum --tag first --tag=second"),
      // ).toHaveConfig({ tag: ["first", "second"] });
    });

    it("binds parameters to the route segment that owns them", () => {
      let result = bound(
        "simulacrum --verbose database --verbose clean --verbose",
      );

      expect(result).toHaveModels({
        "/": { verbose: true },
        "/database": { verbose: true },
        "/database/clean": { verbose: true },
      });
    });

    it("binds default, affirmative, and negative toggles", () => {
      expect(
        toggled("simulacrum"),
      ).toHaveModels({ "/": { dryRun: false } });

      expect(
        toggled("simulacrum --dry-run"),
      ).toHaveModels({ "/": { dryRun: true } });

      expect(
        toggled("simulacrum --no-dry-run"),
      ).toHaveModels({ "/": { dryRun: false } });
    });

    it("reports several surplus arguments as a binding error", () => {
      let result = exec("simulacrum databaes clean");

      expectUnprocessable(result);
      expect(result.issues).toHaveLength(2);
    });
  });

  describe("types", () => {
    it("exposes only methods supported by a route", () => {
      type Plain = Route<
        "simulacrum",
        "help",
        Empty,
        [],
        readonly [Done<Empty, []>]
      >;
      type Versioned = Route<
        "simulacrum",
        "help" | "version",
        Empty,
        [],
        readonly [Done<Empty, []>]
      >;

      expectType<Equal<IntentsOf<Plain>["method"], "help">>(true);
      expectType<
        Equal<IntentsOf<Versioned>["method"], "help" | "version">
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
const bound = cli(tree);
const toggled = cli(toggles);
const configured = cli(fields);
const segmented = cli(segments);
const plain = cli(route(name("simulacrum")));
const scoped = cli(
  route(
    name("simulacrum"),
    routes(
      route(name("auth0"), version("2.0.0")),
    ),
  ),
);
const commands = cli(
  command(
    name("simulacrum"),
    routes(
      command(
        name("database"),
        routes(command(name("clean"))),
      ),
    ),
  ),
);
const exec = cli(command(name("simulacrum")));

interface RouteExpected extends Expected {
  toHaveRoute(expected: Target): unknown;
  toHaveModels(expected: Models): unknown;
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
type Models = Readonly<Record<string, object>>;
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
  toHaveModels(context, expected: Models) {
    let value = context.value;
    let models = record(value) && value.ok === true &&
        value.method === "execute" && record(value.models)
      ? value.models
      : undefined;

    return {
      pass: models !== undefined && context.equal(models, expected),
      message: () =>
        models === undefined
          ? `Expected a successful EXECUTE result with models, but received ${
            show(
              record(value)
                ? {
                  ok: value.ok,
                  code: value.code,
                  path: value.path,
                  issues: value.issues,
                }
                : value,
            )
          }`
          : `Expected models ${show(expected)}, but received ${show(models)}`,
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

function show(value: unknown): string {
  return Deno.inspect(value, { colors: false, depth: Infinity, sorted: true });
}

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}

function expectOk<T extends { readonly ok: boolean }>(
  result: T,
): asserts result is Extract<T, { readonly ok: true }> {
  expect(result.ok).toBe(true);
}

function expectUnprocessable<T extends { readonly ok: boolean }>(
  result: T,
): asserts result is T & {
  readonly ok: false;
  readonly code: "unprocessable-content";
  readonly issues: readonly unknown[];
} {
  expect(result).toMatchObject({
    ok: false,
    code: "unprocessable-content",
  });
}
