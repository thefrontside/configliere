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

  it("infers the exact model across thirty route elements", () => {
    let result = command(
      name("simulacrum"),
      option(name("p1"), schema(type("number"))),
      option(name("p2"), schema(type("number"))),
      option(name("p3"), schema(type("number"))),
      option(name("p4"), schema(type("number"))),
      option(name("p5"), schema(type("number"))),
      option(name("p6"), schema(type("number"))),
      option(name("p7"), schema(type("number"))),
      option(name("p8"), schema(type("number"))),
      option(name("p9"), schema(type("number"))),
      option(name("p10"), schema(type("number"))),
      option(name("p11"), schema(type("number"))),
      option(name("p12"), schema(type("number"))),
      option(name("p13"), schema(type("number"))),
      option(name("p14"), schema(type("number"))),
      option(name("p15"), schema(type("number"))),
      option(name("p16"), schema(type("number"))),
      option(name("p17"), schema(type("number"))),
      option(name("p18"), schema(type("number"))),
      option(name("p19"), schema(type("number"))),
      option(name("p20"), schema(type("number"))),
      option(name("p21"), schema(type("number"))),
      option(name("p22"), schema(type("number"))),
      option(name("p23"), schema(type("number"))),
      option(name("p24"), schema(type("number"))),
      option(name("p25"), schema(type("number"))),
      option(name("p26"), schema(type("number"))),
      option(name("p27"), schema(type("number"))),
      option(name("p28"), schema(type("number"))),
      option(name("p29"), schema(type("number"))),
      option(name("p30"), schema(type("number"))),
    );

    expectType<
      Equal<Model<typeof result>, {
        p1: number;
        p2: number;
        p3: number;
        p4: number;
        p5: number;
        p6: number;
        p7: number;
        p8: number;
        p9: number;
        p10: number;
        p11: number;
        p12: number;
        p13: number;
        p14: number;
        p15: number;
        p16: number;
        p17: number;
        p18: number;
        p19: number;
        p20: number;
        p21: number;
        p22: number;
        p23: number;
        p24: number;
        p25: number;
        p26: number;
        p27: number;
        p28: number;
        p29: number;
        p30: number;
      }>
    >(true);
    expect(result.params.p30.name).toBe("p30");
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
