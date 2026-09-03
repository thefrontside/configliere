import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { type AnyToken, tokenize } from "../lib/tokenize.ts";
import { Tokenizer } from "../lib/tokenizer.ts";

describe("Tokenizer", () => {
  it("returns matching tokens and removes them from rest", () => {
    let source = tokenize(["-h", "database", "--verbose", "--port=9000"]);
    let tokenizer = new Tokenizer(source);

    let claim = tokenizer.claimAll((token) => token.type === "flag");

    expect(indices(claim.tokens)).toEqual([0, 2]);
    expect(indices(claim.rest)).toEqual([1, 3]);
  });

  it("does not change the tokenizer that was claimed", () => {
    let source = tokenize(["-h", "database", "--port=9000"]);
    let tokenizer = new Tokenizer(source);

    tokenizer.claimAll((token) => token.type === "flag");

    expect(indices(tokenizer)).toEqual([0, 1, 2]);
  });

  it("claims incrementally from the remaining tokens", () => {
    let source = tokenize([
      "-h",
      "database",
      "--verbose",
      "--port=9000",
    ]);
    let tokenizer = new Tokenizer(source);

    let flags = tokenizer.claimAll((token) => token.type === "flag");
    let setters = flags.rest.claimAll((token) => token.type === "setter");
    let words = setters.rest.claimAll((token) => token.type === "word");

    expect(indices(flags.tokens)).toEqual([0, 2]);
    expect(indices(setters.tokens)).toEqual([3]);
    expect(indices(words.tokens)).toEqual([1]);
    expect(indices(words.rest)).toEqual([]);
  });

  it("shares one token pool across independent remainders", () => {
    let source = tokenize(["-h", "database", "--port=9000"]);
    let tokenizer = new Tokenizer(source);

    let help = tokenizer.claimOne((token) => token.index === 0).rest;
    let database = tokenizer.claimOne((token) => token.index === 1).rest;

    expect(help.tokens).toBe(tokenizer.tokens);
    expect(database.tokens).toBe(tokenizer.tokens);
    expect(indices(help)).toEqual([1, 2]);
    expect(indices(database)).toEqual([0, 2]);
  });

  it("accumulates claims without wrapping the previous remainder", () => {
    let tokenizer = new Tokenizer(tokenize(["-h", "database", "--verbose"]));
    let help = tokenizer.claimOne((token) => token.index === 0).rest;
    let verbose = help.claimOne((token) => token.index === 2).rest;

    expect(verbose.tokens).toBe(tokenizer.tokens);
    expect(verbose.claimed).toEqual(new Set([0, 2]));
    expect(indices(verbose)).toEqual([1]);
  });

  it("does not test already claimed tokens again", () => {
    let source = tokenize(["-h", "database", "--port=9000"]);
    let tokenizer = new Tokenizer(source);
    let first = tokenizer.claimAll((token) => token.index === 0);
    let tested: number[] = [];

    first.rest.claimAll((token) => {
      tested.push(token.index);
      return false;
    });

    expect(tested).toEqual([1, 2]);
  });

  describe("view()", () => {
    it("shows only tokens in its range through its inclusive horizon", () => {
      let tokenizer = new Tokenizer(tokenize([
        "before",
        "--target",
        "local",
        "--port",
        "9000",
        "after",
      ]));
      let view = tokenizer.view({
        range: { start: 0, end: 5 },
        through: 2,
      });

      expect(indices(view)).toEqual([1, 2]);
    });

    it("shows the full range when there is no horizon", () => {
      let tokenizer = new Tokenizer(tokenize([
        "before",
        "--target",
        "local",
        "--port",
        "9000",
        "after",
      ]));
      let view = tokenizer.view({
        range: { start: 0, end: 5 },
      });

      expect(indices(view)).toEqual([1, 2, 3, 4]);
    });

    it("returns globally rooted remainders from claims through a view", () => {
      let tokenizer = new Tokenizer(tokenize([
        "before",
        "--target",
        "local",
        "--port",
        "9000",
        "after",
      ]));
      let view = tokenizer.view({
        range: { start: 0, end: 5 },
        through: 2,
      });
      let claim = view.claimPair((name, value) => {
        return name.text === "--target" && value.text === "local";
      });

      expect(indices(claim.tokens)).toEqual([1, 2]);
      expect(claim.rest.tokens).toBe(tokenizer.tokens);
      expect(indices(claim.rest)).toEqual([0, 3, 4, 5]);
    });

    it("returns the global tokenizer when a claim through a view misses", () => {
      let tokenizer = new Tokenizer(tokenize([
        "before",
        "--target",
        "local",
        "after",
      ]));
      let view = tokenizer.view({
        range: { start: 0, end: 3 },
        through: 2,
      });
      let claim = view.claimOne((token) => token.text === "--missing");

      expect(claim.tokens).toEqual([]);
      expect(claim.rest).toBe(tokenizer);
    });

    it("honors claims already made in the global tokenizer", () => {
      let tokenizer = new Tokenizer(tokenize([
        "before",
        "--target",
        "local",
        "after",
      ]));
      let claimed = tokenizer.claimOne((token) => token.index === 1).rest;
      let view = claimed.view({
        range: { start: 0, end: 3 },
        through: 2,
      });

      expect(indices(view)).toEqual([2]);
    });
  });
});

function indices(tokens: Iterable<AnyToken>): number[] {
  return Array.from(tokens, (token) => token.index);
}
