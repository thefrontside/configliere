import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import assert from "node:assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { commands } from "../lib/commands.ts";
import { step } from "../lib/step.ts";
import { constant } from "../lib/constant.ts";
import type { FieldInfo, Input, ObjectInfo, Parser } from "../lib/types.ts";

describe("step", () => {
  it("runs phase 1 and returns a resume function in the value", () => {
    let parser = step({
      from: (resume) =>
        object({
          config: field(type("string"), cli.argument()),
          resume: constant(resume),
        }),
      to: (_deps: { port: number }) =>
        object({
          port: field(type("number")),
        }),
    });

    let result = parser.parse({ args: ["myapp.json"] });
    assert(result.ok);
    expect(result.value.config).toEqual("myapp.json");
    expect(typeof result.value.resume).toEqual("function");

    let resume = result.value.resume as unknown as (
      deps: { port: number },
    ) => Parser<unknown>;
    let result2 = resume({ port: 8080 }).parse({
      values: [{ name: "config", value: { port: 9090 } }],
    });
    assert(result2.ok);
    expect(result2.value).toEqual({ port: 9090 });
  });

  it("bakes the remainder into the resume parser", () => {
    let parser = step({
      from: (resume) =>
        object({
          config: field(type("string"), cli.argument()),
          resume: constant(resume),
        }),
      to: (_deps: void) =>
        object({
          port: field(type("number")),
        }),
    });

    let input: Input = {
      args: ["myapp.json", "--port", "8080"],
    };

    let result = parser.parse(input);
    assert(result.ok);
    expect(result.value.config).toEqual("myapp.json");

    // remainder (--port 8080) should be baked into the resume parser
    let resume = result.value.resume as unknown as (
      deps: void,
    ) => Parser<unknown>;
    let result2 = resume(undefined).parse({});
    assert(result2.ok);
    expect(result2.value).toEqual({ port: 8080 });
  });

  it("merges enrichment on top of baked remainder", () => {
    let parser = step({
      from: (resume) =>
        object({
          config: field(type("string"), cli.argument()),
          resume: constant(resume),
        }),
      to: (_deps: void) =>
        object({
          port: field(type("number")),
          host: field(type("string")),
        }),
    });

    let input: Input = {
      args: ["myapp.json", "--port", "8080"],
    };

    let result = parser.parse(input);
    assert(result.ok);

    // remainder has --port 8080, enrichment adds host via values
    let resume = result.value.resume as unknown as (
      deps: void,
    ) => Parser<unknown>;
    let result2 = resume(undefined).parse({
      values: [{ name: "config", value: { host: "localhost" } }],
    });
    assert(result2.ok);
    expect(result2.value).toEqual({ port: 8080, host: "localhost" });
  });

  it("fails early if phase 1 fails", () => {
    let parser = step({
      from: (resume) =>
        object({
          config: field(type("string")),
          resume: constant(resume),
        }),
      to: (_deps: void) =>
        object({
          port: field(type("number")),
        }),
    });

    // no config provided, required field
    let result = parser.parse({});
    expect(result.ok).toBe(false);
  });

  it("supports nested steps (3 phases)", () => {
    let parser = step({
      from: (resume) =>
        object({
          config: field(type("string"), field.default("app.json")),
          resume: constant(resume),
        }),
      to: (_plugins: string[]) =>
        step({
          from: (resume) =>
            object({
              host: field(type("string"), field.default("localhost")),
              resume: constant(resume),
            }),
          to: (_runtime: { debug: boolean }) =>
            object({
              port: field(type("number"), field.default(3000)),
            }),
        }),
    });

    let result1 = parser.parse({});
    assert(result1.ok);
    expect(result1.value.config).toEqual("app.json");

    let resume1 = result1.value.resume as unknown as (
      deps: string[],
    ) => Parser<unknown>;
    let result2 = resume1(["plugin-a"]).parse({});
    assert(result2.ok);
    expect((result2.value as Record<string, unknown>).host).toEqual(
      "localhost",
    );

    let resume2 = (result2.value as Record<string, unknown>).resume as (
      deps: { debug: boolean },
    ) => Parser<unknown>;
    let result3 = resume2({ debug: true }).parse({});
    assert(result3.ok);
    expect(result3.value).toEqual({ port: 3000 });
  });

  it("works with commands as the resume target", () => {
    let parser = step({
      from: (resume) =>
        object({
          config: field(type("string"), cli.argument()),
          resume: constant(resume),
        }),
      to: (_deps: void) =>
        commands({
          serve: object({
            port: field(type("number"), field.default(3000)),
          }),
          build: object({
            output: field(type("string"), field.default("dist")),
          }),
        }),
    });

    let result = parser.parse({
      args: ["app.json", "serve", "--port", "9090"],
    });
    assert(result.ok);

    let resume = result.value.resume as unknown as (
      deps: void,
    ) => Parser<unknown>;
    let result2 = resume(undefined).parse({});
    assert(result2.ok);
    expect(result2.value).toEqual({ name: "serve", config: { port: 9090 } });
  });

  it("allows inspect() to see phase 1 fields through a step parser", () => {
    let parser = step({
      from: (resume) =>
        object({
          config: {
            description: "config file path",
            ...field(type("string")),
          },
          resume: constant(resume),
        }),
      to: (_deps: void) =>
        object({
          port: field(type("number")),
        }),
    });

    let info = parser.inspect() as unknown as ObjectInfo<{ config: string }>;
    let config = info.attrs.config as FieldInfo<unknown>;
    expect(config).toBeDefined();
    expect(config.description).toEqual("config file path");
  });
});
