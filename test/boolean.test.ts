import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { option } from "../lib/option.ts";
import { parseNotOk } from "./test-helpers.ts";

describe("boolean", () => {
  it("is not considered a valid false value if it is undefined", () => {
    parseNotOk(option(type("boolean")), {});
  });
});
