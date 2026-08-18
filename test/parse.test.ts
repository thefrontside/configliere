// deno-lint-ignore-file no-import-prefix
import { expect as base, type Expected } from "jsr:@std/expect@^1.0.19";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { parse } from "../lib/parse.ts";
import { name, option, route, version } from "../lib/route.ts";
import type { AnyRoute } from "../lib/types.ts";

let app = route(
  name("simulacrum"),
  version("1.2.0"),
  option("port", type("number")),
);
let $ = cli(app);

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
      let result = $("simulacrum -- --help");

      expect(result).toHaveRoute("EXECUTE /simulacrum");
    });
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

    it.skip("rejects version for a route without a version", () => undefined);

    it("does not treat version after -- as a control", () => {
      let result = $("simulacrum -- --version");

      expect(result).toHaveRoute("EXECUTE /simulacrum");
    });
  });
});

interface RouteExpected extends Expected {
  toHaveRoute(expected: Target): unknown;
}

interface Outcome {
  input: string;
  route: string;
  target: Target;
}

type Target = `${string} /${string}`;

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

    return {
      input,
      root,
      result: parse(app, { argv }),
    };
  };
}

function inspect(value: unknown): Outcome | undefined {
  if (!record(value)) {
    return;
  }

  let { input, root, result } = value;
  if (
    typeof input !== "string" || typeof root !== "string" || !record(result)
  ) {
    return;
  }

  let { ok, type, route, path } = result;
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
