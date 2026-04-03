import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import assert from "node:assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { inject } from "../lib/inject.ts";
import { parseOk, parseSync } from "./test-helpers.ts";

describe("interspersed parsing", () => {
  let bootstrap = object({
    watch: field(type("boolean"), field.default(false)),
    config: field(type("string | undefined")),
  });

  describe("behavior", () => {
    it("parses flags before unknown positional", () => {
      let result = parseSync(bootstrap, {
        args: ["--watch", "--config", "f.json", "./suite"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ watch: true, config: "f.json" });
      expect(result.remainder.args).toEqual(["./suite"]);
    });

    it("parses flags after unknown positional", () => {
      let result = parseSync(bootstrap, {
        args: ["./suite", "--watch", "--config", "f.json"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ watch: true, config: "f.json" });
      expect(result.remainder.args).toEqual(["./suite"]);
    });

    it("parses flags interleaved with multiple unknown positionals", () => {
      let result = parseSync(bootstrap, {
        args: ["./a", "--watch", "./b", "--config", "f.json"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ watch: true, config: "f.json" });
      expect(result.remainder.args).toEqual(["./a", "./b"]);
    });

    it("consumes all tokens when all are recognized", () => {
      let result = parseSync(bootstrap, {
        args: ["--watch", "--config", "f.json"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ watch: true, config: "f.json" });
      expect(result.remainder.args).toEqual([]);
    });

    it("puts all tokens in remainder when none are recognized", () => {
      let result = parseSync(bootstrap, {
        args: ["./a", "./b", "./c"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ watch: false, config: undefined });
      expect(result.remainder.args).toEqual(["./a", "./b", "./c"]);
    });

    it("terminates option processing at --", () => {
      let result = parseSync(bootstrap, {
        args: ["--watch", "--", "--config", "f.json"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ watch: true, config: undefined });
      expect(result.remainder.args).toEqual(["--", "--config", "f.json"]);
    });
  });

  describe("phased parsing", () => {
    it("extracts --config after unknown positional in bootstrap phase", () => {
      let phase1 = object({
        config: field(type("string | undefined")),
      });

      let result = parseSync(phase1, {
        args: ["run", "./suite", "--config", "f.json"],
      });
      assert(result.ok);
      expect(result.value.config).toEqual("f.json");
      expect(result.remainder.args).toEqual(["run", "./suite"]);
    });

    it("phase-2 receives clean remainder and parses successfully", () => {
      let phase1 = inject((_deps: void) =>
        object({
          suite: field(type("string"), cli.argument()),
          port: field(type("number"), field.default(3000)),
        })
      );

      let r1 = phase1.parse({
        args: ["./suite", "--port", "4000"],
      });
      assert(r1.ok);

      let resolved = r1.value();
      let r2 = resolved.parse();
      assert(r2.ok);
      expect(r2.value).toEqual({ suite: "./suite", port: 4000 });
    });
  });

  describe("regression", () => {
    it("handles flags-only input (no positionals)", () => {
      let config = object({
        debug: field(type("boolean"), field.default(false)),
        port: field(type("number"), field.default(3000)),
      });
      let result = parseSync(config, {
        args: ["--debug", "--port", "3000"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ debug: true, port: 3000 });
      expect(result.remainder.args).toEqual([]);
    });

    it("handles boolean switch before unknown positional", () => {
      let config = object({
        debug: field(type("boolean"), field.default(false)),
        entry: field(type("string | undefined"), cli.argument()),
      });
      let result = parseSync(config, {
        args: ["--debug", "./app"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ debug: true, entry: "./app" });
      expect(result.remainder.args).toEqual([]);
    });

    it("handles --flag=value after unknown positional", () => {
      let config = object({
        port: field(type("number"), field.default(3000)),
      });
      let result = parseSync(config, {
        args: ["./unknown", "--port=4000"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ port: 4000 });
      expect(result.remainder.args).toEqual(["./unknown"]);
    });

    it("handles negative switch after unknown positional", () => {
      let config = object({
        debug: field(type("boolean"), field.default(true)),
      });
      let result = parseSync(config, {
        args: ["./unknown", "--no-debug"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ debug: false });
      expect(result.remainder.args).toEqual(["./unknown"]);
    });

    it("collects array fields across unknown positionals", () => {
      let config = object({
        repeat: field(type("string[]"), field.array()),
      });
      let result = parseSync(config, {
        args: ["--repeat", "a", "./unknown", "--repeat", "b"],
      });
      assert(result.ok);
      expect(result.value).toEqual({ repeat: ["a", "b"] });
      expect(result.remainder.args).toEqual(["./unknown"]);
    });

    it("preserves remainder order", () => {
      let config = object({
        debug: field(type("boolean"), field.default(false)),
        port: field(type("number"), field.default(3000)),
      });
      let result = parseSync(config, {
        args: ["./a", "--debug", "./b", "--port", "3000", "./c"],
      });
      assert(result.ok);
      expect(result.remainder.args).toEqual(["./a", "./b", "./c"]);
    });

    it("positional claims first eligible non-dash token", () => {
      let config = object({
        entry: field(type("string | undefined"), cli.argument()),
      });
      let result = parseSync(config, {
        args: ["./a", "./b"],
      });
      assert(result.ok);
      expect(result.value.entry).toEqual("./a");
      expect(result.remainder.args).toEqual(["./b"]);
    });
  });

  describe("spec-locking", () => {
    it("interspersed parsing is default behavior of object()", () => {
      let config = object({
        flag: field(type("boolean"), field.default(false)),
      });
      let result = parseSync(config, {
        args: ["unknown", "--flag"],
      });
      assert(result.ok);
      expect(result.value.flag).toBe(true);
      expect(result.remainder.args).toEqual(["unknown"]);
    });

    it("-- terminates option processing unconditionally", () => {
      let config = object({
        flag: field(type("boolean"), field.default(false)),
      });
      let result = parseSync(config, {
        args: ["--", "--flag"],
      });
      assert(result.ok);
      expect(result.value.flag).toBe(false);
      expect(result.remainder.args).toEqual(["--", "--flag"]);
    });

    it("remainder preserves original token order", () => {
      let config = object({
        x: field(type("boolean"), field.default(false)),
      });
      let result = parseSync(config, {
        args: ["c", "a", "--x", "b"],
      });
      assert(result.ok);
      expect(result.remainder.args).toEqual(["c", "a", "b"]);
    });

    it("positional first-match preserved under wider scope", () => {
      let config = object({
        entry: field(type("string | undefined"), cli.argument()),
        flag: field(type("boolean"), field.default(false)),
      });
      let result = parseSync(config, {
        args: ["first", "--flag", "second"],
      });
      assert(result.ok);
      expect(result.value.entry).toEqual("first");
      expect(result.value.flag).toBe(true);
      expect(result.remainder.args).toEqual(["second"]);
    });
  });
});
