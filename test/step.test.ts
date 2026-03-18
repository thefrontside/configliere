import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import assert from "node:assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { commands } from "../lib/commands.ts";
import { step } from "../lib/step.ts";
import { inspect } from "../lib/help.ts";
import type { Input } from "../lib/types.ts";

describe("step", () => {
  it("runs phase 1 and returns a resume function in the value", () => {
    let parser = step({
      resume: (_deps: { port: number }) =>
        object({
          port: field(type("number")),
        }),
      schema: (resume) =>
        object({
          config: field(type("string"), cli.argument()),
          resume,
        }),
    });

    let result = parser.parse({ args: ["myapp.json"] });
    assert(result.ok);
    expect(result.value.config).toEqual("myapp.json");
    expect(typeof result.value.resume).toEqual("function");

    let parser2 = result.value.resume({ port: 8080 });
    let result2 = parser2.parse({
      values: [{ name: "config", value: { port: 9090 } }],
    });
    assert(result2.ok);
    expect(result2.value.port).toEqual(9090);
  });

  it("bakes the remainder into the resume parser", () => {
    let parser = step({
      resume: (_deps: void) =>
        object({
          port: field(type("number")),
        }),
      schema: (resume) =>
        object({
          config: field(type("string"), cli.argument()),
          resume,
        }),
    });

    let input: Input = {
      args: ["myapp.json", "--port", "8080"],
    };

    let result = parser.parse(input);
    assert(result.ok);
    expect(result.value.config).toEqual("myapp.json");

    // remainder (--port 8080) should be baked into the resume parser
    let parser2 = result.value.resume(undefined);
    let result2 = parser2.parse({});
    assert(result2.ok);
    expect(result2.value.port).toEqual(8080);
  });

  it("merges enrichment on top of baked remainder", () => {
    let parser = step({
      resume: (_deps: void) =>
        object({
          port: field(type("number")),
          host: field(type("string")),
        }),
      schema: (resume) =>
        object({
          config: field(type("string"), cli.argument()),
          resume,
        }),
    });

    let input: Input = {
      args: ["myapp.json", "--port", "8080"],
    };

    let result = parser.parse(input);
    assert(result.ok);

    // remainder has --port 8080, enrichment adds host via values
    let parser2 = result.value.resume(undefined);
    let result2 = parser2.parse({
      values: [{ name: "config", value: { host: "localhost" } }],
    });
    assert(result2.ok);
    expect(result2.value.port).toEqual(8080);
    expect(result2.value.host).toEqual("localhost");
  });

  it("fails early if phase 1 fails", () => {
    let parser = step({
      resume: (_deps: void) =>
        object({
          port: field(type("number")),
        }),
      schema: (resume) =>
        object({
          config: field(type("string")),
          resume,
        }),
    });

    // no config provided, required field
    let result = parser.parse({});
    expect(result.ok).toBe(false);
  });

  it("supports nested steps (3 phases)", () => {
    let parser = step({
      resume: (_plugins: string[]) =>
        step({
          resume: (_runtime: { debug: boolean }) =>
            object({
              port: field(type("number"), field.default(3000)),
            }),
          schema: (resume) =>
            object({
              host: field(type("string"), field.default("localhost")),
              resume,
            }),
        }),
      schema: (resume) =>
        object({
          config: field(type("string"), field.default("app.json")),
          resume,
        }),
    });

    let result1 = parser.parse({});
    assert(result1.ok);
    expect(result1.value.config).toEqual("app.json");

    let result2 = result1.value.resume(["plugin-a"]).parse({});
    assert(result2.ok);
    expect(result2.value.host).toEqual("localhost");

    let result3 = result2.value.resume({ debug: true }).parse({});
    assert(result3.ok);
    expect(result3.value.port).toEqual(3000);
  });

  it("works with commands as the resume target", () => {
    let parser = step({
      resume: (_deps: void) =>
        commands({
          serve: object({
            port: field(type("number"), field.default(3000)),
          }),
          build: object({
            output: field(type("string"), field.default("dist")),
          }),
        }),
      schema: (resume) =>
        object({
          config: field(type("string"), cli.argument()),
          resume,
        }),
    });

    let result = parser.parse({ args: ["app.json", "serve", "--port", "9090"] });
    assert(result.ok);

    let parser2 = result.value.resume(undefined);
    let result2 = parser2.parse({});
    assert(result2.ok);
    expect(result2.value).toEqual({ name: "serve", config: { port: 9090 } });
  });

  it("allows inspect() to see phase 1 fields through a step parser", () => {
    let parser = step({
      resume: (_deps: void) =>
        object({
          port: field(type("number")),
        }),
      schema: (resume) =>
        object({
          config: {
            description: "config file path",
            ...field(type("string")),
          },
          resume,
        }),
    });

    let info = inspect(parser);
    let names = info.opts.map((o) => o.path[0]);
    expect(names).toContain("config");
    expect(info.opts.find((o) => o.path[0] === "config")?.description).toEqual(
      "config file path",
    );
  });
});
