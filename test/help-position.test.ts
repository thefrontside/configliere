import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import assert from "node:assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { commands } from "../lib/commands.ts";
import { program } from "../lib/program.ts";
import type { Program } from "../lib/program.ts";
import { parseSync } from "./test-helpers.ts";

describe("help position-insensitivity", () => {
  describe("top-level program help", () => {
    let app = program({
      name: "myapp",
      config: object({
        config: field(type("string | undefined")),
        watch: field(type("boolean"), field.default(false)),
      }),
    });

    it("detects --help first (existing behavior)", () => {
      let result = parseSync(app, {
        args: ["--help", "--config", "f.json"],
      });
      assert(result.ok);
      let value = result.value as Program<{ config?: string; watch: boolean }>;
      expect(value.help).toBe(true);
    });

    it("detects --help last via post-parse remainder check", () => {
      let result = parseSync(app, {
        args: ["--config", "f.json", "--help"],
      });
      assert(result.ok);
      let value = result.value as Program<{ config?: string; watch: boolean }>;
      expect(value.help).toBe(true);
      expect(value.config?.config).toEqual("f.json");
      expect(result.remainder.args).toEqual([]);
    });

    it("detects --help after unknown positional", () => {
      let result = parseSync(app, {
        args: ["./suite", "--help"],
      });
      assert(result.ok);
      let value = result.value as Program<{ config?: string; watch: boolean }>;
      expect(value.help).toBe(true);
      expect(result.remainder.args).toEqual(["./suite"]);
    });

    it("detects -h shorthand in non-first position", () => {
      let result = parseSync(app, {
        args: ["--config", "f.json", "-h"],
      });
      assert(result.ok);
      let value = result.value as Program<{ config?: string; watch: boolean }>;
      expect(value.help).toBe(true);
      expect(value.config?.config).toEqual("f.json");
      expect(result.remainder.args).toEqual([]);
    });

    it("does not detect --help after --", () => {
      let result = parseSync(app, {
        args: ["--", "--help"],
      });
      assert(result.ok);
      let value = result.value as Program<{ config?: string; watch: boolean }>;
      expect(value.help).toBeUndefined();
      expect(result.remainder.args).toEqual(["--", "--help"]);
    });
  });

  describe("version position-insensitivity", () => {
    let app = program({
      name: "myapp",
      version: "1.0.0",
      config: object({
        config: field(type("string | undefined")),
      }),
    });

    it("detects --version first (existing behavior)", () => {
      let result = parseSync(app, {
        args: ["--version"],
      });
      assert(result.ok);
      expect(result.value.version).toEqual("1.0.0");
    });

    it("detects --version in non-first position", () => {
      let result = parseSync(app, {
        args: ["--config", "f.json", "--version"],
      });
      assert(result.ok);
      expect(result.value.version).toEqual("1.0.0");
      expect(result.value.config?.config).toEqual("f.json");
      expect(result.remainder.args).toEqual([]);
    });
  });

  describe("subcommand-targeted help", () => {
    let app = program({
      name: "myapp",
      config: commands({
        run: object({
          suite: field(type("string | undefined"), cli.argument()),
          port: field(type("number"), field.default(3000)),
        }),
      }),
    });

    it("cmd --help (first after command name)", () => {
      let result = parseSync(app, { args: ["run", "--help"] });
      assert(result.ok);
      let cmd = result.value.config as { name: string; help: boolean; text: string };
      expect(cmd.name).toBe("run");
      expect(cmd.help).toBe(true);
      expect(typeof cmd.text).toBe("string");
      expect(result.remainder.args).toEqual([]);
    });

    it("cmd <opts> --help", () => {
      let result = parseSync(app, {
        args: ["run", "--port", "4000", "--help"],
      });
      assert(result.ok);
      let cmd = result.value.config as { name: string; help: boolean; text: string };
      expect(cmd.name).toBe("run");
      expect(cmd.help).toBe(true);
      expect(cmd.text).toMatch(/port/);
      expect(result.remainder.args).toEqual([]);
    });

    it("cmd <positional> --help", () => {
      let result = parseSync(app, {
        args: ["run", "./suite", "--help"],
      });
      assert(result.ok);
      let cmd = result.value.config as { name: string; help: boolean; text: string };
      expect(cmd.name).toBe("run");
      expect(cmd.help).toBe(true);
      expect(result.remainder.args).toEqual([]);
    });
  });

  describe("path comparison", () => {
    let app = program({
      name: "myapp",
      config: commands({
        run: object({
          port: field(type("number"), field.default(3000)),
        }),
      }),
    });

    it("--help at args[0] after command (scan at index 0)", () => {
      let result = parseSync(app, { args: ["run", "--help"] });
      assert(result.ok);
      let cmd = result.value.config as { name: string; help: boolean; text: string };
      expect(cmd.name).toBe("run");
      expect(cmd.help).toBe(true);
      expect(result.remainder.args).toEqual([]);
    });

    it("--help at non-first after command (scan at later index)", () => {
      let result = parseSync(app, {
        args: ["run", "--port", "4000", "--help"],
      });
      assert(result.ok);
      let cmd = result.value.config as { name: string; help: boolean; text: string };
      expect(cmd.name).toBe("run");
      expect(cmd.help).toBe(true);
      // Contextual values available in help text
      expect(cmd.text).toMatch(/port/);
      expect(result.remainder.args).toEqual([]);
    });
  });

  describe("Decision B observation (provisional)", () => {
    let app = program({
      name: "myapp",
      config: commands({
        run: object({
          suite: field(type("string"), cli.argument()),
          port: field(type("number"), field.default(3000)),
        }),
      }),
    });

    it("--help with all required fields present", () => {
      let result = parseSync(app, {
        args: ["run", "./suite", "--help"],
      });
      assert(result.ok);
      let cmd = result.value.config as { name: string; help: boolean; text: string };
      expect(cmd.name).toBe("run");
      expect(cmd.help).toBe(true);
      expect(result.remainder.args).toEqual([]);
    });

    it("--help with required field missing — documents actual behavior", () => {
      // Decision B: command() runs inner parser with args excluding --help.
      // When required field (suite) is missing, inner parser fails, but
      // command() still returns ok: true with help: true.
      let result = parseSync(app, {
        args: ["run", "--help"],
      });
      assert(result.ok);
      let cmd = result.value.config as { name: string; help: boolean; text: string };
      expect(cmd.name).toBe("run");
      expect(cmd.help).toBe(true);
      // help: true is reachable even when required fields are missing,
      // because command() wraps the result regardless of inner parse outcome.
    });
  });

  describe("spec-locking", () => {
    it("--help / -h are position-insensitive within program()", () => {
      let app = program({
        name: "myapp",
        config: object({
          flag: field(type("boolean"), field.default(false)),
        }),
      });

      let first = parseSync(app, { args: ["--help"] });
      assert(first.ok);
      expect(first.value.help).toBe(true);

      let last = parseSync(app, { args: ["--flag", "--help"] });
      assert(last.ok);
      expect(last.value.help).toBe(true);

      let shorthand = parseSync(app, { args: ["--flag", "-h"] });
      assert(shorthand.ok);
      expect(shorthand.value.help).toBe(true);
    });
  });
});
