import type {
  AvailableInput,
  ConfigType,
  ParseContext,
  ParseResult,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { defineParser } from "./parser.ts";

export interface Program<T> {
  help: boolean;
  version: boolean;
  config: T;
}

export type ProgramType<P extends Parser<Program<unknown>>> =
  ConfigType<P> extends Program<infer T> ? T : never;

export interface ProgramInfo<T> extends ParserInfo<Program<T>> {
  type: "program";
  name: string;
  versionString?: string;
  main: ParserInfo<T>;
}

export function program<T>(
  opts: {
    name: string;
    version?: string;
    config: Parser<T>;
  },
): Parser<Program<T>, ProgramInfo<T>> {
  let { name } = opts;
  let versionString = opts.version;
  let inner = opts.config;

  return defineParser<Program<T>, ProgramInfo<T>>({
    type: "program",
    claim(ctx) {
      let rootCtx: ParseContext = { ...ctx, progname: [name] };
      let { available } = rootCtx;

      let h = findHelp(available);
      let v = versionString ? findVersion(available) : undefined;

      let claims: Token[] = [];
      let post = available;
      if (h) {
        claims.push({ type: "arg", from: h.index, to: h.index });
        post = stripIndex(post, h.index);
      }
      if (v) {
        claims.push({ type: "arg", from: v.index, to: v.index });
        post = stripIndex(post, v.index);
      }

      claims.push(...inner.claim({ ...rootCtx, available: post }));
      return claims;
    },
    parse(ctx, _claims, remainder) {
      let rootCtx: ParseContext = { ...ctx, progname: [name] };
      let { available } = rootCtx;

      let h = findHelp(available);
      let v = versionString ? findVersion(available) : undefined;

      let post = available;
      if (h) post = stripIndex(post, h.index);
      if (v) post = stripIndex(post, v.index);

      let main = inner.inspect({ ...rootCtx, available: post });

      let value: Program<T> = {
        help: !!h,
        version: !!v,
        config: main.result.ok ? main.result.value : (undefined as T),
      };

      let result: ParseResult<Program<T>> = (main.result.ok || h || v)
        ? { ok: true, value, remainder }
        : { ok: false, error: main.result.error, remainder };

      return {
        result,
        name,
        versionString,
        main,
        help: {
          progname: [name],
          args: main.help.args,
          opts: [...main.help.opts],
          commands: main.help.commands,
        },
      };
    },
  });
}

// --- internal ---

function findHelp(av: AvailableInput): { index: number; value: string } | undefined {
  return av.args.find((a) => a.value === "--help" || a.value === "-h");
}

function findVersion(av: AvailableInput): { index: number; value: string } | undefined {
  return av.args.find((a) => a.value === "--version" || a.value === "-v");
}

function stripIndex(av: AvailableInput, index: number): AvailableInput {
  return { ...av, args: av.args.filter((a) => a.index !== index) };
}
