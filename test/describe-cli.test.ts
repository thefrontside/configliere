import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import { type ConfigInputs, Configliere, type Spec } from "../mod.ts";

describe("help text", () => {
  describe("usage", () => {
    it("shows usage of positional arguments after their names", () => {
      let help = describeCLI({
        source: {
          schema: type("string"),
          cli: "positional",
        },
        target: {
          schema: type("string"),
          cli: "positional",
        },
      });

      expect(help).toMatch(/Usage: configtest <source> <target>/);
    });

    it("shows brackets around optional positional arguments", () => {
      let help = describeCLI({
        target: {
          schema: type("string | undefined"),
          cli: "positional",
        },
      });

      expect(help).toMatch(/Usage: configtest \[target\]/);
    });

    it("shows ellipsis after positional arguments", () => {
      let help = describeCLI({
        target: {
          schema: type("string"),
          collection: true,
          cli: "positional",
        },
      });

      expect(help).toMatch(/Usage: configtest <target>.../);
    });

    it("does shows options if there are options", () => {
      let help = describeCLI({
        target: {
          schema: type("string"),
          cli: "positional",
        },
        port: {
          schema: type("number"),
        },
      });

      expect(help).toMatch(/Usage: configtest \[OPTIONS\] <target>/);
    });

    it("does not show commands if there are no commands", () => {
      let help = describeCLI({
        port: {
          schema: type("number"),
        },
      });

      expect(help).toMatch(/Usage: configtest \[OPTIONS\]/);
    });

    it("shows nothing but the program name if there are no options or arguments", () => {
      let help = describeCLI({});

      expect(help).toMatch(/Usage: configtest/);
    });
  });

  describe("argument description", () => {
    it("shows a listing of all arguments", () => {
      let help = describeCLI({
        source: {
          schema: type("string"),
          cli: "positional",
        },
        target: {
          schema: type("string"),
          cli: "positional",
        },
      });

      expect(help).toMatch(/Arguments:/);
      expect(help).toMatch(/<source>/);
      expect(help).toMatch(/<target>/);
      expect(help).not.toMatch(/undefined/);
    });

    it("renders description of arguments if present", () => {
      let help = describeCLI({
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

      expect(help).toMatch(/<source>.* file to copy/);
      expect(help).toMatch(/<target>.* destination of/);
    });

    it("shows the default if there is one", () => {
      let help = describeCLI({
        port: {
          schema: type("number"),
          default: 3000,
          cli: "positional",
        },
      });

      expect(help).toMatch(/<port>.*\[default: 3000]/);
    });

    it("shows the current env source if there is one", () => {
      let help = describeCLI({
        port: {
          schema: type("number"),
          default: 3000,
          cli: "positional",
        },
      }, { env: { PORT: "3300" } });

      expect(help).toMatch(/<port>.*\[env: PORT=3300]/);
    });

    it("shows the current object source if there is one", () => {
      let help = describeCLI({
        port: {
          schema: type("number"),
          default: 3000,
          cli: "positional",
        },
      }, { objects: [{ source: "config.json", value: { port: 3500 } }] });

      expect(help).toMatch(/<port>.*\[config.json: port=3500]/);
    });
  });

  describe("options section", () => {
    it("is show when there are options", () => {
      let help = describeCLI({
        port: { schema: type("number") },
      });
      expect(help).toMatch(/Options:/);
    });
    it("shows option and aliases for the field", () => {
      let help = describeCLI({
        port: {
          schema: type("number"),
          cli: {
            alias: "p",
          },
        },
      });
      expect(help).toMatch(/-p, --port <PORT>/);
    });
    it("shows as a switch if the field is boolean", () => {
      let help = describeCLI({
        awesome: {
          schema: type("number"),
          cli: {
            alias: "a",
            switch: true,
          },
        },
      });
      expect(help).toMatch(/--awesome/);
      expect(help).not.toMatch(/<AWESOME>/);
    });
    it("indicates optional fields", () => {
      let help = describeCLI({
        port: {
          schema: type("number | undefined"),
        },
      });
      expect(help).toMatch(/--port \[PORT\]/);
    });
    it("shows an ellipsis on multi-value fields", () => {
      let help = describeCLI({
        user: {
          schema: type("string[]"),
          collection: true,
        },
      });
      expect(help).toMatch(/--user <USER>... /);
    });
    it("displays the description of an option", () => {
      let help = describeCLI({
        port: {
          description: "port on which to run server",
          schema: type("number"),
        },
      });
      expect(help).toMatch(/--port <PORT>\s+ port on which to run server/);
    });
    it("displays the source of an option", () => {
      let help = describeCLI({
        port: {
          schema: type("number"),
          default: 3000,
        },
      });
      expect(help).toMatch(/--port <PORT>\s+ \[default: 3000\]/);
    });
    it("does not display the source of an option if it is invalid", () => {
      let help = describeCLI({
        port: {
          schema: type("number"),
        },
      }, { args: ["--port", "fnjord"] });
      expect(help).not.toMatch(/fnjord/);
    });
  });
});

function describeCLI<S extends Spec>(
  spec: S,
  inputs: ConfigInputs = {},
): string {
  return new Configliere(spec).describeCLI(inputs, "configtest");
}

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
