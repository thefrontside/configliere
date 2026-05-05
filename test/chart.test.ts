import { expect } from "@std/expect";
import { type } from "arktype";
import { chart } from "../lib/chart.ts";
import { object } from "../lib/object.ts";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";

Deno.test("chart renders a successful parse with input/parse/remainder sections", () => {
  let p = object({ foo: option(type("string")) });
  let input = { args: ["--foo", "bar"] };
  let info = p.inspect(createContext(input));
  let rendered = chart(info, input);
  expect(rendered).toContain("input:");
  expect(rendered).toContain("parse:");
  expect(rendered).toContain("--foo");
  expect(rendered).toContain('"foo"');
  expect(rendered).toContain("remainder:");
});

Deno.test("chart shows ⊘ for parsers with no claims", () => {
  let p = object({ foo: option(type("string")) });
  // provide no args so option claims nothing
  let input = { args: [] };
  let info = p.inspect(createContext(input));
  let rendered = chart(info, input);
  // object and option both have no claims when no args provided
  expect(rendered).toContain("⊘");
});

Deno.test("chart shows args claim with dereferenced tokens", () => {
  let p = object({ foo: option(type("string")) });
  let input = { args: ["--foo", "bar"] };
  let info = p.inspect(createContext(input));
  let rendered = chart(info, input);
  expect(rendered).toContain("args   [0..1]");
  expect(rendered).toContain('"--foo" "bar"');
});
