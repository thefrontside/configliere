import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { commands, NoCommandMatchError } from "../lib/commands.ts";
import type {
  Command,
  CommandsInfo,
  CommandsType,
  ObjectInfo,
} from "../lib/types.ts";
import { format } from "../lib/help.ts";
import { parseNotOk, parseOk } from "./test-helpers.ts";
import { createContext } from "../lib/context.ts";

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
      info: {
        aliases: ["i"],
        ...object({}),
      },
    });

    it("dispatches to a command via its alias", () => {
      let value = parseOk(withAliases, { args: ["i"] });
      expect(value).toEqual({ name: "info", config: {} });
    });

    it("still dispatches by canonical name", () => {
      let value = parseOk(withAliases, { args: ["info"] });
      expect(value).toEqual({ name: "info", config: {} });
    });

    it("accepts metadata-only entries without a parser", () => {
      let withMeta = commands({
        run: object({
          port: field(type("number"), field.default(3000)),
        }),
        info: { description: "Show info", aliases: ["i"] },
      });
      let value = parseOk(withMeta, { args: ["i"] });
      expect(value).toEqual({ name: "info", config: true });
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
      let info = withDescs.inspect(createContext()) as CommandsInfo<
        Command<unknown, string>
      >;
      expect(info.commands["run"].description).toBe("Start the dev server");
      expect(info.commands["build"].description).toBe("Build for production");
    });

    it("renders descriptions in formatted help", () => {
      let text = format(withDescs.inspect(createContext()), "myapp");
      expect(text).toMatch(/run\s+Start the dev server/);
      expect(text).toMatch(/build\s+Build for production/);
    });
  });

  describe("aliases in help", () => {
    let withAliases = commands({
      run: object({}),
      info: {
        description: "Show information",
        aliases: ["i"],
        ...object({}),
      },
    });

    it("includes aliases in help info", () => {
      let info = withAliases.inspect(createContext()) as CommandsInfo<
        Command<unknown, string>
      >;
      expect(info.commands["info"].aliases).toEqual(["i"]);
    });

    it("renders aliases in formatted help", () => {
      let text = format(withAliases.inspect(createContext()), "myapp");
      expect(text).toMatch(/info \(i\)\s+Show information/);
    });
  });

  describe("help", () => {
    it("lists all commands in help output", () => {
      let info = cli_.inspect(createContext()) as CommandsInfo<
        Command<unknown, string>
      >;
      expect(Object.keys(info.commands)).toHaveLength(2);
      expect(info.commands["run"].name).toBe("run");
      expect(info.commands["build"].name).toBe("build");
    });

    it("includes each command's config", () => {
      let info = cli_.inspect(createContext()) as CommandsInfo<
        Command<unknown, string>
      >;
      let runAttrs = (info.commands["run"].config as ObjectInfo<
        { host: string; port: number }
      >).attrs;
      expect(Object.keys(runAttrs)).toContain("host");
      expect(Object.keys(runAttrs)).toContain("port");

      let buildAttrs =
        (info.commands["build"].config as ObjectInfo<{ outDir: string }>).attrs;
      expect(Object.keys(buildAttrs)).toContain("outDir");
    });

    it("shows commands in formatted help", () => {
      let text = format(cli_.inspect(createContext()), "myapp");
      expect(text).toMatch(/Usage: myapp <COMMAND>/);
      expect(text).toMatch(/Commands:/);
      expect(text).toMatch(/run/);
      expect(text).toMatch(/build/);
    });
  });

  describe("--help flag", () => {
    it("intercepts --help after a command name", () => {
      let value = parseOk(cli_, {
        args: ["run", "--help"],
      }) as CommandsType<typeof cli_>;
      expect(value.name).toBe("run");
      expect(value.help).toBe(true);
      if (value.help) {
        expect(typeof value.text).toBe("string");
        expect(value.text).toMatch(/host/);
        expect(value.text).toMatch(/port/);
      }
    });

    it("intercepts -h after a command name", () => {
      let value = parseOk(cli_, {
        args: ["build", "-h"],
      }) as CommandsType<typeof cli_>;
      expect(value.name).toBe("build");
      expect(value.help).toBe(true);
      if (value.help) {
        expect(typeof value.text).toBe("string");
        expect(value.text).toMatch(/out-dir/);
      }
    });

    it("shows nested command help", () => {
      let nested = commands({
        outer: commands({
          inner: object({
            flag: field(type("boolean"), field.default(false)),
          }),
        }),
      });
      let value = parseOk(nested, {
        args: ["outer", "--help"],
      }) as CommandsType<typeof nested>;
      expect(value.name).toBe("outer");
      expect(value.help).toBe(true);
      if (value.help) {
        expect(value.text).toMatch(/inner/);
      }
    });

    it("routes --help to nested inner command", () => {
      let nested = commands({
        outer: commands({
          inner: object({
            flag: field(type("boolean"), field.default(false)),
          }),
        }),
      });
      let result = parseOk(nested, {
        args: ["outer", "inner", "--help"],
      });
      expect(result.name).toBe("outer");
      let inner = (result as unknown as { config: { name: string; help: boolean; text: string } }).config;
      expect(inner.name).toBe("inner");
      expect(inner.help).toBe(true);
      expect(inner.text).toMatch(/flag/);
    });

    it("routes non-first --help to nested inner command", () => {
      let nested = commands({
        outer: commands({
          inner: object({
            port: field(type("number"), field.default(3000)),
          }),
        }),
      });
      let result = parseOk(nested, {
        args: ["outer", "inner", "--port", "4000", "--help"],
      });
      expect(result.name).toBe("outer");
      let inner = (result as unknown as { config: { name: string; help: boolean; text: string } }).config;
      expect(inner.name).toBe("inner");
      expect(inner.help).toBe(true);
      expect(inner.text).toMatch(/port/);
    });
  });
});
