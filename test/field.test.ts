import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { field } from "../lib/field.ts";
import assert from "node:assert";
import { ValidationError } from "../lib/validate.ts";
import { parseSync } from "./test-helpers.ts";

describe("field", () => {
  describe("from js", () => {
    it("can be set from a valid value", () => {
      let result = parseSync(field(type("number")), {
        values: [{ name: "test", value: 5 }],
      });
      assert(result.ok);
      expect(result.value).toEqual(5);
      expect(result.data.source.issues).toBeUndefined();
    });

    it("recognizes invalid values", () => {
      let result = parseSync(field(type("number")), {
        values: [{ name: "test", value: true }],
      });
      assert(!result.ok);
      assert(result.error instanceof ValidationError, "should be invalid");
      expect(result.error.message).toMatch(/must be a number/);
    });

    it("includes a source for every passed value", () => {
      let result = parseSync(field(type("number")), {
        values: [
          { name: "ausente", value: undefined },
          { name: "invalido", value: "not a number" },
          { name: "valido.2", value: 2 },
          { name: "valido.1", value: 1 },
        ],
      });
      assert(result.ok);
      expect(result.value).toEqual(1);

      let [ausente, invalido, two, one] = result.data.sources;
      expect(ausente.issues).toBeDefined();
      expect(invalido.issues).toBeDefined();
      expect(one.issues).not.toBeDefined();
      expect(two.issues).not.toBeDefined();
    });

    it("can be valid even with no input", () => {
      let result = parseSync(field(type("number|undefined")), { values: [] });
      assert(result.ok);
      expect(result.value).toBeUndefined();
      expect(result.data.source.sourceType).toEqual("none");
    });

    it("uses a default value if no source is found", () => {
      let result = parseSync(field(type("number"), field.default(3000)), {
        values: [],
      });
      assert(result.ok);
      expect(result.value).toEqual(3000);
      expect(result.data.source.sourceType).toEqual("default");
    });

    it("uses a falsy default of false", () => {
      let result = parseSync(field(type("boolean"), field.default(false)), {});
      assert(result.ok);
      expect(result.value).toEqual(false);
      expect(result.data.source.sourceType).toEqual("default");
    });

    it("uses a falsy default of 0", () => {
      let result = parseSync(field(type("number"), field.default(0)), {});
      assert(result.ok);
      expect(result.value).toEqual(0);
      expect(result.data.source.sourceType).toEqual("default");
    });

    it("uses a falsy default of empty string", () => {
      let result = parseSync(field(type("string"), field.default("")), {});
      assert(result.ok);
      expect(result.value).toEqual("");
      expect(result.data.source.sourceType).toEqual("default");
    });
  });

  describe("from env", () => {
    it("parses a number", () => {
      let result = parseSync(field(type("number")), {
        envs: [{ name: "ENV", value: { "": "5" } }],
      });
      assert(result.ok);
      expect(result.value).toEqual(5);
      expect(result.data.source.sourceType).toEqual("env");
    });

    it("can parse a boolean", () => {
      let config = field(type("boolean"));
      let yes = parseSync(config, {
        envs: [{ name: "ENV", value: { "": "yes" } }],
      });
      assert(yes.ok);
      expect(yes.value).toEqual(true);

      let no = parseSync(config, {
        envs: [{ name: "ENV", value: { "": "no" } }],
      });
      assert(no.ok);
      expect(no.value).toEqual(false);
    });

    it("sees everything else as a string", () => {
      let result = parseSync(field(type("string")), {
        envs: [{ name: "ENV", value: { "": "localhost" } }],
      });
      assert(result.ok);
      expect(result.value).toEqual("localhost");
    });

    it.skip("supports custom parsers", () => {});
  });

  describe("schema-level defaults", () => {
    // Simulates a schema that transforms undefined into a default value,
    // like Zod's z.boolean().default(false) does via Standard Schema.
    let boolWithDefault: StandardSchemaV1<boolean> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate(value) {
          if (value === undefined) return { value: false };
          if (value === true || value === false) return { value };
          return { issues: [{ message: "expected boolean" }] };
        },
      },
    };

    it("applies the schema default when no input is provided", () => {
      let result = parseSync(field(boolWithDefault), {});
      assert(result.ok);
      expect(result.value).toEqual(false);
    });

    it("uses the provided value over the schema default", () => {
      let result = parseSync(field(boolWithDefault), {
        values: [{ name: "test", value: true }],
      });
      assert(result.ok);
      expect(result.value).toEqual(true);
    });

    it("uses the schema-transformed value from object sources", () => {
      // A schema that normalizes strings to lowercase
      let lower: StandardSchemaV1<string> = {
        "~standard": {
          version: 1,
          vendor: "test",
          validate(value) {
            if (typeof value === "string") {
              return { value: value.toLowerCase() };
            }
            return { issues: [{ message: "expected string" }] };
          },
        },
      };
      let result = parseSync(field(lower), {
        values: [{ name: "test", value: "HELLO" }],
      });
      assert(result.ok);
      expect(result.value).toEqual("hello");
    });
  });

  it("includes validation issues in the error when no input is provided", () => {
    let result = parseSync(field(type("number")), {});
    assert(!result.ok);
    assert(result.error instanceof ValidationError);
    expect(result.error.message).toMatch(/must be a number/);
  });
});
