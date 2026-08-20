import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { name, route, version } from "../lib/route.ts";
import type { AnyRoute, Method, Route } from "../lib/types.ts";

describe("route() types", () => {
  it("preserves the literal route name through each element", () => {
    let result = route(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
      option(name("domain"), schema(type("string"))),
    );

    expectType<Equal<typeof result.name, "simulacrum">>(true);
  });

  it("starts with help as its only supported method", () => {
    let result = route(name("simulacrum"));

    expectType<Equal<Methods<typeof result>, "help">>(true);
  });

  it("preserves supported methods while adding options", () => {
    let result = route(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
    );

    expectType<Equal<Methods<typeof result>, "help">>(true);
  });

  it("adds version to the supported methods", () => {
    let result = route(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
      version("1.2.0"),
    );

    expectType<Equal<Methods<typeof result>, "help" | "version">>(true);
    expectType<Equal<Model<typeof result>, { port: number }>>(true);
  });

  it("infers a plain object model from option schema outputs", () => {
    let result = route(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
    );

    expectType<Equal<Model<typeof result>, { port: number }>>(true);
  });

  it("preserves exact option keys and values across several elements", () => {
    let result = route(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
      option(name("domain"), schema(type("string"))),
    );

    expectType<
      Equal<Model<typeof result>, { port: number; domain: string }>
    >(true);
  });

  it("preserves exact children while adding an option", () => {
    let auth0 = route(name("auth0"));
    let parent = {
      ...name("simulacrum"),
      children: [auth0] as const,
    };
    let result = option(name("port"), schema(type("number")))(parent);

    expectType<
      Equal<typeof result.children, readonly [typeof auth0]>
    >(true);
    expectType<Equal<Model<typeof result>, { port: number }>>(true);
  });

  it("rejects a first value that is not a Route", () => {
    check(() => {
      // @ts-expect-error route() must start with a Route.
      route("simulacrum");
    });
  });

  it("rejects adjacent elements whose output and input do not align", () => {
    let start = name("simulacrum");
    let count = (_value: typeof start): number => 1;
    let label = (_value: string): string => "done";

    check(() => {
      // @ts-expect-error label cannot consume the number returned by count.
      route(start, count, label);
    });
  });

  it("allows an explicit final element to transform a Route into another type", () => {
    let result = route(
      name("simulacrum"),
      (value) => ({ type: "bloop" as const, route: value }),
    );

    expectType<Equal<typeof result.type, "bloop">>(true);
    expectType<Equal<typeof result.route.name, "simulacrum">>(true);
  });

  it("preserves inference through the longest supported pipeline", () => {
    let result = route(
      name("simulacrum"),
      option(name("one"), schema(type("string"))),
      option(name("two"), schema(type("number"))),
      option(name("three"), schema(type("boolean"))),
      option(name("four"), schema(type("string"))),
      option(name("five"), schema(type("number"))),
      option(name("six"), schema(type("boolean"))),
      option(name("seven"), schema(type("string"))),
      option(name("eight"), schema(type("number"))),
      option(name("nine"), schema(type("boolean"))),
    );

    expectType<
      Equal<
        Model<typeof result>,
        {
          one: string;
          two: number;
          three: boolean;
          four: string;
          five: number;
          six: boolean;
          seven: string;
          eight: number;
          nine: boolean;
        }
      >
    >(true);
  });

  it.skip("infers a nested object model from a nested option address", () =>
    undefined);
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

function check(_body: () => void): void {
  // Compile the callback without executing it.
}
