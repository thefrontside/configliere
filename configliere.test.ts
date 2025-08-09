import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import { Configliere } from "./mod.ts";
import { assert } from "@std/assert";

describe("configliere", () => {
  describe("object", () => {
    let { parse } = new Configliere({
      port: {
	schema: type("number")
      },
      host: {
	schema: type("string | undefined")
      }
    });

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
	    port: true
	  },
	}]
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
	    port: 8000
	  }
	}],	
      });

      assert(result.ok, "expected successful parse");
      expect(result.config).toEqual({ host: "localhost", port: 8000});
    });

  });
  describe("env vars", () => {
    it.skip("can set config from environment variables", () => {});
    it.skip("handles string to number conversion", () => {});
    it.skip("rejects bad string to number conversions", () => {});
    it.skip("handles boolean switches", () => {});
  });
  
  describe("cli options", () => {
    it.skip("handles string to number conversion", () => {
    });
    it.skip("rejects bad string to number conversions", () => {});
    it.skip("handles boolean switches", () => {});
  });



  describe("type", () => {
    it("allows for a partially specified config", () => {
    });
  });
});

// union options
// array options
// if schema is not actually array.
// tracking source, i.e. port num invalid from config
// only reports issues on inputs it receives. I.e. if there is no CLI args provided, no cli issues reported.
// note that keeping this equivalency can be constraining. This is a good thing.
