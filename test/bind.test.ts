import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import * as z from "zod";
import { bind, bindPhase } from "../lib/bind.ts";
import { name } from "../lib/definition.ts";
import { param, schema } from "../lib/param.ts";
import { cli, type Symbol } from "../lib/read.ts";
import type { Rest } from "../lib/rest.ts";
import { tokenize } from "../lib/tokenize.ts";
import { Tokenizer } from "../lib/tokenizer.ts";
import { Values } from "../lib/values.ts";

describe("bind()", () => {
  describe("absence", () => {
    it("validates undefined after every source is absent", () => {
      let rest = state([]);
      let { result } = bind({
        param: param(name("port"), schema(z.number())),
        view: rest.tokens,
        rest,
      });

      expect(result).toMatchObject({
        ok: false,
        issues: [{ path: ["port"] }],
      });
    });

    it("lets an optional schema accept an absent value", () => {
      let rest = state([]);
      let { result } = bind({
        param: param(name("port"), schema(z.number().optional())),
        view: rest.tokens,
        rest,
      });

      expect(result).toEqual({
        ok: true,
        value: undefined,
        issues: [],
      });
    });

    it("lets a defaulting schema produce a value from absence", () => {
      let rest = state([]);
      let { result } = bind({
        param: param(name("port"), schema(z.number().default(9000))),
        view: rest.tokens,
        rest,
      });

      expect(result).toEqual({
        ok: true,
        value: 9000,
        issues: [],
      });
    });
  });

  describe("candidates", () => {
    it("tries a later decoding after an earlier one fails validation", () => {
      let rest = state(["--digits", "0012"]);
      let { result } = bind({
        param: param(
          name("digits"),
          cli(["--digits"]),
          schema(z.string()),
        ),
        view: rest.tokens,
        rest,
      });

      expect(result).toEqual({
        ok: true,
        value: "0012",
        issues: [],
      });
    });
  });

  describe("failed reads", () => {
    it("continues from the remainder of a claimed invalid read", () => {
      let input = state(["--port", "--verbose"]);
      let { result, rest } = bind({
        param: param(
          name("port"),
          cli(["--port"]),
          schema(z.number()),
        ),
        view: input.tokens,
        rest: input,
      });

      expect(result).toMatchObject({
        ok: false,
        issues: [{ message: "--port requires a value" }],
      });
      expect(texts(rest.tokens)).toEqual(["--verbose"]);
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
    let binding = bind({
      param: param(
        name("port"),
        cli(["--port"]),
        schema(z.number()),
      ),
      view: rest.tokens,
      rest,
    });

    expect(binding.rest.values).toBe(values);
    expect(texts(binding.rest.tokens)).toEqual([]);
  });

  describe("phase", () => {
    it("advances a cursor consumed by the phase", () => {
      let rest = state([
        "--foo",
        "--bar",
        "-c",
        "app.json",
        "auth0",
        "--x",
        "--y=z",
      ]);
      let items = Array.from(rest.tokens);
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
        phase: {
          params: { config, x },
          routes: [],
          values: [],
        },
        segment: {
          range: { start: -1 },
          cursor: items.find((token) => token.text === "app.json")?.index,
        },
        rest,
      });

      expect(binding).toMatchObject({
        valid: true,
        model: {
          config: "app.json",
          x: undefined,
        },
        cursor: items.find((token) => token.text === "auth0")?.index,
      });
      expect(texts(binding.rest.tokens)).toEqual([
        "--foo",
        "--bar",
        "auth0",
        "--x",
        "--y=z",
      ]);
    });

    it("retries absent parameters after another parameter advances the cursor", () => {
      let rest = state([
        "--target",
        "local",
        "--port",
        "9000",
        "auth0",
      ]);
      let items = Array.from(rest.tokens);
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
        phase: {
          // Port deliberately comes first. It is initially beyond the cursor.
          params: { port, target },
          routes: [],
          values: [],
        },
        segment: {
          range: { start: -1 },
          cursor: items.find((token) => token.text === "local")?.index,
        },
        rest,
      });

      expect(binding).toMatchObject({
        valid: true,
        model: {
          port: 9000,
          target: "local",
        },
        cursor: items.find((token) => token.text === "auth0")?.index,
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

function texts(tokens: Iterable<Symbol>): string[] {
  return Array.from(tokens, (token) => token.text);
}
