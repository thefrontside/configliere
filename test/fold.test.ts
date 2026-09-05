import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { command } from "../lib/command.ts";
import { checkpoint } from "../lib/checkpoint.ts";
import { description, name } from "../lib/definition.ts";
import { dynamic } from "../lib/dynamic.ts";
import { withEnvs } from "../lib/env.ts";
import { extend } from "../lib/extend.ts";
import { option } from "../lib/option.ts";
import { schema } from "../lib/param.ts";
import { parse } from "../lib/parse.ts";
import { mark, type Transform } from "../lib/pipeline.ts";
import { route, routes, version } from "../lib/route.ts";
import { toggle } from "../lib/toggle.ts";
import type {
  AnyRoute,
  ChildrenOf,
  ContinuationOf,
  Done,
  MethodsOf,
  ModelOf,
  RequirementOf,
  Route,
} from "../lib/types.ts";
import { type ValueSource, withValues } from "../lib/values.ts";

const staticApp = command(
  name("simulacrum"),
  description("run service simulators"),
  withValues([]),
  withEnvs([]),
  version("1.2.0"),
  toggle(name("verbose")),
  routes(
    command(
      name("serve"),
      option(name("port"), schema(type("number"))),
    ),
  ),
);

const configApp = command(
  name("server"),
  option(name("config"), schema(type("string"))),
  dynamic((sources: readonly ValueSource[]) => extend(withValues(sources))),
  option(name("port"), schema(type("number"))),
);

const checkpointApp = command(
  name("checkpoint"),
  option(name("config"), schema(type("string"))),
  checkpoint(),
  option(name("port"), schema(type("number"))),
);

const options = [
  numberOption("p0"),
  numberOption("p1"),
  numberOption("p2"),
  numberOption("p3"),
  numberOption("p4"),
  numberOption("p5"),
  numberOption("p6"),
  numberOption("p7"),
  numberOption("p8"),
  numberOption("p9"),
  numberOption("p10"),
  numberOption("p11"),
  numberOption("p12"),
  numberOption("p13"),
  numberOption("p14"),
  numberOption("p15"),
  numberOption("p16"),
  numberOption("p17"),
  numberOption("p18"),
  numberOption("p19"),
  numberOption("p20"),
  numberOption("p21"),
  numberOption("p22"),
  numberOption("p23"),
  numberOption("p24"),
  numberOption("p25"),
  numberOption("p26"),
  numberOption("p27"),
  numberOption("p28"),
  numberOption("p29"),
  numberOption("p30"),
  numberOption("p31"),
  numberOption("p32"),
  numberOption("p33"),
  numberOption("p34"),
  numberOption("p35"),
  numberOption("p36"),
  numberOption("p37"),
  numberOption("p38"),
  numberOption("p39"),
  numberOption("p40"),
  numberOption("p41"),
  numberOption("p42"),
  numberOption("p43"),
  numberOption("p44"),
  numberOption("p45"),
  numberOption("p46"),
  numberOption("p47"),
  numberOption("p48"),
  numberOption("p49"),
  numberOption("p50"),
  numberOption("p51"),
  numberOption("p52"),
  numberOption("p53"),
  numberOption("p54"),
  numberOption("p55"),
  numberOption("p56"),
  numberOption("p57"),
  numberOption("p58"),
  numberOption("p59"),
  numberOption("p60"),
  numberOption("p61"),
  numberOption("p62"),
  numberOption("p63"),
  numberOption("p64"),
  numberOption("p65"),
  numberOption("p66"),
  numberOption("p67"),
  numberOption("p68"),
  numberOption("p69"),
  numberOption("p70"),
  numberOption("p71"),
  numberOption("p72"),
  numberOption("p73"),
  numberOption("p74"),
  numberOption("p75"),
  numberOption("p76"),
  numberOption("p77"),
  numberOption("p78"),
  numberOption("p79"),
  numberOption("p80"),
  numberOption("p81"),
  numberOption("p82"),
  numberOption("p83"),
  numberOption("p84"),
  numberOption("p85"),
  numberOption("p86"),
  numberOption("p87"),
  numberOption("p88"),
  numberOption("p89"),
  numberOption("p90"),
  numberOption("p91"),
  numberOption("p92"),
  numberOption("p93"),
  numberOption("p94"),
  numberOption("p95"),
  numberOption("p96"),
  numberOption("p97"),
  numberOption("p98"),
  numberOption("p99"),
] as const;

const children = [
  routes(command(name("c0"))),
  routes(command(name("c1"))),
  routes(command(name("c2"))),
  routes(command(name("c3"))),
  routes(command(name("c4"))),
  routes(command(name("c5"))),
  routes(command(name("c6"))),
  routes(command(name("c7"))),
  routes(command(name("c8"))),
  routes(command(name("c9"))),
  routes(command(name("c10"))),
  routes(command(name("c11"))),
  routes(command(name("c12"))),
  routes(command(name("c13"))),
  routes(command(name("c14"))),
  routes(command(name("c15"))),
  routes(command(name("c16"))),
  routes(command(name("c17"))),
  routes(command(name("c18"))),
  routes(command(name("c19"))),
  routes(command(name("c20"))),
  routes(command(name("c21"))),
  routes(command(name("c22"))),
  routes(command(name("c23"))),
  routes(command(name("c24"))),
  routes(command(name("c25"))),
  routes(command(name("c26"))),
  routes(command(name("c27"))),
  routes(command(name("c28"))),
  routes(command(name("c29"))),
  routes(command(name("c30"))),
  routes(command(name("c31"))),
  routes(command(name("c32"))),
  routes(command(name("c33"))),
  routes(command(name("c34"))),
  routes(command(name("c35"))),
  routes(command(name("c36"))),
  routes(command(name("c37"))),
  routes(command(name("c38"))),
  routes(command(name("c39"))),
  routes(command(name("c40"))),
  routes(command(name("c41"))),
  routes(command(name("c42"))),
  routes(command(name("c43"))),
  routes(command(name("c44"))),
  routes(command(name("c45"))),
  routes(command(name("c46"))),
  routes(command(name("c47"))),
  routes(command(name("c48"))),
  routes(command(name("c49"))),
  routes(command(name("c50"))),
  routes(command(name("c51"))),
  routes(command(name("c52"))),
  routes(command(name("c53"))),
  routes(command(name("c54"))),
  routes(command(name("c55"))),
  routes(command(name("c56"))),
  routes(command(name("c57"))),
  routes(command(name("c58"))),
  routes(command(name("c59"))),
  routes(command(name("c60"))),
  routes(command(name("c61"))),
  routes(command(name("c62"))),
  routes(command(name("c63"))),
  routes(command(name("c64"))),
  routes(command(name("c65"))),
  routes(command(name("c66"))),
  routes(command(name("c67"))),
  routes(command(name("c68"))),
  routes(command(name("c69"))),
  routes(command(name("c70"))),
  routes(command(name("c71"))),
  routes(command(name("c72"))),
  routes(command(name("c73"))),
  routes(command(name("c74"))),
  routes(command(name("c75"))),
  routes(command(name("c76"))),
  routes(command(name("c77"))),
  routes(command(name("c78"))),
  routes(command(name("c79"))),
  routes(command(name("c80"))),
  routes(command(name("c81"))),
  routes(command(name("c82"))),
  routes(command(name("c83"))),
  routes(command(name("c84"))),
  routes(command(name("c85"))),
  routes(command(name("c86"))),
  routes(command(name("c87"))),
  routes(command(name("c88"))),
  routes(command(name("c89"))),
  routes(command(name("c90"))),
  routes(command(name("c91"))),
  routes(command(name("c92"))),
  routes(command(name("c93"))),
  routes(command(name("c94"))),
  routes(command(name("c95"))),
  routes(command(name("c96"))),
  routes(command(name("c97"))),
  routes(command(name("c98"))),
  routes(command(name("c99"))),
] as const;

const hundredCommand = command(name("hundred"), ...options);
const hundredRoute = route(name("hundred"), ...options);
const hundredExtension = extend(...options);
const extendedRoute = route(name("extended"), hundredExtension);
const hundredChildren = route(name("children"), ...children);

describe("pipeline fold", () => {
  it("infers a concrete static route", () => {
    expectType<Equal<ModelOf<typeof staticApp>, { verbose: boolean }>>(true);
    expectType<
      Equal<MethodsOf<typeof staticApp>, "help" | "version" | "execute">
    >(true);

    type Serve = ChildrenOf<typeof staticApp>[0];
    expectType<Equal<Serve["name"], "serve">>(true);
    expectType<Equal<ModelOf<Serve>, { port: number }>>(true);
  });

  it("preserves exact dynamic inference", () => {
    type Continued = ContinuationOf<typeof configApp>;

    expectType<
      Equal<RequirementOf<typeof configApp>, readonly ValueSource[]>
    >(true);
    expectType<
      Equal<ModelOf<Continued>, { config: string; port: number }>
    >(true);
    expectType<
      Equal<RequirementOf<typeof checkpointApp>, ValueSource[]>
    >(true);
    expectType<
      Equal<
        ModelOf<ContinuationOf<typeof checkpointApp>>,
        { config: string; port: number }
      >
    >(true);
  });

  it("accepts an atomic dynamic continuation", () => {
    let app = command(
      name("atomic"),
      dynamic((_plugins: Plugins) =>
        option(name("dyno"), schema(type("number")))
      ),
    );

    expectType<Equal<RequirementOf<typeof app>, Plugins>>(true);
    expectType<Equal<ModelOf<typeof app>, { dyno: number }>>(true);
  });

  it("folds one hundred elements through commands, routes, and extensions", () => {
    expectType<Equal<ModelOf<typeof hundredCommand>["p0"], number | undefined>>(
      true,
    );
    expectType<
      Equal<ModelOf<typeof hundredCommand>["p99"], number | undefined>
    >(true);
    expectType<
      Equal<ModelOf<typeof hundredRoute>, ModelOf<typeof hundredCommand>>
    >(
      true,
    );
    expectType<
      Equal<ModelOf<typeof extendedRoute>, ModelOf<typeof hundredCommand>>
    >(
      true,
    );
  });

  it("marks a bespoke input-dependent transformation", () => {
    let result = route(
      name("simulacrum"),
      option(name("port"), schema(type("number"))),
      mark<Bloop>((value: AnyRoute) => ({
        type: "bloop" as const,
        route: value,
      })),
    );

    expectType<Equal<typeof result.type, "bloop">>(true);
    expectType<Equal<typeof result.route.name, "simulacrum">>(true);
    expectType<Equal<ModelOf<typeof result.route>, { port: number }>>(true);
  });

  it("composes more than ten unbranded functions", () => {
    let routed = route(
      name("routed"),
      begin,
      one,
      two,
      three,
      four,
      five,
      six,
      seven,
      eight,
      nine,
      ten,
      eleven,
    );
    let commanded = command(
      name("commanded"),
      begin,
      one,
      two,
      three,
      four,
      five,
      six,
      seven,
      eight,
      nine,
      ten,
      eleven,
    );
    let extension = extend(
      begin,
      one,
      two,
      three,
      four,
      five,
      six,
      seven,
      eight,
      nine,
      ten,
      eleven,
    );
    let extended = extension(route(name("extended")));

    expectType<Equal<typeof routed, 11>>(true);
    expectType<Equal<typeof commanded, 11>>(true);
    expectType<Equal<typeof extended, 11>>(true);
  });

  it("folds parameter modifiers without an arity limit", () => {
    let app = command(
      name("app"),
      option(
        name("port"),
        description("one"),
        description("two"),
        description("three"),
        description("four"),
        description("five"),
        description("six"),
        description("seven"),
        description("eight"),
        description("nine"),
        description("ten"),
        description("eleven"),
        schema(type("number")),
      ),
    );

    expectType<Equal<ModelOf<typeof app>, { port: number }>>(true);
  });

  it("composes an identity macro between built-ins", () => {
    let identity = extend();
    let app = route(
      name("identity"),
      option(name("port"), schema(type("number"))),
      identity,
      option(name("domain"), schema(type("string"))),
    );

    expectType<Equal<ModelOf<typeof app>, { port: number; domain: string }>>(
      true,
    );
  });

  it("composes a marked identity with method and child-route elements", () => {
    let identity = mark<Identity>((route: AnyRoute) => route);
    let app = route(
      name("mixed"),
      description("mixed pipeline"),
      withValues([]),
      withEnvs([]),
      version("1.0.0"),
      routes(command(name("child"))),
      identity,
      option(name("port"), schema(type("number"))),
    );

    expectType<Equal<MethodsOf<typeof app>, "help" | "version">>(true);
    expectType<Equal<ChildrenOf<typeof app>[0]["name"], "child">>(true);
    expectType<Equal<ModelOf<typeof app>, { port: number }>>(true);
  });

  it("preserves a type-enhancing custom terminal combinator", () => {
    let annotate = mark<Annotate>((route: AnyRoute) => ({
      ...route,
      tag: "custom" as const,
    }));
    let app = route(
      name("annotated"),
      option(name("port"), schema(type("number"))),
      option(name("domain"), schema(type("string"))),
      annotate,
    );

    expectType<Equal<typeof app.tag, "custom">>(true);
    expectType<Equal<typeof app.name, "annotated">>(true);
    expectType<Equal<ModelOf<typeof app>, { port: number; domain: string }>>(
      true,
    );
  });

  it("preserves state through a reusable hybrid extension", () => {
    let identity = extend();
    let address = extend(
      option(name("domain"), schema(type("string"))),
      identity,
      option(name("port"), schema(type("number"))),
    );
    let app = address(route(name("address")));

    expectType<Equal<typeof app.name, "address">>(true);
    expectType<Equal<ModelOf<typeof app>, { domain: string; port: number }>>(
      true,
    );
  });

  it("preserves a dynamic boundary through a reusable hybrid extension", () => {
    let identity = extend();
    let phased = extend(
      option(name("before"), schema(type("number"))),
      identity,
      dynamic((_plugins: Plugins) =>
        option(name("dynamic"), schema(type("string")))
      ),
      option(name("after"), schema(type("boolean"))),
    );
    let app = phased(command(name("hybrid")));

    expectType<Equal<RequirementOf<typeof app>, Plugins>>(true);
    expectType<
      Equal<
        ModelOf<typeof app>,
        { before: number; dynamic: string; after: boolean }
      >
    >(true);
  });

  it("preserves state through a reusable terminal transform", () => {
    let bloop = mark<Bloop>((route: AnyRoute) => ({
      type: "bloop" as const,
      route,
    }));
    let inspect = extend(
      option(name("port"), schema(type("number"))),
      bloop,
    );
    let result = inspect(route(name("inspected")));

    expectType<Equal<typeof result.type, "bloop">>(true);
    expectType<Equal<typeof result.route.name, "inspected">>(true);
    expectType<Equal<ModelOf<typeof result.route>, { port: number }>>(true);
  });

  it("lets user combinators compose elements without explicit branding", () => {
    let address = () =>
      extend(
        option(name("domain"), schema(type("string"))),
        option(name("port"), schema(type("number"))),
      );
    let app = command(name("server"), address());

    expectType<
      Equal<ModelOf<typeof app>, { domain: string; port: number }>
    >(true);
  });

  it("keeps built-in identity macros foldable without explicit branding", () => {
    let documented = extend(
      description("first"),
      description("second"),
    );
    let app = route(name("documented"), documented, ...options);

    expectType<Equal<ModelOf<typeof app>["p99"], number | undefined>>(true);
    expect(app.description).toBe("second");
  });

  it("preserves the domain of identity-only batches", () => {
    let documented = extend(
      description("first"),
      description("second"),
    )(name("tool"));
    let value = extend(extend(), extend())(42 as const);

    expectType<Equal<typeof documented.name, "tool">>(true);
    expectType<Equal<typeof value, 42>>(true);
    expect(documented.description).toBe("second");
    expect(value).toBe(42);
  });

  it("preserves existing model modifiers while folding new fields", () => {
    type Base = Route<
      "base",
      "help",
      { readonly existing?: number },
      [],
      readonly [Done<{ readonly existing?: number }, []>]
    >;

    let base = route(name("base")) as unknown as Base;
    let decorate = extend(
      withValues([]),
      option(name("added"), schema(type("string"))),
    );
    let result = decorate(base);

    expectType<
      Equal<
        ModelOf<typeof result>,
        { readonly existing?: number; added: string }
      >
    >(true);
  });

  it("composes nested built-in batches through an identity macro", () => {
    let identity = extend();
    let nested = extend(
      routes(command(name("child"))),
      withValues([]),
    );
    let hybrid = extend(
      identity,
      nested,
      option(name("port"), schema(type("number"))),
    );
    let app = hybrid(command(name("nested")));

    expectType<Equal<ChildrenOf<typeof app>[0]["name"], "child">>(true);
    expectType<Equal<ModelOf<typeof app>, { port: number }>>(true);
  });

  it("composes nested dynamic batches through an identity macro", () => {
    let identity = extend();
    let nested = extend(
      dynamic((_plugins: Plugins) =>
        option(name("dynamic"), schema(type("number")))
      ),
      withValues([]),
    );
    let hybrid = extend(
      identity,
      nested,
      option(name("static"), schema(type("string"))),
    );
    let app = hybrid(command(name("nested-dynamic")));

    expectType<Equal<RequirementOf<typeof app>, Plugins>>(true);
    expectType<
      Equal<ModelOf<typeof app>, { dynamic: number; static: string }>
    >(true);
  });

  it("folds one hundred child-route elements", () => {
    expectType<Equal<ChildrenOf<typeof hundredChildren>[0]["name"], "c0">>(
      true,
    );
    expectType<Equal<ChildrenOf<typeof hundredChildren>[99]["name"], "c99">>(
      true,
    );
  });

  it("uses the final declaration when a parameter name is repeated", () => {
    let app = command(
      name("duplicate"),
      option(name("value"), schema(type("number"))),
      option(name("value"), schema(type("string"))),
    );

    expectType<Equal<ModelOf<typeof app>, { value: string }>>(true);
  });

  it("uses the final declaration through a marked identity", () => {
    let identity = mark<Identity>((route: AnyRoute) => route);
    let app = command(
      name("duplicate"),
      option(name("value"), schema(type("number"))),
      identity,
      option(name("value"), schema(type("string"))),
    );

    expectType<Equal<ModelOf<typeof app>, { value: string }>>(true);
  });

  it("types widened element arrays conservatively", () => {
    let elements = [option(name("port"), schema(type("number")))];
    let app = route(name("widened"), ...elements);

    expectType<Equal<typeof app, AnyRoute>>(true);
  });

  it("types open element tuples conservatively", () => {
    let head = option(name("head"), schema(type("number")));
    let extra = textOption("tail");
    let tail: (typeof extra)[] = [extra];
    let elements: readonly [typeof head, ...typeof tail] = [head, ...tail];
    let app = route(name("open"), ...elements);

    expectType<Equal<typeof app, AnyRoute>>(true);
  });

  it("types union-valued elements conservatively", () => {
    let element = Math.random() > 0.5
      ? option(name("port"), schema(type("number")))
      : routes(route(name("child")));
    let app = route(name("union"), element);

    expectType<Equal<typeof app, AnyRoute>>(true);

    let optionElement = Math.random() > 0.5
      ? option(name("count"), schema(type("number")))
      : option(name("label"), schema(type("string")));
    let optionApp = route(name("option-union"), optionElement);

    expectType<Equal<typeof optionApp, AnyRoute>>(true);
  });

  it("rejects invalid route elements", () => {
    check(() => {
      route(
        name("broken"),
        // @ts-expect-error schema() transforms a Param, not a Route.
        schema(type("number")),
      );
    });

    check(() => {
      command(
        name("broken"),
        // @ts-expect-error schema() transforms a Param, not a Route.
        schema(type("number")),
      );
    });

    check(() => {
      // @ts-expect-error a resolver must return a route extension.
      dynamic(
        (_plugins: Plugins) => command(name("auth0")),
      );
    });
  });

  it("completes a static child parse", () => {
    let result = parse(staticApp, {
      argv: ["--verbose", "serve", "--port", "4040"],
    });

    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/serve",
      model: { port: 4040 },
      models: {
        "/": { verbose: true },
        "/serve": { port: 4040 },
      },
    });
  });

  it("completes an incremental parse", () => {
    let first = parse(checkpointApp, {
      argv: ["--config", "server.json"],
    });

    expect(first).toMatchObject({
      ok: true,
      route: "/",
      model: { config: "server.json" },
    });
    if (!first.ok || !("resume" in first)) {
      throw new Error("expected a parse increment");
    }

    let result = first.resume({
      ok: true,
      value: [{ name: "server.json", value: { port: 9001 } }],
    });

    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/",
      model: { config: "server.json", port: 9001 },
    });
  });

  it("executes the final element of a one-hundred-element route", () => {
    let result = parse(hundredCommand, { argv: ["--p99", "99"] });

    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/",
      model: { p99: 99 },
    });
  });
});

interface Plugins {
  readonly auth0: boolean;
}

interface Identity extends Transform {
  readonly input: AnyRoute;
  readonly output: this["input"];
}

interface Annotate extends Transform {
  readonly input: AnyRoute;
  readonly output: this["input"] & { readonly tag: "custom" };
}

interface Bloop extends Transform {
  readonly input: AnyRoute;
  readonly output: BloopValue<this["input"]>;
}

interface BloopValue<R> {
  readonly type: "bloop";
  readonly route: R;
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
  // Compile without executing.
}

function numberOption<const N extends string>(key: N) {
  return option(name(key), schema(type("number | undefined")));
}

function textOption<const N extends string>(key: N) {
  return option(name(key), schema(type("string")));
}

function begin(_value: { readonly name: string }): 0 {
  return 0;
}

function one(_value: 0): 1 {
  return 1;
}

function two(_value: 1): 2 {
  return 2;
}

function three(_value: 2): 3 {
  return 3;
}

function four(_value: 3): 4 {
  return 4;
}

function five(_value: 4): 5 {
  return 5;
}

function six(_value: 5): 6 {
  return 6;
}

function seven(_value: 6): 7 {
  return 7;
}

function eight(_value: 7): 8 {
  return 8;
}

function nine(_value: 8): 9 {
  return 9;
}

function ten(_value: 9): 10 {
  return 10;
}

function eleven(_value: 10): 11 {
  return 11;
}
