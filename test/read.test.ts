import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { name } from "../lib/definition.ts";
import { multiple, param } from "../lib/param.ts";
import { cli, type Symbol } from "../lib/read.ts";
import { tokenize } from "../lib/tokenize.ts";
import { Tokenizer } from "../lib/tokenizer.ts";

describe("CLI reader", () => {
  it("claims an incomplete option while reporting its missing value", () => {
    let read = param(
      name("port"),
      cli(["--port"]),
    ).cli.read(symbols(["--port", "--verbose"]));

    expect(read.result).toMatchObject({
      ok: false,
      issues: [{ message: "--port requires a value" }],
    });
    expect(texts(read.claim.tokens)).toEqual(["--port"]);
    expect(texts(read.claim.rest)).toEqual(["--verbose"]);
  });

  it("collects repeated options with separate values", () => {
    let read = param(
      name("config"),
      multiple(),
      cli(["--config"]),
    ).cli.read(symbols(["--config", "one", "--config", "two"]), true);

    expect(read.result).toEqual({
      ok: true,
      value: { exists: true, value: ["one", "two"] },
      issues: [],
    });
    expect(texts(read.claim.rest)).toEqual([]);
  });

  it("collects repeated setter options in argv order", () => {
    let read = param(
      name("config"),
      multiple(),
      cli(["--config"]),
    ).cli.read(symbols(["--config=one", "--config=two"]), true);

    expect(read.result).toEqual({
      ok: true,
      value: { exists: true, value: ["one", "two"] },
      issues: [],
    });
    expect(texts(read.claim.rest)).toEqual([]);
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
