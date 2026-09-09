import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { name } from "../lib/definition.ts";
import { extend } from "../lib/extend.ts";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { route } from "../lib/route.ts";
import type { ModelOf } from "../lib/types.ts";

describe("extend() types", () => {
  it("is a polymorphic identity when it has no elements", () => {
    let identity = extend();
    let start = route(name("simulacrum"));

    let same = identity(start);
    let answer = identity(42 as const);

    expectType<Equal<typeof same, typeof start>>(true);
    expectType<Equal<typeof answer, 42>>(true);
  });

  it("packages several route elements as one route element", () => {
    let address = extend(
      option(name("domain"), schema(type("string"))),
      option(name("port"), schema(type("number"))),
    );

    let app = route(
      name("simulacrum"),
      option(name("host"), schema(type("string"))),
      address,
    );

    expectType<
      Equal<
        ModelOf<typeof app>,
        { host: string; domain: string; port: number }
      >
    >(true);
  });

  it("composes ordinary functions", () => {
    let stringify = extend(
      (value: number) => value + 1,
      (value: number) => String(value),
    );
    let result = stringify(1);

    expectType<Equal<typeof result, string>>(true);
  });

  it("can apply the same extension to different route states", () => {
    let address = extend(
      option(name("domain"), schema(type("string"))),
      option(name("port"), schema(type("number"))),
    );

    let root = route(
      name("simulacrum"),
      option(name("verbose"), schema(type("boolean"))),
      address,
    );

    let child = route(
      name("auth0"),
      address,
    );

    expectType<
      Equal<
        ModelOf<typeof root>,
        { verbose: boolean; domain: string; port: number }
      >
    >(true);
    expectType<
      Equal<
        ModelOf<typeof child>,
        { domain: string; port: number }
      >
    >(true);
  });

  it("rejects adjacent elements whose types do not align", () => {
    let count = (value: { label: string }): number => value.label.length;
    let label = (value: string): string => value.toUpperCase();
    let invalid = extend(count, label);

    check(() => {
      // @ts-expect-error the invalid composition cannot consume its input.
      invalid({ label: "hello" });
    });
  });

  it("rejects an extension that cannot consume its pipeline seed", () => {
    let stringify = extend((value: number): string => String(value));

    check(() => {
      // @ts-expect-error stringify cannot consume a RouteZero.
      route(name("simulacrum"), stringify);
    });
  });
});

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
