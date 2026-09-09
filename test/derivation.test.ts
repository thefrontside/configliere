import { describe, it } from "@std/testing/bdd";

describe("derives()", () => {
  describe("checkpoint", () => {
    it.skip("returns Next with the values parsed before the checkpoint", () =>
      undefined);
    it.skip("uses the derivation response type as the exact argument to resume()", () =>
      undefined);
    it.skip("does not call the derivation before resume()", () => undefined);
    it.skip("does not expose a checkpoint until its preceding input is valid", () =>
      undefined);
    it.skip("is terminal within its current route-element pipeline", () =>
      undefined);
  });

  describe("extension", () => {
    it.skip("accepts a derivation that returns a Route-to-Route extension", () =>
      undefined);
    it.skip("applies the extension at the current point instead of replacing the Route", () =>
      undefined);
    it.skip("preserves options and controls accumulated before the checkpoint", () =>
      undefined);
    it.skip("infers the final config from the extension returned by the derivation", () =>
      undefined);
    it.skip("mounts addresses introduced by an extension relative to its current namespace", () =>
      undefined);
  });

  describe("resume()", () => {
    it.skip("continues parsing the unconsumed tokens without changing their indices", () =>
      undefined);
    it.skip("accepts additional value and environment sources for the next increment", () =>
      undefined);
    it.skip("returns the next Increment or Intent instead of the intermediate Route", () =>
      undefined);
    it.skip("can resume into another dynamically introduced checkpoint", () =>
      undefined);
    it.skip("resolves HELP, VERSION, and EXECUTE against the expanded route graph", () =>
      undefined);
    it.skip("keeps asynchronous loading in caller code between parse() and resume()", () =>
      undefined);
  });
});
