import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import { Configliere } from "../mod.ts";

describe("help text", () => {
  describe("usage", () => {
    it("shows usage of positional arguments after their names", () => {
      let { describeCLI } = new Configliere({
        source: {
          schema: type("string"),
          cli: "positional",
        },
        target: {
          schema: type("string"),
          cli: "positional",
        },
      });
      expect(describeCLI({}, "configtest")).toMatch(
        /Usage: configtest <source> <target>/,
      );
    });
    it("shows brackets around optional positional arguments", () => {
      let { describeCLI } = new Configliere({
        target: {
          schema: type("string | undefined"),
          cli: "positional",
        },
      });
      expect(describeCLI({}, "configtest")).toMatch(
        /Usage: configtest \[target\]/,
      );
    });
    it("shows ellipsis after positional arguments", () => {
      let { describeCLI } = new Configliere({
        target: {
          schema: type("string"),
          collection: true,
          cli: "positional",
        },
      });
      expect(describeCLI({}, "configtest")).toMatch(
        /Usage: configtest <target>.../,
      );
    });
    it("does shows options if there are options", () => {
      let { describeCLI } = new Configliere({
        target: {
          schema: type("string"),
          cli: "positional",
        },
        port: {
          schema: type("number"),
        },
      });
      expect(describeCLI({}, "configtest")).toMatch(
        /Usage: configtest \[OPTIONS\] <target>/,
      );
    });
    it("does not show commands if there are no commands", () => {
      let { describeCLI } = new Configliere({
        port: {
          schema: type("number"),
        },
      });
      expect(describeCLI({}, "configtest")).toMatch(
        /Usage: configtest \[OPTIONS\]/,
      );
    });
    it("shows nothing but the program name if there are no options or arguments", () => {
      let { describeCLI } = new Configliere({});
      expect(describeCLI({}, "configtest")).toMatch(/Usage: configtest/);
    });
  });

  describe("argument description", () => {
    it("shows a listing of all arguments", () => {
      let { describeCLI } = new Configliere({
        source: {
          schema: type("string"),
          cli: "positional",
        },
        target: {
          schema: type("string"),
          cli: "positional",
        },
      });
      expect(describeCLI({}, "configtest")).toMatch(/Arguments:/);
      expect(describeCLI({}, "configtest")).toMatch(/<source>/);
      expect(describeCLI({}, "configtest")).toMatch(/<target>/);
      expect(describeCLI({}, "configtest")).not.toMatch(/undefined/);
    });
    it("renders description of arguments if present", () => {
      let { describeCLI } = new Configliere({
        source: {
          description: "file to copy",
          schema: type("string"),
          cli: "positional",
        },
        target: {
          description: "destination of copied file",
          schema: type("string"),
          cli: "positional",
        },
      });
      expect(describeCLI({}, "configtest")).toMatch(/<source>.* file to copy/);
      expect(describeCLI({}, "configtest")).toMatch(
        /<target>.* destination of/,
      );
    });
    it("shows the default if there is one", () => {
      let { describeCLI } = new Configliere({
        port: {
          schema: type("number"),
          default: 3000,
          cli: "positional",
        },
      });
      expect(describeCLI({}, "configtest")).toMatch(/<port>.*\[default: 3000]/);
    });

    it("shows the current env source if there is one", () => {
      let { describeCLI } = new Configliere({
        port: {
          schema: type("number"),
          default: 3000,
          cli: "positional",
        },
      });
      let env = { PORT: "3300" };
      expect(describeCLI({ env }, "configtest")).toMatch(
        /<port>.*\[env: PORT=3300]/,
      );
    });

    it("shows the current object source if there is none", () => {
      let { describeCLI } = new Configliere({
        port: {
          schema: type("number"),
          default: 3000,
          cli: "positional",
        },
      });
      let objects = [{ source: "config.json", value: { port: 3500 } }];
      expect(describeCLI({ objects }, "configtest")).toMatch(
        /<port>.*\[config.json: port=3500]/,
      );
    });
  });
});

/*
  Help Text Format Tests
Basic help display validation

Verify help text includes all sections: USAGE, ARGUMENTS, OPTIONS, CONFIGURATION, EXAMPLES
Ensure consistent indentation and spacing throughout help output
Confirm all command line options show both short and long forms where applicable
Validate that environment variable names follow consistent naming convention
Check that config file paths use proper dot notation format

Option documentation completeness

Ensure every option shows default values in square brackets when applicable
Verify constraint information is displayed for options with validation rules
Confirm required vs optional arguments are clearly distinguished
Check that value placeholders use consistent angle bracket format

Configuration precedence documentation

Verify precedence order is clearly stated (CLI > env > config file)
Ensure configuration file format example is syntactically correct
Confirm mixed-source examples demonstrate precedence correctly
   */
