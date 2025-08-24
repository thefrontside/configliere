import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { assert } from "@std/assert/assert";
import { type } from "arktype";
import { cli, field } from "../lib/field.ts";
import { object } from "../lib/object.ts";
import { sequence } from "../lib/sequence.ts";
import type { Input } from "../lib/types.ts";

describe("sequence", () => {
  it("runs two phases, yielding after the first", () => {
    let phase1 = object({
      config: field(type("string"), cli.argument()),
    });
    let phase2 = object({
      port: field(type("number")),
      host: field(type("string")),
    });

    let parser = sequence(phase1, phase2);
    let input: Input = {
      args: ["myapp.json"],
      envs: [{ name: "env", value: { PORT: "8080" } }],
    };

    let step1 = parser.parse(input);
    assert(step1.ok);
    expect(step1.value).toEqual({ config: "myapp.json" });

    // simulate reading config file, feed enriched input to phase 2
    let enriched: Input = {
      ...input,
      args: [],
      values: [{
        name: "myapp.json",
        value: { port: 3000, host: "localhost" },
      }],
    };
    let step2 = step1.parse(enriched);
    assert(step2.ok);
    expect(step2.value).toEqual({ port: 8080, host: "localhost" });
  });

  it("accumulates data from all phases into a tuple", () => {
    let phase1 = object({
      config: field(type("string"), field.default("default.json")),
    });
    let phase2 = object({
      port: field(type("number"), field.default(3000)),
    });

    let parser = sequence(phase1, phase2);
    let input: Input = {};

    let step1 = parser.parse(input);
    assert(step1.ok);

    let step2 = step1.parse(input);
    assert(step2.ok);

    let [d1, d2] = step2.data as [unknown, unknown];
    expect(d1).toHaveProperty("config");
    expect(d2).toHaveProperty("port");
  });

  it("fails early if a phase fails validation", () => {
    let phase1 = object({
      config: field(type("string")),
    });
    let phase2 = object({
      port: field(type("number")),
    });

    let parser = sequence(phase1, phase2);
    let input: Input = {}; // no config provided, required field

    let step1 = parser.parse(input);
    expect(step1.ok).toBe(false);
  });

  it("later phase values override earlier when both are provided", () => {
    let phase1 = object({
      port: field(type("number")),
    });
    let phase2 = object({
      port: field(type("number")),
    });

    let parser = sequence(phase1, phase2);
    let input1: Input = {
      values: [{ name: "defaults", value: { port: 3000 } }],
    };

    let step1 = parser.parse(input1);
    assert(step1.ok);

    let input2: Input = {
      values: [{ name: "config.json", value: { port: 8080 } }],
    };
    let step2 = step1.parse(input2);
    assert(step2.ok);
    expect(step2.value.port).toBe(8080);
  });

  it("propagates remainder across phases", () => {
    let phase1 = object({
      config: field(type("string"), cli.argument()),
    });
    let phase2 = object({
      port: field(type("number")),
    });

    let parser = sequence(phase1, phase2);
    let input: Input = {
      args: ["app.json", "--port", "9090", "--unknown", "foo"],
    };

    let step1 = parser.parse(input);
    assert(step1.ok);

    // remainder should have the unconsumed args
    expect(step1.remainder.args).toContain("--port");
    expect(step1.remainder.args).toContain("--unknown");

    // feed remainder args to phase 2
    let step2 = step1.parse({ args: step1.remainder.args });
    assert(step2.ok);
    expect(step2.value.port).toBe(9090);
    expect(step2.remainder.args).toContain("--unknown");
  });
});
