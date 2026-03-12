import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import { object } from "../lib/object.ts";
import { cli, field } from "../lib/field.ts";
import assert from "node:assert";
import { ValidationError } from "../lib/validate.ts";
import { ObjectValidationError } from "../lib/object.ts";
import { parseNotOk, parseOk, parseSync } from "./test-helpers.ts";

describe("object", () => {
  let configuration = object({
    port: field(type("number")),
    host: field(type("string | undefined")),
  });

  describe("object", () => {
    it("parses config as object", () => {
      let result = parseOk(configuration, {
        values: [{
          name: "configliere.test.ts",
          value: {
            port: 80,
          },
        }],
      });
      expect(result).toEqual({ port: 80 });
    });
    it("recognizes bad config", () => {
      let error = parseNotOk(configuration, {
        values: [{
          name: "app-config.yaml",
          value: {
            port: true,
          },
        }],
      });

      assert(error instanceof ObjectValidationError);
      let [{ path, error: fieldError }] = error.fields;

      expect(path).toEqual(["port"]);
      assert(fieldError instanceof ValidationError);
      expect(fieldError.sources[0].sourceName).toEqual("app-config.yaml");
    });

    it("accepts multiple object configs, with the last one overriding", () => {
      let result = parseOk(configuration, {
        values: [{
          name: "one.json",
          value: {
            port: 80,
            host: "localhost",
          },
        }, {
          name: "two.json",
          value: {
            port: 8000,
          },
        }],
      });

      expect(result).toEqual({ host: "localhost", port: 8000 });
    });
  });
  describe("env", () => {
    it("can set config from environment variables", () => {
      let result = parseOk(configuration, {
        envs: [{
          name: "env",
          value: {
            PORT: "99",
          },
        }],
      });
      expect(result.port).toEqual(99);
    });
    it("rejects bad string to number conversions", () => {
      let error = parseNotOk(configuration, {
        envs: [{
          name: "env",
          value: {
            PORT: "port",
          },
        }],
      });

      assert(error instanceof ObjectValidationError);
      let [{ path, error: fieldError }] = error.fields;

      expect(path).toEqual(["port"]);
      assert(fieldError instanceof ValidationError);
      expect(fieldError.sources[0].sourceType).toEqual("env");
      expect(fieldError.sources[0].issues).toBeDefined();
    });

    it("handles boolean values", () => {
      let result = parseOk(
        object({
          enabled: field(type("boolean")),
        }),
        {
          envs: [{
            name: "env",
            value: {
              ENABLED: "true",
            },
          }],
        },
      );
      expect(result).toEqual({ enabled: true });
    });
    it("handles multiple env sources", () => {
      let result = parseOk(configuration, {
        envs: [{
          name: "env",
          value: {
            HOST: "localhost",
            PORT: "8088",
          },
        }, {
          name: "import.meta.env",
          value: {
            HOST: "frontside.com",
          },
        }],
      });
      expect(result.host).toEqual("frontside.com");
      expect(result.port).toEqual(8088);
    });
  });

  describe("from cli", () => {
    it("handles string to number conversion", () => {
      let result = parseOk(configuration, {
        args: ["--port", "80"],
      });

      expect(result.port).toEqual(80);
    });
    it("can use option=value format", () => {
      let result = parseOk(configuration, {
        args: ["--port=80"],
      });

      expect(result.port).toEqual(80);
    });
    it("handles boolean switches", () => {
      let result = parseOk(
        object({
          test: field(type("boolean")),
        }),
        { args: ["--test"] },
      );

      expect(result.test).toEqual(true);
    });
    it("can negate boolean values", () => {
      let result = parseOk(
        object({
          test: field(type("boolean")),
        }),
        { args: ["--no-test"] },
      );

      expect(result.test).toEqual(false);
    });
    it("can have positional arguments", () => {
      let config = object({
        host: field(type("string"), cli.argument()),
        port: field(type("number"), cli.argument()),
      });

      let result = parseOk(config, { args: ["localhost", "3000"] });
      expect(result.host).toEqual("localhost");
      expect(result.port).toEqual(3000);
    });
    it("can be aliased", () => {
      let result = parseOk(
        object({
          host: { aliases: ["-h"], ...field(type("string")) },
          port: { aliases: ["-p"], ...field(type("number")) },
        }),
        { args: ["-h", "localhost", "-p", "3000"] },
      );

      expect(result).toEqual({ host: "localhost", port: 3000 });
    });
    it("handles a mixture of arguments and options", () => {
      let config = object({
        host: field(type("string"), cli.argument()),
        port: { aliases: ["-p"], ...field(type("number")) },
        message: field(type("string"), cli.argument()),
      });

      let forward = parseOk(config, {
        args: ["localhost", "awesome", "-p", "3000"],
      });

      expect(forward.host).toEqual("localhost");
      expect(forward.message).toEqual("awesome");
      expect(forward.port).toEqual(3000);

      let backward = parseOk(config, {
        args: ["-p", "3000", "localhost", "awesome"],
      });

      expect(backward.host).toEqual("localhost");
      expect(backward.message).toEqual("awesome");
      expect(backward.port).toEqual(3000);

      let middle = parseOk(config, {
        args: ["localhost", "-p", "3000", "awesome"],
      });

      expect(middle.host).toEqual("localhost");
      expect(middle.message).toEqual("awesome");
      expect(middle.port).toEqual(3000);
    });
    it("points out unrecognized options on successful parse", () => {
      let result = parseSync(
        object({
          port: field(type("number")),
        }),
        { args: ["--port=3000", "--plort=3000"] },
      );

      assert(result.ok);
      expect(result.remainder.args).toEqual(["--plort=3000"]);
    });

    it("can collect an array of option values", () => {
      let result = parseOk(
        object({
          user: field(type("string[]"), field.array()),
        }),
        { args: ["--user", "cowboyd", "--user", "mz"] },
      );

      expect(result.user).toEqual(["cowboyd", "mz"]);
    });
    it("kebab-cases multi-word camelCase options", () => {
      let result = parseOk(
        object({
          inspectWatchScopes: field(type("boolean")),
        }),
        { args: ["--inspect-watch-scopes"] },
      );

      expect(result.inspectWatchScopes).toEqual(true);
    });
    it("can collect arrays of argument values", () => {
      let result = parseOk(
        object({
          user: field(type("string[]"), field.array(), cli.argument()),
        }),
        { args: ["cowboyd", "mz"] },
      );
      expect(result.user).toEqual(["cowboyd", "mz"]);
    });
  });

  describe("default value", () => {
  });

  describe("nested", () => {
  });

  describe("with non-consuming sub-parsers", () => {
  });
});
