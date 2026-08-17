// deno-lint-ignore-file no-import-prefix
import { expect } from "jsr:@std/expect@^1.0.19";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { parse } from "../lib/parse.ts";
import { name, option, route } from "../lib/route.ts";
import type { Path, Resolve, Result, Route } from "../lib/types.ts";

describe("parse()", () => {
  it("resolves help for every route", () => {
    let app = route(
      name("simulacrum"),
      option("port", type("number")),
    );

    for (let arg of ["-h", "--help"]) {
      expectHelp(parse(app, { argv: [arg] }), app, []);
    }
  });

  it("resolves help before validating other arguments", () => {
    let app = route(name("simulacrum"));

    expectHelp(parse(app, { argv: ["--unknown", "--help"] }), app, []);
  });

  it("does not treat help after -- as a control", () => {
    let app = route(name("simulacrum"));
    let result = parse(app, { argv: ["--", "--help"] });

    expect("type" in result && result.type === "help").toBe(false);
  });
});

function expectHelp<
  R extends Route<string, object>,
  const P extends Path,
>(
  result: Result<Resolve<R, P>>,
  route: R,
  path: P,
): void {
  if (!("type" in result)) {
    throw new Error("expected help");
  }

  expect(result.ok).toBe(true);
  expect(result.type).toBe("help");
  expect(result.route).toBe(route);
  expect(result.path).toEqual(path);
}
