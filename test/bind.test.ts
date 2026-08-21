import { describe, it } from "@std/testing/bdd";

describe("bind()", () => {
  describe("absence", () => {
    it.skip("validates undefined after every source is absent", () => {
      // let result = bindParam(requiredNumber("port"), []);
      //
      // expect(result.result).toMatchObject({
      //   ok: false,
      //   issues: [{ path: ["port"] }],
      // });
    });

    it.skip("lets an optional schema accept an absent value", () => {
      // let result = bindParam(optionalNumber("port"), []);
      //
      // expect(result.result).toEqual({
      //   ok: true,
      //   value: { exists: true, value: undefined },
      //   issues: [],
      // });
    });

    it.skip("lets a defaulting schema produce a value from absence", () => {
      // let result = bindParam(defaultedNumber("port", 9000), []);
      //
      // expect(result.result).toEqual({
      //   ok: true,
      //   value: { exists: true, value: 9000 },
      //   issues: [],
      // });
    });
  });

  describe("candidates", () => {
    it.skip("tries a later decoding after an earlier one fails validation", () => {
      // let result = bindParam(stringOption("digits"), ["--digits", "0012"]);
      //
      // expect(result.result).toEqual({
      //   ok: true,
      //   value: { exists: true, value: "0012" },
      //   issues: [],
      // });
    });
  });

  describe("failed reads", () => {
    it.skip("continues from the remainder of a claimed invalid read", () => {
      // let result = bindParam(numberOption("port"), [
      //   "--port",
      //   "--verbose",
      // ]);
      //
      // expect(result.result).toMatchObject({
      //   ok: false,
      //   issues: [{ message: "--port requires a value" }],
      // });
      // expect(texts(result.rest)).toEqual(["--verbose"]);
    });
  });
});
