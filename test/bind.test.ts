import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import * as z from "zod";
import { bind, bindPhase } from "../lib/bind.ts";
import { name } from "../lib/definition.ts";
import { param, schema } from "../lib/param.ts";
import { cli, type Symbol } from "../lib/read.ts";
import { tokenize } from "../lib/tokenize.ts";
import { Tokenizer } from "../lib/tokenizer.ts";

describe("bind()", () => {
  describe("absence", () => {
    it("validates undefined after every source is absent", () => {
      let { result } = bind({
        param: param(name("port"), schema(z.number())),
        tokens: symbols([]),
      });

      expect(result).toMatchObject({
        ok: false,
        issues: [{ path: ["port"] }],
      });
    });

    it("lets an optional schema accept an absent value", () => {
      let { result } = bind({
        param: param(name("port"), schema(z.number().optional())),
        tokens: symbols([]),
      });

      expect(result).toEqual({
        ok: true,
        value: undefined,
        issues: [],
      });
    });

    it("lets a defaulting schema produce a value from absence", () => {
      let { result } = bind({
        param: param(name("port"), schema(z.number().default(9000))),
        tokens: symbols([]),
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
      let { result } = bind({
        param: param(
          name("digits"),
          cli(["--digits"]),
          schema(z.string()),
        ),
        tokens: symbols(["--digits", "0012"]),
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
      let { result, rest } = bind({
        param: param(
          name("port"),
          cli(["--port"]),
          schema(z.number()),
        ),
        tokens: symbols(["--port", "--verbose"]),
      });

      expect(result).toMatchObject({
        ok: false,
        issues: [{ message: "--port requires a value" }],
      });
      expect(texts(rest)).toEqual(["--verbose"]);
    });
  });

  describe("phase", () => {
    it("advances a cursor consumed by the phase", () => {
      let tokens = symbols([
        "--foo",
        "--bar",
        "-c",
        "app.json",
        "auth0",
        "--x",
        "--y=z",
      ]);
      let values = Array.from(tokens);
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
        },
        segment: {
          tokens: values,
          cursor: values.find((token) => token.text === "app.json")?.index,
        },
        tokens,
      });

      expect(binding).toMatchObject({
        valid: true,
        model: {
          config: "app.json",
          x: undefined,
        },
        cursor: values.find((token) => token.text === "auth0")?.index,
      });
      expect(texts(binding.rest)).toEqual([
        "--foo",
        "--bar",
        "auth0",
        "--x",
        "--y=z",
      ]);
    });

    it("retries absent parameters after another parameter advances the cursor", () => {
      let tokens = symbols([
        "--target",
        "local",
        "--port",
        "9000",
        "auth0",
      ]);
      let values = Array.from(tokens);
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
        },
        segment: {
          tokens: values,
          cursor: values.find((token) => token.text === "local")?.index,
        },
        tokens,
      });

      expect(binding).toMatchObject({
        valid: true,
        model: {
          port: 9000,
          target: "local",
        },
        cursor: values.find((token) => token.text === "auth0")?.index,
      });
      expect(texts(binding.rest)).toEqual(["auth0"]);
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

function texts(tokens: Iterable<Symbol>): string[] {
  return Array.from(tokens, (token) => token.text);
}
