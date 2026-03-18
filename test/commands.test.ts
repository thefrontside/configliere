import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { commands, NoCommandMatchError } from "../lib/commands.ts";
import { format } from "../lib/help.ts";
import { parseNotOk, parseOk } from "./test-helpers.ts";

describe("commands", () => {
  let cli_ = commands({
    run: object({
      host: field(type("string"), cli.argument()),
      port: field(type("number"), field.default(3000)),
    }),
    build: object({
      outDir: field(type("string"), field.default("dist")),
    }),
  });

  describe("from cli", () => {
    it("dispatches to the matching command", () => {
      let value = parseOk(cli_, { args: ["run", "localhost"] });
      expect(value).toEqual({
        name: "run",
        config: { host: "localhost", port: 3000 },
      });
    });

    it("dispatches to another command", () => {
      let value = parseOk(cli_, { args: ["build", "--out-dir", "output"] });
      expect(value).toEqual({ name: "build", config: { outDir: "output" } });
    });

    it("fails when no command matches", () => {
      let error = parseNotOk(cli_, { args: ["deploy"] });
      expect(error).toBeInstanceOf(NoCommandMatchError);
      expect((error as NoCommandMatchError).available).toEqual([
        "run",
        "build",
      ]);
    });
  });

  describe("default command", () => {
    let withDefault = commands({
      run: object({
        host: field(type("string"), field.default("localhost")),
        port: field(type("number"), field.default(3000)),
      }),
      build: object({
        outDir: field(type("string"), field.default("dist")),
      }),
    }, { default: "run" });

    it("uses the default when no command keyword matches", () => {
      let value = parseOk(withDefault, { args: ["--port", "9090"] });
      expect(value).toEqual({
        name: "run",
        config: { host: "localhost", port: 9090 },
      });
    });

    it("still dispatches explicit commands normally", () => {
      let value = parseOk(withDefault, {
        args: ["build", "--out-dir", "output"],
      });
      expect(value).toEqual({ name: "build", config: { outDir: "output" } });
    });
  });

  describe("env vars", () => {
    it("passes envs through to the matched command", () => {
      let value = parseOk(cli_, {
        args: ["run", "localhost"],
        envs: [{ name: "env", value: { RUN_PORT: "4000" } }],
      });
      expect(value).toEqual({
        name: "run",
        config: { host: "localhost", port: 4000 },
      });
    });
  });

  describe("aliases", () => {
    let withAliases = commands({
      run: object({
        port: field(type("number"), field.default(3000)),
      }),
      help: {
        aliases: ["--help", "-h"],
        ...object({}),
      },
    });

    it("dispatches to a command via its alias", () => {
      let value = parseOk(withAliases, { args: ["--help"] });
      expect(value).toEqual({ name: "help", config: {} });
    });

    it("dispatches to a command via another alias", () => {
      let value = parseOk(withAliases, { args: ["-h"] });
      expect(value).toEqual({ name: "help", config: {} });
    });

    it("still dispatches by canonical name", () => {
      let value = parseOk(withAliases, { args: ["help"] });
      expect(value).toEqual({ name: "help", config: {} });
    });

    it("accepts metadata-only entries without a parser", () => {
      let withMeta = commands({
        run: object({
          port: field(type("number"), field.default(3000)),
        }),
        help: { description: "Show help", aliases: ["--help", "-h"] },
      });
      let value = parseOk(withMeta, { args: ["--help"] });
      expect(value).toEqual({ name: "help", config: true });
    });

    it("passes remaining args after alias", () => {
      let withArgs = commands({
        help: {
          aliases: ["--help", "-h"],
          ...object({
            cmd: field(type("string | undefined"), cli.argument()),
          }),
        },
      });
      let value = parseOk(withArgs, { args: ["--help", "run"] });
      expect(value).toEqual({ name: "help", config: { cmd: "run" } });
    });
  });

  describe("descriptions", () => {
    let withDescs = commands({
      run: {
        description: "Start the dev server",
        ...object({
          port: field(type("number"), field.default(3000)),
        }),
      },
      build: {
        description: "Build for production",
        ...object({
          outDir: field(type("string"), field.default("dist")),
        }),
      },
    });

    it("includes descriptions in help info", () => {
      let info = withDescs.inspect();
      let run = info.commands.find((c) => c.name === "run")!;
      expect(run.description).toBe("Start the dev server");
      let build = info.commands.find((c) => c.name === "build")!;
      expect(build.description).toBe("Build for production");
    });

    it("renders descriptions in formatted help", () => {
      let text = format(withDescs.inspect(), "myapp");
      expect(text).toMatch(/run\s+Start the dev server/);
      expect(text).toMatch(/build\s+Build for production/);
    });
  });

  describe("aliases in help", () => {
    let withAliases = commands({
      run: object({}),
      help: {
        description: "Show help information",
        aliases: ["--help", "-h"],
        ...object({}),
      },
    });

    it("includes aliases in help info", () => {
      let info = withAliases.inspect();
      let h = info.commands.find((c) => c.name === "help")!;
      expect(h.aliases).toEqual(["--help", "-h"]);
    });

    it("renders aliases in formatted help", () => {
      let text = format(withAliases.inspect(), "myapp");
      expect(text).toMatch(/help \(--help, -h\)\s+Show help information/);
    });
  });

  describe("help", () => {
    it("lists all commands in help output", () => {
      let info = cli_.inspect();
      expect(info.commands).toHaveLength(2);
      expect(info.commands[0].name).toBe("run");
      expect(info.commands[1].name).toBe("build");
    });

    it("includes each command's fields", () => {
      let info = cli_.inspect();
      let run = info.commands.find((c) => c.name === "run")!;
      expect(run.args.map((a) => a.path[0])).toContain("host");
      expect(run.opts.map((o) => o.path[0])).toContain("port");

      let build = info.commands.find((c) => c.name === "build")!;
      expect(build.opts.map((o) => o.path[0])).toContain("outDir");
    });

    it("shows commands in formatted help", () => {
      let text = format(cli_.inspect(), "myapp");
      expect(text).toMatch(/Usage: myapp <COMMAND>/);
      expect(text).toMatch(/Commands:/);
      expect(text).toMatch(/run/);
      expect(text).toMatch(/build/);
    });
  });
});
