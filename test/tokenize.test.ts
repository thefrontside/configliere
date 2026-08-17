// deno-lint-ignore-file no-import-prefix
import { expect } from "jsr:@std/expect@^1.0.19";
import { describe, it } from "@std/testing/bdd";
import { tokenize } from "../lib/tokenize.ts";

describe("tokenize()", () => {
  it("classifies argv without assigning semantic meaning", () => {
    expect(
      tokenize(["-h", "--help", "-aux", "--port=9000", "database"]),
    ).toEqual([
      {
        type: "flag",
        flagType: "short",
        index: 0,
        text: "-h",
        flagText: "h",
      },
      {
        type: "flag",
        flagType: "long",
        index: 1,
        text: "--help",
        flagText: "help",
      },
      {
        type: "flag",
        flagType: "short",
        index: 2,
        text: "-aux",
        flagText: "aux",
      },
      {
        type: "setter",
        index: 3,
        text: "--port=9000",
        nameText: "port",
        valueText: "9000",
      },
      {
        type: "literal",
        index: 4,
        text: "database",
      },
    ]);
  });

  it("keeps a stacked short flag as one token", () => {
    expect(tokenize(["-aux"])).toEqual([
      {
        type: "flag",
        flagType: "short",
        index: 0,
        text: "-aux",
        flagText: "aux",
      },
    ]);
  });

  it("splits setters at the first equals sign", () => {
    expect(tokenize(["--url=https://example.test?a=b", "--name="])).toEqual([
      {
        type: "setter",
        index: 0,
        text: "--url=https://example.test?a=b",
        nameText: "url",
        valueText: "https://example.test?a=b",
      },
      {
        type: "setter",
        index: 1,
        text: "--name=",
        nameText: "name",
        valueText: "",
      },
    ]);
  });

  it("treats every argument after -- as a literal", () => {
    expect(tokenize(["--help", "--", "--version", "-V", "--port=9000"]))
      .toEqual([
        {
          type: "flag",
          flagType: "long",
          index: 0,
          text: "--help",
          flagText: "help",
        },
        {
          type: "separator",
          index: 1,
          text: "--",
        },
        {
          type: "literal",
          index: 2,
          text: "--version",
        },
        {
          type: "literal",
          index: 3,
          text: "-V",
        },
        {
          type: "literal",
          index: 4,
          text: "--port=9000",
        },
      ]);
  });
});
