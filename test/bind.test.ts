import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import * as z from "zod";
import { type Binding, bindPhase, fromCLI } from "../lib/bind.ts";
import { name } from "../lib/definition.ts";
import type { Maybe } from "../lib/maybe.ts";
import { type Param, param, schema } from "../lib/param.ts";
import { cli, type Symbol } from "../lib/read.ts";
import type { Rest } from "../lib/rest.ts";
import { tokenize } from "../lib/tokenize.ts";
import { Tokenizer } from "../lib/tokenizer.ts";
import { Values } from "../lib/values.ts";

describe("binding", () => {
  describe("absence", () => {
    it("validates undefined after every source is absent", () => {
      let port = param(name("port"), schema(z.number()));
      let result = bindPhase({
        phase: phase({ port }),
        segment: segment(),
        rest: state([]),
      });

      expect(result).toMatchObject({
        valid: false,
        issues: [{ path: ["port"] }],
      });
    });

    it("lets an optional schema accept an absent value", () => {
      let port = param(name("port"), schema(z.number().optional()));
      let result = bindPhase({
        phase: phase({ port }),
        segment: segment(),
        rest: state([]),
      });

      expect(result).toMatchObject({
        valid: true,
        model: { port: undefined },
        issues: [],
      });
    });

    it("lets a defaulting schema produce a value from absence", () => {
      let port = param(name("port"), schema(z.number().default(9000)));
      let result = bindPhase({
        phase: phase({ port }),
        segment: segment(),
        rest: state([]),
      });

      expect(result).toMatchObject({
        valid: true,
        model: { port: 9000 },
        issues: [],
      });
    });

    it("represents a source miss without validating undefined", () => {
      let rest = state([]);
      let attempt = fromCLI({
        param: param(name("port"), schema(z.number())),
        view: rest.tokens,
        rest,
      });

      expect(attempt).toEqual({ exists: false });
    });
  });

  describe("candidates", () => {
    it("tries a later decoding after an earlier one fails validation", () => {
      let rest = state(["--digits", "0012"]);
      let attempt = fromCLI({
        param: param(
          name("digits"),
          cli(["--digits"]),
          schema(z.string()),
        ),
        view: rest.tokens,
        rest,
      });

      expectType<Equal<typeof attempt, Maybe<Binding<string>>>>(true);
      expect(attempt).toMatchObject({
        exists: true,
        value: {
          result: {
            ok: true,
            value: "0012",
            issues: [],
          },
        },
      });
    });
  });

  describe("failed reads", () => {
    it("continues from the remainder of a claimed invalid read", () => {
      let input = state(["--port", "--verbose"]);
      let attempt = fromCLI({
        param: param(
          name("port"),
          cli(["--port"]),
          schema(z.number()),
        ),
        view: input.tokens,
        rest: input,
      });

      assertAttempt(attempt);
      expect(attempt.value.result).toMatchObject({
        ok: false,
        issues: [{ message: "--port requires a value" }],
      });
      expect(texts(attempt.value.rest.tokens)).toEqual(["--verbose"]);
    });
  });

  it("preserves issues from a successful read", () => {
    let base = param(
      name("port"),
      cli(["--port"]),
      schema(z.number()),
    );
    let read = base.cli;
    let port = {
      ...base,
      cli(tokens: Parameters<typeof read>[0]) {
        let capture = read(tokens);
        return capture.result.ok
          ? {
            ...capture,
            result: {
              ...capture.result,
              issues: [{ message: "--port is deprecated" }],
            },
          }
          : capture;
      },
    };
    let result = bindPhase({
      phase: phase({ port }),
      segment: segment(),
      rest: state(["--port", "9001"]),
    });

    expect(result).toMatchObject({
      valid: true,
      model: { port: 9001 },
      issues: [{ message: "--port is deprecated" }],
    });
  });

  it("preserves value sources when claiming CLI tokens", () => {
    let values = new Values().mount([], [{
      name: "settings",
      value: { port: 9000 },
    }]);
    let rest: Rest = {
      tokens: symbols(["--port", "9001"]),
      values,
    };
    let attempt = fromCLI({
      param: param(
        name("port"),
        cli(["--port"]),
        schema(z.number()),
      ),
      view: rest.tokens,
      rest,
    });

    assertAttempt(attempt);
    expect(attempt.value.rest.values).toBe(values);
    expect(texts(attempt.value.rest.tokens)).toEqual([]);
  });

  describe("phase", () => {
    it("advances the horizon when the phase consumes it", () => {
      let rest = state([
        "--foo",
        "--bar",
        "-c",
        "app.json",
        "auth0",
        "--x",
        "--y=z",
      ]);
      let config = param(
        name("config"),
        cli(["-c"]),
        schema(z.string()),
      );
      let x = param(
        name("x"),
        cli(["--x"]),
        schema(z.string().optional()),
      );
      let binding = bindPhase({
        phase: phase({ config, x }),
        segment: segment(),
        rest,
      });

      expect(binding).toMatchObject({
        valid: true,
        model: {
          config: "app.json",
          x: undefined,
        },
      });
      expect(texts(binding.rest.tokens)).toEqual([
        "--foo",
        "--bar",
        "auth0",
        "--x",
        "--y=z",
      ]);
    });

    it("retries absent parameters after another parameter advances the horizon", () => {
      let rest = state([
        "--target",
        "local",
        "--port",
        "9000",
        "auth0",
      ]);
      let port = param(
        name("port"),
        cli(["--port"]),
        schema(z.number()),
      );
      let target = param(
        name("target"),
        cli(["--target"]),
        schema(z.string()),
      );
      let binding = bindPhase({
        // Port deliberately comes first. It is initially beyond the horizon.
        phase: phase({ port, target }),
        segment: segment(),
        rest,
      });

      expect(binding).toMatchObject({
        valid: true,
        model: {
          port: 9000,
          target: "local",
        },
      });
      expect(texts(binding.rest.tokens)).toEqual(["auth0"]);
    });
  });
});

function symbols(argv: string[]): Tokenizer<Symbol> {
  let tokens = tokenize(argv).filter((token): token is Symbol => {
    return token.type === "flag" || token.type === "setter" ||
      token.type === "word";
  });

  return new Tokenizer(tokens);
}

function state(argv: string[]): Rest {
  return {
    tokens: symbols(argv),
    values: new Values(),
  };
}

function phase(params: Record<string, Param<string, unknown>>) {
  return {
    params,
    routes: [],
    values: [],
  };
}

function segment() {
  return {
    range: { start: -1 },
    path: [],
  };
}

function assertAttempt<T>(
  attempt: Maybe<Binding<T>>,
): asserts attempt is { readonly exists: true; readonly value: Binding<T> } {
  expect(attempt).toMatchObject({ exists: true });
}

function texts(tokens: Iterable<Symbol>): string[] {
  return Array.from(tokens, (token) => token.text);
}

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends
  (<T>() => T extends R ? 1 : 2)
  ? (<T>() => T extends R ? 1 : 2) extends (<T>() => T extends L ? 1 : 2) ? true
  : false
  : false;

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}
