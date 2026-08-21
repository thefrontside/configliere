// deno-lint-ignore-file no-import-prefix no-unversioned-import
import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import * as z from "npm:zod";
import { bind } from "../lib/bind.ts";
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
