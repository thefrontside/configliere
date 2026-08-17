import { describe, it } from "@std/testing/bdd";

describe("command()", () => {
  describe("construction", () => {
    it.skip("creates an executable Route without an explicit executable() element", () =>
      undefined);
    it.skip("accepts the same elements as route() and applies them from left to right", () =>
      undefined);
    it.skip("preserves the literal command name and exact option model", () =>
      undefined);
    it.skip("does not mutate any Route supplied by an element", () =>
      undefined);
  });

  describe("controls", () => {
    it.skip("makes EXECUTE valid for the command route", () => undefined);
    it.skip("keeps HELP valid for the command route", () => undefined);
    it.skip("makes VERSION valid only when the route has a version", () =>
      undefined);
    it.skip("rejects a control that is not valid for the resolved route", () =>
      undefined);
  });

  describe("nesting", () => {
    it.skip("lets an executable command contain child routes and commands", () =>
      undefined);
    it.skip("executes the parent command when its route is the exact match", () =>
      undefined);
    it.skip("executes a child command when its route is the exact match", () =>
      undefined);
    it.skip("resolves a nested command to its complete route path", () =>
      undefined);
    it.skip("scopes command-local options to the resolved route", () =>
      undefined);
    it.skip("keeps routing tokens distinct from positional arguments", () =>
      undefined);
    it.skip("infers the executed config from global, ancestor, and command-local options", () =>
      undefined);
  });
});
