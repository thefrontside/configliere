import { describe, it } from "@std/testing/bdd";
import { type } from "arktype";
import { field } from "../lib/field.ts";
import { parseNotOk } from "./test-helpers.ts";

describe("boolean", () => {
  it("is not considered a valid false value if it is undefined", () => {
    parseNotOk(field(type("boolean")), {});
  });
});
