import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import { Configliere } from "./mod.ts";
import { assert } from "@std/assert";
import { Config, ParseResult, Sources, Spec } from "./types.ts";

describe("configliere", () => {
  let { parse } = new Configliere({
    port: {
      schema: type("number"),
    },
    host: {
      schema: type("string | undefined"),
    },
  });

  describe("object", () => {
    it("parses config as object", () => {
      let result = parse({
        objects: [{
          source: "configliere.test.ts",
          value: {
            port: 80,
          },
        }],
      });

      assert(result.ok);
      expect(result.config).toEqual({ port: 80 });
      assert(result.sources.port.type === "object");
      expect(result.sources.port.name).toEqual("configliere.test.ts");
    });
    it("recognizes bad config", () => {
      let result = parse({
        objects: [{
          source: "app-config.yaml",
          value: {
            port: true,
          },
        }],
      });

      assert(!result.ok, `bad config should not produce a result`);
      let [issue] = result.issues;
      assert(issue.source.type === "object");
      expect(issue.source.name).toEqual("app-config.yaml");
      expect(issue.field.name).toEqual("port");
    });

    it("accepts multiple object configs, with the last one overriding", () => {
      let result = parse({
        objects: [{
          source: "one.json",
          value: {
            port: 80,
            host: "localhost",
          },
        }, {
          source: "two.json",
          value: {
            port: 8000,
          },
        }],
      });

      assert(result.ok, "expected successful parse");
      expect(result.config).toEqual({ host: "localhost", port: 8000 });
    });
  });
  describe("env var", () => {
    it("can set config from environment variables", () => {
      let result = parse({
        env: {
          PORT: "99",
        },
      });
      assert(result.ok, `expected successful result`);
      expect(result.config.port).toEqual(99);
    });
    it("rejects bad string to number conversions", () => {
      let result = parse({
        env: {
          PORT: "false",
        },
      });
      assert(!result.ok, `expected error result`);
    });
    it.skip("handles boolean switches", () => {});
  });

  describe("cli options", () => {
    it("handles string to number conversion", () => {
      let result = parse({
        args: ["--port", "80"],
      });

      let { config } = assertOk(result);
      expect(config.port).toEqual(80);
    });
    it("can use option=value format", () => {
      let result = parse({
        args: ["--port=80"],
      });

      let { config } = assertOk(result);
      expect(config.port).toEqual(80);
    });
    it.skip("can be have positional arguments", () => {});
    it.skip("points out unrecognized options", () => {});
    it.skip("points out unrecognized positional arguments", () => {});
    it.skip("rejects bad string to number conversions", () => {});
    it.skip("handles boolean switches", () => {});
    it.skip("can collection arrays of values", () => {});
    it.skip("can be aliased", () => {});
    it.skip("only allows the last positional argument to be an array", () => {});
  });
});

function assertOk<S extends Spec>(
  result: ParseResult<S>,
): { sources: Sources<S>; config: Config<S> } {
  if (result.ok) {
    return { config: result.config, sources: result.sources };
  } else {
    let { issues } = result;
    throw new TypeError(
      `expected successful parse result, but was: ${
        issues.map((i) => `${i.field.name}: ${i.message}`).join("\n")
      }`,
    );
  }
}

// union options
// array options
// if schema is not actually array.
// tracking source, i.e. port num invalid from config
// only reports issues on inputs it receives. I.e. if there is no CLI args provided, no cli issues reported.
// note that keeping this equivalency can be constraining. This is a good thing.
