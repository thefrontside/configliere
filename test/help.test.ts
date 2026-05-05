import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import { argument } from "../lib/argument.ts";
import { option } from "../lib/option.ts";
import { type Attrs, object } from "../lib/object.ts";
import type { Input } from "../lib/types.ts";
import { format } from "../lib/help.ts";
import { createContext } from "../lib/context.ts";

function exam<T extends object>(attrs: Attrs<T>, input?: Input): string {
  let parser = object(attrs);
  return format(parser.inspect(createContext(input)), "configtest");
}

describe("help text", () => {
  describe("usage", () => {
    it("shows usage of positional arguments after their names", () => {
      let text = exam({
        source: argument(type("string")),
        target: argument(type("string")),
      });

      expect(text).toMatch(/Usage: configtest <source> <target>/);
    });

    it("shows brackets around optional positional arguments", () => {
      let text = exam({
        target: argument(type("string | undefined")),
      });

      expect(text).toMatch(/Usage: configtest \[target\]/);
    });

    it("shows options if there are options", () => {
      let text = exam({
        target: argument(type("string")),
        port: option(type("number")),
      });

      expect(text).toMatch(/Usage: configtest \[OPTIONS\] <target>/);
    });

    it("does not show commands if there are no commands", () => {
      let text = exam({
        port: option(type("number")),
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
        source: argument(type("string")),
        target: argument(type("string")),
      });

      expect(text).toMatch(/Arguments:/);
      expect(text).toMatch(/<source>/);
      expect(text).toMatch(/<target>/);
      expect(text).not.toMatch(/undefined/);
    });

    it("renders description of arguments if present", () => {
      let text = exam({
        source: argument(type("string"), { description: "file to copy" }),
        target: argument(type("string"), {
          description: "destination of copied file",
        }),
      });

      expect(text).toMatch(/<source>.* file to copy/);
      expect(text).toMatch(/<target>.* destination of/);
    });

    it("shows the default if there is one", () => {
      let text = exam({
        port: argument(type("number"), { default: 3000 }),
      });

      expect(text).toMatch(/<port>.*\[default: 3000]/);
    });

  });

  describe("options section", () => {
    it("is shown when there are options", () => {
      let text = exam({
        port: option(type("number")),
      });
      expect(text).toMatch(/Options:/);
    });
    it("shows option and aliases for the field", () => {
      let text = exam({
        port: option(type("number"), { aliases: ["-p"] }),
      });
      expect(text).toMatch(/-p, --port <PORT>/);
    });
    it("shows as a switch if the field is boolean", () => {
      let text = exam({
        awesome: option(type("boolean"), { aliases: ["-a"] }),
      });
      expect(text).toMatch(/--awesome/);
      expect(text).not.toMatch(/<AWESOME>/);
    });
    it("indicates optional fields", () => {
      let text = exam({
        port: option(type("number | undefined")),
      });
      expect(text).toMatch(/--port \[PORT\]/);
    });
    it("displays the description of an option", () => {
      let text = exam({
        port: option(type("number"), {
          description: "port on which to run server",
        }),
      });
      expect(text).toMatch(/--port <PORT>\s+ port on which to run server/);
    });
    it("displays the source of an option", () => {
      let text = exam({
        port: option(type("number"), { default: 3000 }),
      });
      expect(text).toMatch(/--port <PORT>\s+ \[default: 3000\]/);
    });
    it("does not display the source of an option if it is invalid", () => {
      let text = exam(
        {
          port: option(type("number")),
        },
        { args: ["--port", "fnjord"] },
      );
      expect(text).not.toMatch(/fnjord/);
    });
  });
});
