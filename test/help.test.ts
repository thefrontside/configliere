import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { type Attrs, object } from "../lib/object.ts";
import type { Input } from "../lib/types.ts";
import { parseSync } from "./test-helpers.ts";
import { format, inspect } from "../lib/help.ts";

function exam<T extends object>(attrs: Attrs<T>, input?: Input): string {
  let parser = object(attrs);
  if (input) {
    let result = parseSync(parser, input);
    if (result.ok) {
      return format(inspect(parser, result.data), "configtest");
    }
  }
  return format(inspect(parser), "configtest");
}

describe("help text", () => {
  describe("usage", () => {
    it("shows usage of positional arguments after their names", () => {
      let text = exam({
        source: field(type("string"), cli.argument()),
        target: field(type("string"), cli.argument()),
      });

      expect(text).toMatch(/Usage: configtest <source> <target>/);
    });

    it("shows brackets around optional positional arguments", () => {
      let text = exam({
        target: field(type("string | undefined"), cli.argument()),
      });

      expect(text).toMatch(/Usage: configtest \[target\]/);
    });

    it("shows ellipsis after positional arguments", () => {
      let text = exam({
        target: field(type("string"), cli.argument(), field.array()),
      });

      expect(text).toMatch(/Usage: configtest <target>.../);
    });

    it("shows options if there are options", () => {
      let text = exam({
        target: field(type("string"), cli.argument()),
        port: field(type("number")),
      });

      expect(text).toMatch(/Usage: configtest \[OPTIONS\] <target>/);
    });

    it("does not show commands if there are no commands", () => {
      let text = exam({
        port: field(type("number")),
      });

      expect(text).toMatch(/Usage: configtest \[OPTIONS\]/);
    });

    it("shows nothing but the program name if there are no options or arguments", () => {
      let text = exam({});

      expect(text).toMatch(/Usage: configtest/);
    });
  });

  describe("argument description", () => {
    it("shows a listing of all arguments", () => {
      let text = exam({
        source: field(type("string"), cli.argument()),
        target: field(type("string"), cli.argument()),
      });

      expect(text).toMatch(/Arguments:/);
      expect(text).toMatch(/<source>/);
      expect(text).toMatch(/<target>/);
      expect(text).not.toMatch(/undefined/);
    });

    it("renders description of arguments if present", () => {
      let text = exam({
        source: {
          description: "file to copy",
          ...field(type("string"), cli.argument()),
        },
        target: {
          description: "destination of copied file",
          ...field(type("string"), cli.argument()),
        },
      });

      expect(text).toMatch(/<source>.* file to copy/);
      expect(text).toMatch(/<target>.* destination of/);
    });

    it("shows the default if there is one", () => {
      let text = exam({
        port: field(type("number"), field.default(3000), cli.argument()),
      });

      expect(text).toMatch(/<port>.*\[default: 3000]/);
    });

    it("shows the current env source if there is one", () => {
      let text = exam(
        {
          port: field(type("number"), field.default(3000), cli.argument()),
        },
        { envs: [{ name: "env", value: { PORT: "3300" } }] },
      );

      expect(text).toMatch(/<port>.*\[env: PORT=3300]/);
    });

    it("shows the current object source if there is one", () => {
      let text = exam(
        {
          port: field(type("number"), field.default(3000), cli.argument()),
        },
        { values: [{ name: "config.json", value: { port: 3500 } }] },
      );

      expect(text).toMatch(/<port>.*\[config.json: port=3500]/);
    });
  });

  describe("options section", () => {
    it("is shown when there are options", () => {
      let text = exam({
        port: field(type("number")),
      });
      expect(text).toMatch(/Options:/);
    });
    it("shows option and aliases for the field", () => {
      let text = exam({
        port: { aliases: ["-p"], ...field(type("number")) },
      });
      expect(text).toMatch(/-p, --port <PORT>/);
    });
    it("shows as a switch if the field is boolean", () => {
      let text = exam({
        awesome: { aliases: ["-a"], ...field(type("boolean")) },
      });
      expect(text).toMatch(/--awesome/);
      expect(text).not.toMatch(/<AWESOME>/);
    });
    it("indicates optional fields", () => {
      let text = exam({
        port: field(type("number | undefined")),
      });
      expect(text).toMatch(/--port \[PORT\]/);
    });
    it("shows an ellipsis on multi-value fields", () => {
      let text = exam({
        user: field(type("string[]"), field.array()),
      });
      expect(text).toMatch(/--user <USER>... /);
    });
    it("displays the description of an option", () => {
      let text = exam({
        port: {
          description: "port on which to run server",
          ...field(type("number")),
        },
      });
      expect(text).toMatch(/--port <PORT>\s+ port on which to run server/);
    });
    it("displays the source of an option", () => {
      let text = exam({
        port: field(type("number"), field.default(3000)),
      });
      expect(text).toMatch(/--port <PORT>\s+ \[default: 3000\]/);
    });
    it("does not display the source of an option if it is invalid", () => {
      let text = exam(
        {
          port: field(type("number")),
        },
        { args: ["--port", "fnjord"] },
      );
      expect(text).not.toMatch(/fnjord/);
    });
  });
});
