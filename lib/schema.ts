import type { StandardSchemaV1 } from "@standard-schema/spec";

export const optionalBoolean: StandardSchemaV1<boolean | undefined> = {
  "~standard": {
    version: 1,
    vendor: "configliere",
    validate(value): StandardSchemaV1.Result<boolean | undefined> {
      if (value === undefined || value === true || value === false) {
        return { value };
      }
      return {
        issues: [{ message: `expected boolean, got ${typeof value}` }],
      };
    },
  },
};

export const string: StandardSchemaV1<string> = {
  "~standard": {
    version: 1,
    vendor: "configliere",
    validate(value) {
      if (typeof value === "string") return { value };
      return { issues: [{ message: "expected a command name" }] };
    },
  },
};
