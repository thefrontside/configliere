import { describe, it } from "@std/testing/bdd";

describe("CLI reader", () => {
  it.skip("claims an incomplete option while reporting its missing value", () => {
    // let read = optionReader("--port", ["--port", "--verbose"]);
    //
    // expect(read.result).toMatchObject({
    //   ok: false,
    //   issues: [{ message: "--port requires a value" }],
    // });
    // expect(texts(read.claim.tokens)).toEqual(["--port"]);
    // expect(texts(read.claim.rest)).toEqual(["--verbose"]);
  });
});
