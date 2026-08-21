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
});

function indices(tokens: Iterable<AnyToken>): number[] {
  return Array.from(tokens, (token) => token.index);
}
