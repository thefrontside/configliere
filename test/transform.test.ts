import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { checkpoint } from "../lib/checkpoint.ts";
import { command } from "../lib/command.ts";
import { name } from "../lib/definition.ts";
import { option } from "../lib/option.ts";
import { parse } from "../lib/parse.ts";
import type { ModelOf } from "../lib/types.ts";
import { schema, transform } from "../mod.ts";

describe("transform()", () => {
  it("rejects invalid transform definitions", () => {
    transform(
      // @ts-expect-error undeclared transform options must not be accepted
      (context) => ({ missing: context.options.missing }),
      option(name("port"), schema(type("number"))),
    );

    // @ts-expect-error transform outputs must be records
    transform(() => []);

    // @ts-expect-error transform batches cannot cross a checkpoint
    transform(
      () => ({ copy: true }),
      option(name("raw"), schema(type("string"))),
      checkpoint(),
      option(name("later"), schema(type("string"))),
    );
  });

  it("applies a transform after checkpoint resolution", () => {
    let app = command(
      name("transformed"),
      checkpoint(),
      transform(
        (context) => ({
          port: context.options.port,
          secure: context.options.port > 0,
        }),
        option(name("port"), schema(type("number"))),
      ),
    );
    expectType<
      Equal<ModelOf<typeof app>, {
        port: number;
        secure: boolean;
      }>
    >(true);

    let step = parse(app, { argv: ["--port", "4100"] });
    expect(step.ok).toBe(true);
    if (!step.ok) return;

    let result = step.resume({ ok: true, value: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({ model: { port: 4100, secure: true } });
  });

  it("infers a callback transform output", () => {
    let app = command(
      name("function-transformed"),
      transform(
        (context) => ({
          port: context.options.port,
          secure: Boolean(context.options.port),
        }),
        option(name("port"), schema(type("number"))),
      ),
    );

    expectType<
      Equal<ModelOf<typeof app>, {
        port: number;
        secure: boolean;
      }>
    >(true);
  });

  it("merges a transform result into the current model", () => {
    let app = command(
      name("mutated"),
      transform(
        (context) => ({ secure: context.options.port > 0 }),
        option(name("port"), schema(type("number"))),
      ),
    );
    expectType<
      Equal<ModelOf<typeof app>, {
        port: number;
        secure: boolean;
      }>
    >(true);

    let result = parse(app, { argv: ["--port", "4100"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({ model: { port: 4100, secure: true } });
  });

  it("applies an ArkType transform", () => {
    let model = type({ port: "number" }).pipe(() => ({ secure: true }));
    let app = command(
      name("schema-transformed"),
      transform(
        model,
        option(name("port"), schema(type("number"))),
      ),
    );
    expectType<
      Equal<ModelOf<typeof app>, {
        port: number;
        secure: boolean;
      }>
    >(true);

    let result = parse(app, { argv: ["--port", "4100"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      model: { port: 4100, secure: true },
    });
  });

  it("rejects non-record model transform results", () => {
    let model = type({}).pipe(() => []);
    let app = command(
      name("invalid-schema-transform"),
      transform(model),
    );
    let result = parse(app, { argv: ["--port", "4100"] });
    expect(result).toMatchObject({
      ok: false,
      code: "unprocessable-content",
    });
    if (result.ok || result.code !== "unprocessable-content") return;
    expect(result.issues).toMatchObject([{
      message: "model transforms must return records",
    }]);
  });

  it("returns issues from a schema transform", () => {
    let model = type({ port: "number" });
    let app = command(
      name("schema-with-issues"),
      transform(model),
    );
    let result = parse(app, { argv: [] });
    expect(result).toMatchObject({
      ok: false,
      code: "unprocessable-content",
    });
    if (result.ok || result.code !== "unprocessable-content") return;
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("returns issues added by a callback transform", () => {
    let app = command(
      name("callback-with-issues"),
      transform((context) => {
        context.addIssue({ message: "callback transform failed" });
        return {};
      }),
    );
    let result = parse(app, { argv: [] });
    expect(result).toMatchObject({
      ok: false,
      code: "unprocessable-content",
    });
    if (result.ok || result.code !== "unprocessable-content") return;
    expect(result.issues).toMatchObject([{
      message: "callback transform failed",
    }]);
  });

  it("allows an omitted optional transform option", () => {
    let app = command(
      name("optional-option"),
      transform(
        (context) => ({
          host: context.options.host ?? "localhost",
        }),
        option(name("host"), schema(type("string | undefined"))),
      ),
    );
    let result = parse(app, { argv: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({ model: { host: "localhost" } });
  });

  it("passes duplicate option names to a transform", () => {
    let app = command(
      name("duplicate-option"),
      option(name("port"), schema(type("number"))),
      transform(
        (context) => ({ copiedPort: context.options.port }),
        option(name("port"), schema(type("number"))),
      ),
    );
    let result = parse(app, { argv: ["--port", "4100"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      model: { port: 4100, copiedPort: 4100 },
    });
  });

  it("composes nested transforms", () => {
    let app = command(
      name("nested-transform"),
      transform(
        () => ({ outerCopy: Boolean(1) }),
        option(name("outer"), schema(type("number"))),
        transform(
          (context) => ({ innerCopy: context.options.inner }),
          option(name("inner"), schema(type("string"))),
        ),
      ),
    );
    expectType<
      Equal<ModelOf<typeof app>, {
        outer: number;
        inner: string;
        innerCopy: string;
        outerCopy: boolean;
      }>
    >(true);

    let result = parse(app, {
      argv: ["--outer", "4100", "--inner", "ok"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      model: {
        outer: 4100,
        inner: "ok",
        innerCopy: "ok",
        outerCopy: true,
      },
    });
  });

  it("passes nested transform outputs to the enclosing transform", () => {
    let app = command(
      name("nested-output"),
      transform(
        (context) => ({
          // @ts-expect-error callback inference does not yet expose nested output fields
          outer: context.options.inner.toUpperCase(),
        }),
        transform(
          (context) => ({ inner: context.options.raw }),
          option(name("raw"), schema(type("string"))),
        ),
      ),
    );
    let result = parse(app, { argv: ["--raw", "ok"] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      model: { raw: "ok", inner: "ok", outer: "OK" },
    });
  });

  it("applies model transforms in phase order", () => {
    let app = command(
      name("phased"),
      transform(
        () => ({ first: true }),
        option(name("before"), schema(type("number"))),
      ),
      checkpoint(),
      transform(
        (context) => ({ value: context.options.after }),
        option(name("after"), schema(type("string"))),
      ),
    );

    let first = parse(app, { argv: ["--before", "4100", "--after", "ok"] });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first).toMatchObject({ model: { before: 4100, first: true } });

    let result = first.resume({ ok: true, value: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      model: { before: 4100, first: true, after: "ok", value: "ok" },
    });
  });
});

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends
  (<T>() => T extends R ? 1 : 2) ? true
  : false;
