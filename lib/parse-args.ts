import type { StandardSchemaV1 } from "@standard-schema/spec";
import { validate } from "./validate.ts";
import { toKebabCase } from "./case.ts";

export type MatchResult = {
  matched: true;
  value: string | boolean;
  remainder: string[];
} | {
  matched: false;
};

export interface Matcher {
  (input: string[], path: string[]): MatchResult;
}

export function matchAll(...matchers: Matcher[]): Matcher {
  return (input, path) => {
    for (let matcher of matchers) {
      let result = matcher(input, path);
      if (result.matched) {
        return result;
      }
    }
    return { matched: false };
  };
}

export function parseLongOption(aliases: string[]): Matcher {
  return (input, path) => {
    let [option, value, ...remainder] = input;

    if (option === optionKey(path) || aliases.includes(option)) {
      return { matched: true, remainder, value };
    } else {
      return { matched: false };
    }
  };
}

export function parseLongOptionEql(): Matcher {
  return (input, path) => {
    let [first, ...remainder] = input;
    let prefix = `${optionKey(path)}=`;
    if (first.startsWith(prefix)) {
      return { matched: true, remainder, value: first.replace(prefix, "") };
    } else {
      return { matched: false };
    }
  };
}

export function parseSwitch(
  schema: StandardSchemaV1,
  aliases: string[],
): Matcher {
  return (input, path) => {
    let [head, ...remainder] = input;
    if (
      isBoolean(schema) && (head === optionKey(path) || aliases.includes(head))
    ) {
      return { matched: true, value: true, remainder };
    } else {
      return { matched: false };
    }
  };
}

export function parseNegativeSwitch(schema: StandardSchemaV1): Matcher {
  return (input, path) => {
    let [head, ...remainder] = input;
    if (isBoolean(schema) && head === negativeSwitchKey(path)) {
      return { matched: true, value: false, remainder };
    } else {
      return { matched: false };
    }
  };
}

export function parseArgument(isArgument: boolean): Matcher {
  return (input) => {
    let [value, ...remainder] = input;
    if (isArgument && !value.startsWith("-")) {
      return { matched: true, value, remainder };
    } else {
      return { matched: false };
    }
  };
}

export function optionKey(path: string[]): string {
  return `--${toKebabCase(path.join(".")).toLowerCase()}`;
}

function negativeSwitchKey(path: string[]): string {
  return `--no-${toKebabCase(path.join(".")).toLowerCase()}`;
}

export function primitive(val: string | boolean): string | number | boolean {
  if (typeof val === "boolean") {
    return val;
  }
  let numval = Number(val);
  if (typeof numval === "number" && !isNaN(numval)) {
    return numval;
  } else {
    return val;
  }
}

export function isBoolean<S extends StandardSchemaV1<unknown>>(
  schema: S,
): boolean {
  return !validate(schema, false).issues && !validate(schema, true).issues;
}
