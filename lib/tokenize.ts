export interface Token<T extends string> {
  type: T;
  index: number;
  text: string;
}
export type AnyToken =
  | Setter
  | Flag
  | Separator
  | Literal;

export interface Setter extends Token<"setter"> {
  nameText: string;
  valueText: string;
}

export interface Flag extends Token<"flag"> {
  flagText: string;
  flagType: "short" | "long";
}

export interface Separator extends Token<"separator"> {
  readonly text: "--";
}

export type Literal = Token<"literal">;

export function tokenize(argv: string[]): readonly AnyToken[] {
  let quote = false;
  let tokens: AnyToken[] = [];

  for (let i = 0; i < argv.length; i++) {
    let index = i;
    let text = argv[i];
    if (quote) {
      tokens.push({ type: "literal", index, text });
      continue;
    }
    if (text === "--") {
      tokens.push({ type: "separator", index, text });
      quote = true;
      continue;
    }
    let matchSetter = setterMatch.exec(text);
    if (matchSetter?.groups) {
      let { nameText, valueText } = matchSetter.groups;
      tokens.push({ type: "setter", index, text, nameText, valueText });
      continue;
    }
    let matchFlag = flagMatch.exec(text);
    if (matchFlag?.groups) {
      let { prefix, flagText } = matchFlag.groups;
      tokens.push({
        type: "flag",
        index,
        text,
        flagText,
        flagType: prefix === "-" ? "short" : "long",
      });
      continue;
    }
    tokens.push({ type: "literal", index, text });
  }
  return tokens;
}

// deno-lint-ignore no-invalid-regexp
const flagMatch = /^(?<prefix>--?)(?<flagText>[^-=\s][^=\s]*)$/;

// deno-lint-ignore no-invalid-regexp
const setterMatch = /^--(?<nameText>[^-=\s][^=\s]*)=(?<valueText>[\s\S]*)$/;
