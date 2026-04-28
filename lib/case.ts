type Upper =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";

type Lower = Lowercase<Upper>;

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type Separator = "_" | "-" | "." | " ";

type Kind<C extends string> = C extends Separator ? "sep"
  : C extends Upper ? "upper"
  : C extends Lower ? "lower"
  : C extends Digit ? "digit"
  : "other";

type Push<T extends string[], S extends string> = S extends "" ? T : [...T, S];

type HasMany<S extends string> = S extends `${infer _}${infer Rest}`
  ? Rest extends "" ? false : true
  : false;

type NextKind<S extends string> = S extends `${infer Head}${string}`
  ? Kind<Head>
  : "end";

type ShouldBreak<
  Current extends string,
  Prev extends "start" | "sep" | "upper" | "lower" | "digit" | "other",
  CurrentKind extends "upper" | "lower" | "digit" | "other",
  Next extends "upper" | "lower" | "digit" | "sep" | "other" | "end",
> = Current extends "" ? false
  : CurrentKind extends "upper" ? Prev extends "lower" | "digit" ? true
    : Prev extends "upper" ? Next extends "lower" ? HasMany<Current>
      : false
    : false
  : CurrentKind extends "lower" ? Prev extends "digit" ? true
    : Prev extends "upper" ? HasMany<Current>
    : false
  : CurrentKind extends "digit" ? Prev extends "lower" ? true : false
  : false;

type SnakeWords<
  S extends string,
  Prev extends "start" | "sep" | "upper" | "lower" | "digit" | "other" =
    "start",
  Current extends string = "",
  Words extends string[] = [],
> = S extends `${infer Head}${infer Tail}`
  ? Kind<Head> extends "sep" ? SnakeWords<Tail, "sep", "", Push<Words, Current>>
  : Kind<Head> extends infer CurrentKind
    ? CurrentKind extends "upper" | "lower" | "digit" | "other"
      ? ShouldBreak<Current, Prev, CurrentKind, NextKind<Tail>> extends true
        ? SnakeWords<
          Tail,
          CurrentKind,
          `${Lowercase<Head>}`,
          Push<Words, Current>
        >
      : SnakeWords<
        Tail,
        CurrentKind,
        `${Current}${Lowercase<Head>}`,
        Words
      >
    : never
  : never
  : Push<Words, Current>;

type JoinWithUnderscores<T extends string[]> = T extends
  [infer Head, ...infer Tail]
  ? Head extends string
    ? Tail extends string[]
      ? Tail["length"] extends 0 ? Head : `${Head}_${JoinWithUnderscores<Tail>}`
    : never
  : never
  : "";

type SnakeCase<S extends string> = JoinWithUnderscores<SnakeWords<S>>;

type ReplaceUnderscores<S extends string> = S extends
  `${infer Head}_${infer Tail}` ? `${Head}-${ReplaceUnderscores<Tail>}`
  : S;

export type EnvCase<S extends string> = Uppercase<SnakeCase<S>>;

export type KebabCase<S extends string> = ReplaceUnderscores<SnakeCase<S>>;

export function toKebabCase<S extends string>(str: S): KebabCase<S> {
  return normalize(str).replaceAll("_", "-") as KebabCase<S>;
}

export function toEnvCase<S extends string>(str: S): EnvCase<S> {
  return normalize(str).toUpperCase() as EnvCase<S>;
}

export function toOptionPath(path: string[]): string {
  return path.map((part) => toKebabCase(part)).join(".").toLowerCase();
}

export function toEnvKey(path: string[]): string {
  return path.map((part) => toEnvCase(part)).join("_");
}

function normalize(str: string): string {
  let words: string[] = [];
  let current = "";
  let prev: "start" | "sep" | "upper" | "lower" | "digit" | "other" = "start";

  for (let index = 0; index < str.length; index += 1) {
    let char = str[index];
    let kind = classify(char);

    if (kind === "sep") {
      if (current !== "") {
        words.push(current);
        current = "";
      }
      prev = "sep";
      continue;
    }

    if (shouldBreak(current, prev, kind, classify(str[index + 1] ?? ""))) {
      words.push(current);
      current = char.toLowerCase();
    } else {
      current += char.toLowerCase();
    }

    prev = kind;
  }

  if (current !== "") {
    words.push(current);
  }

  return words.join("_");
}

function classify(char: string): "sep" | "upper" | "lower" | "digit" | "other" {
  if (char === "_" || char === "-" || char === "." || char === " ") {
    return "sep";
  }
  if (char >= "A" && char <= "Z") {
    return "upper";
  }
  if (char >= "a" && char <= "z") {
    return "lower";
  }
  if (char >= "0" && char <= "9") {
    return "digit";
  }
  return "other";
}

function shouldBreak(
  current: string,
  prev: "start" | "sep" | "upper" | "lower" | "digit" | "other",
  kind: "upper" | "lower" | "digit" | "other",
  next: "sep" | "upper" | "lower" | "digit" | "other",
): boolean {
  if (current === "") {
    return false;
  }

  switch (kind) {
    case "upper":
      if (prev === "lower" || prev === "digit") {
        return true;
      }
      return prev === "upper" && next === "lower" && current.length > 1;
    case "lower":
      if (prev === "digit") {
        return true;
      }
      return prev === "upper" && current.length > 1;
    case "digit":
      return prev === "lower";
    default:
      return false;
  }
}
