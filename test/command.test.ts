import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { command, type CommandZero } from "../lib/command.ts";
import { name } from "../lib/definition.ts";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { route, routes, version } from "../lib/route.ts";
import type { AnyRoute, Method, Route } from "../lib/types.ts";

describe("command()", () => {
  it("creates an executable route without an explicit executable element", () => {
    let result = command(name("simulacrum"));

    expect(result.methods).toEqual(["help", "execute"]);
    expectType<Equal<typeof result.name, "simulacrum">>(true);
    expectType<Equal<Methods<typeof result>, "help" | "execute">>(true);
  });

  it("materializes a CommandZero before applying the first element", () => {
    let result = command(name("simulacrum"), (zero) => {
      expectType<Equal<typeof zero, CommandZero<"simulacrum">>>(true);
      expect(zero).toEqual({
        name: "simulacrum",
        methods: ["help", "execute"],
        params: {},
        children: [],
      });
      return zero;
    });

    expectType<Equal<typeof result, CommandZero<"simulacrum">>>(true);
  });

  it("composes the same route elements from left to right", () => {
    let auth0 = route(name("auth0"));
    let result = command(
      name("simulacrum"),
      version("1.2.0"),
      option(name("port"), schema(type("number"))),
      option(name("domain"), schema(type("string"))),
      routes(auth0),
    );

    expectType<
      Equal<Methods<typeof result>, "help" | "execute" | "version">
    >(true);
    expectType<
      Equal<Model<typeof result>, { port: number; domain: string }>
    >(true);
    expectType<Equal<typeof result.children, readonly [typeof auth0]>>(true);
  });

  it("does not mutate the definition used to start the command", () => {
    let start = name("simulacrum");
    let result = command(start);

    expect(start).toEqual({ name: "simulacrum" });
    expect(result.methods).toEqual(["help", "execute"]);
  });
});

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends
  (<T>() => T extends R ? 1 : 2)
  ? (<T>() => T extends R ? 1 : 2) extends (<T>() => T extends L ? 1 : 2) ? true
  : false
  : false;

type Model<R extends AnyRoute> = R extends
  Route<string, Method, infer T, readonly AnyRoute[]> ? T
  : never;

type Methods<R extends AnyRoute> = R["methods"][number];

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}
