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
    it("points out unrecognized keys", () => {
      let result = parse({
        objects: [{
          source: "config.yaml",
          value: {
            porp: 80,
          },
        }],
      });
      assert(!result.ok, `expected parse with unrecognized keys to fail`);
      const { unrecognized: [source] } = result;
      expect(source).toEqual({
        type: "unrecognized",
        key: "porp",
        source: "object",
        sourceName: "config.yaml",
        value: 80,
      });
    });
  });
  describe("env", () => {
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
    it("handles boolean values", () => {
      let result = new Configliere({
        enabled: {
          schema: type("boolean"),
        },
      }).parse({
        env: {
          ENABLED: "true",
        },
      });
      expect(assertOk(result).config).toEqual({ enabled: true });
    });
  });

  describe("cli", () => {
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
    it("handles boolean switches", () => {
      let result = new Configliere({
        test: {
          schema: type("boolean"),
        },
      }).parse({ args: ["--test"] });

      let { config } = assertOk(result);

      expect(config.test).toEqual(true);
    });
    it("can negate boolean values", () => {
      let result = new Configliere({
        test: {
          schema: type("boolean"),
        },
      }).parse({ args: ["--no-test"] });

      let { config } = assertOk(result);

      expect(config.test).toEqual(false);
    });
    it("can be have positional arguments", () => {
      let result = new Configliere({
        host: {
          schema: type("string"),
          cli: "positional",
        },
        port: {
          schema: type("number"),
          cli: "positional",
        },
      }).parse({ args: ["localhost", "3000"] });

      let { config } = assertOk(result);
      expect(config.host).toEqual("localhost");
      expect(config.port).toEqual(3000);
    });
    it("can be aliased", () => {
      let { config } = assertOk(new Configliere({
        host: {
          schema: type("string"),
          cli: {
            alias: "h",
          },
        },
        port: {
          schema: type("number"),
          cli: {
            alias: "p",
          },
        },
      }).parse({ args: ["-h", "localhost", "-p", "3000"] }));

      expect(config).toEqual({ host: "localhost", port: 3000 });
    });
    it("points out unrecognized options", () => {
      let result = new Configliere({
        port: {
          schema: type("number"),
          cli: {
            alias: "p",
          },
        },
      }).parse({ args: ["--plorp=3000"] });
      assert(!result.ok, `parse with unrecognized option should fail`);
      let [source] = result.unrecognized;
      expect(source).toMatchObject({
        key: "plorp",
        source: "option",
        sourceName: "cli",
        type: "unrecognized",
        value: 3000,
      });
    });
    it("points out unrecognized positional arguments", () => {
      let result = new Configliere({
	host: {
	  schema: type("string"),
	  cli: "positional"
	}
      }).parse({ args: ["localhost", "3000"]});
      assert(!result.ok, `expected parse to fail`);
      let { unrecognized: [source]} = result;
      expect(source).toEqual({
	type: "unrecognized",
	key: "1",
	source: "argument",
	sourceName: "cli",
	value: 3000
      });
    });
    it.skip("can collection arrays of values", () => {});
    it.skip("only allows the last positional argument to be an array", () => {});
  });
});

function assertOk<S extends Spec>(
  result: ParseResult<S>,
): { sources: Sources<S>; config: Config<S> } {
  if (result.ok) {
    return { config: result.config, sources: result.sources };
  } else {
    let { issues, unrecognized } = result;
    let messages = [
      ...issues.map(i => `${i.field.name}: ${i.message}`),
      ...unrecognized.map(s => `unrecognized ${s.source} ${s.key}: ${s.value}`),
    ]
    throw new TypeError(
      `expected successful parse result, but was: \n${messages.join("\n")}`,
    );
  }
}

// union options
// array options
// if schema is not actually array.
// tracking source, i.e. port num invalid from config
// only reports issues on inputs it receives. I.e. if there is no CLI args provided, no cli issues reported.
// note that keeping this equivalency can be constraining. This is a good thing.
