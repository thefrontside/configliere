import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { command } from "../lib/command.ts";
import { name } from "../lib/definition.ts";
import { dynamic } from "../lib/dynamic.ts";
import { extend } from "../lib/extend.ts";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { parse } from "../lib/parse.ts";
import { routes, version } from "../lib/route.ts";
import type {
  ContinuationOf,
  MethodsOf,
  ModelOf,
  RequirementOf,
  RequirementsOf,
} from "../lib/types.ts";

describe("dynamic()", () => {
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
  });

  it("preserves controls and routes accumulated before the phase", () => {
    let serve = command(name("serve"));
    let app = command(
      name("simulacrum"),
      version("1.2.0"),
      routes(serve),
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
    expectType<Equal<Next["children"], readonly [typeof serve]>>(true);
    expectType<Equal<ModelOf<Next>, { port: number }>>(true);
  });

  it("does not invoke the resolver while constructing the definition", () => {
    let calls = 0;

    command(
      name("simulacrum"),
      dynamic((_config: Config) => {
        calls++;
        return extend();
      }),
    );

    expect(calls).toBe(0);
  });

  it("requires subsequent route elements to be returned by its resolver", () => {
    check(() => {
      command(
        name("simulacrum"),
        dynamic((_config: Config) => extend()),
        // @ts-expect-error a normal route element cannot consume a dynamic definition.
        option(name("port"), schema(type("number"))),
      );
    });
  });

  it("allows an explicit function to consume its dynamic definition", () => {
    let wrapped = command(
      name("simulacrum"),
      dynamic((_config: Config) => extend()),
      (definition) => ({ kind: "wrapped" as const, definition }),
    );

    expectType<Equal<typeof wrapped.kind, "wrapped">>(true);
  });

  it("rejects a resolver that does not return an extension", () => {
    check(() => {
      // @ts-expect-error a command is a definition, not a route extension.
      dynamic((_config: Config) => command(name("serve")));
    });
  });

  describe("parse()", () => {
    it.skip("returns an increment with the model bound before the phase", () => {
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

    it.skip("exposes only the model available before the phase", () => {
      // let app = command(
      //   name("simulacrum"),
      //   option(name("config"), schema(type("string"))),
      //   dynamic((_config: Config) =>
      //     extend(option(name("port"), schema(type("number"))))
      //   ),
      // );
      // let result = parse(app, {
      //   argv: ["--config", "simulacrum.json"],
      // });
      // type Success = Extract<typeof result, { readonly ok: true }>;
      // expectType<Equal<Success["model"], { config: string }>>(true);
    });

    it.skip("does not invoke the resolver before resume()", () => {
      // let calls = 0;
      // let app = command(
      //   name("simulacrum"),
      //   option(name("config"), schema(type("string"))),
      //   dynamic((_config: Config) => {
      //     calls++;
      //     return extend();
      //   }),
      // );
      // parse(app, { argv: ["--config", "simulacrum.json"] });
      // expect(calls).toBe(0);
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

    it.skip("leaves later tokens for the continuation", () => {
      // let app = command(
      //   name("simulacrum"),
      //   option(name("config"), schema(type("string"))),
      //   dynamic((_config: Config) =>
      //     extend(option(name("port"), schema(type("number"))))
      //   ),
      // );
      // let result = parse(app, {
      //   argv: ["--config", "simulacrum.json", "--port", "9001"],
      // });
      // expect(result).toMatchObject({
      //   ok: true,
      //   model: { config: "simulacrum.json" },
      // });
      // expect("resume" in result && typeof result.resume === "function").toBe(
      //   true,
      // );
    });
  });
});

interface Config {
  readonly services: readonly string[];
}

interface Plugins {
  readonly names: readonly string[];
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
