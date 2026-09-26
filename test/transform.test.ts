import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { z } from "zod";
import {
  checkpoint,
  command,
  type ModelOf,
  name,
  option,
  parse,
  schema,
  transform,
} from "../mod.ts";

const endpoint = z.object({
  port: z.number().optional(),
  domain: z.string().optional(),
  protocol: z.enum(["http", "https"]).optional(),
}).transform((input) => {
  let protocol = input.protocol ?? "https";
  let port = input.port ?? (protocol === "https" ? 443 : 80);

  return {
    port,
    domain: input.domain ?? "localhost",
    protocol,
  };
});

describe("transform()", () => {
  it("replaces the current phase model with a schema output", () => {
    let cooked = z.object({ raw: z.string() }).transform(({ raw }) => ({
      value: raw.toUpperCase(),
    }));
    let app = command(
      name("replace"),
      option(name("raw"), schema(z.string())),
      transform(cooked),
      option(name("audience"), schema(z.string())),
    );

    expectType<
      Equal<ModelOf<typeof app>, { value: string; audience: string }>
    >(true);

    let result = parse(app, {
      argv: ["--raw", "hello", "--audience", "api"],
    });

    expect(result).toMatchObject({ ok: true, method: "execute" });
    if (!("model" in result)) return;
    expect(result.model).toEqual({ value: "HELLO", audience: "api" });
  });

  it("validates the current phase model with the schema", () => {
    let positive = z.object({
      port: z.number().int().min(1).max(65_535),
    });
    let app = command(
      name("validated"),
      option(name("port"), schema(z.number())),
      transform(positive),
    );

    let result = parse(app, { argv: ["--port", "0"] });

    expect(result).toMatchObject({
      ok: false,
      code: "unprocessable-content",
      issues: [{ path: ["port"] }],
    });
  });

  it("transforms a phase after a checkpoint without exposing its bindings", () => {
    let app = command(
      name("auth0"),
      option(name("config"), schema(z.string())),
      checkpoint(),
      option(name("port"), schema(z.number().optional())),
      option(name("domain"), schema(z.string().optional())),
      option(
        name("protocol"),
        schema(z.enum(["http", "https"]).optional()),
      ),
      transform(endpoint),
      option(name("audience"), schema(z.string())),
    );

    expectType<
      Equal<
        ModelOf<typeof app>,
        {
          config: string;
          port: number;
          domain: string;
          protocol: "http" | "https";
          audience: string;
        }
      >
    >(true);

    let first = parse(app, {
      argv: [
        "--config",
        "auth0.json",
        "--domain",
        "tenant.example.com",
        "--audience",
        "https://example.com/api",
      ],
    });

    expect(first).toMatchObject({
      ok: true,
      route: "/",
      model: { config: "auth0.json" },
    });
    expect("resume" in first).toBe(true);
    if (!("resume" in first)) return;

    let result = first.resume({ ok: true, value: [] });

    expect(result).toMatchObject({ ok: true, method: "execute" });
    if (!("model" in result)) return;
    expect(result.model).toEqual({
      config: "auth0.json",
      port: 443,
      domain: "tenant.example.com",
      protocol: "https",
      audience: "https://example.com/api",
    });
  });

  it("rejects a schema incompatible with the active phase model", () => {
    check(() => {
      command(
        name("incompatible"),
        // @ts-expect-error the phase model lacks the required port.
        transform(z.object({ port: z.number() })),
      );
    });
  });
});

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends
  (<T>() => T extends R ? 1 : 2)
  ? (<T>() => T extends R ? 1 : 2) extends (<T>() => T extends L ? 1 : 2) ? true
  : false
  : false;

function expectType<T extends true>(_value: T): void {
  // Compile-time assertion.
}

function check(_body: () => void): void {
  // Compile the callback without executing it.
}
