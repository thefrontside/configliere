import type {
  AvailableInput,
  ConfigType,
  ParseContext,
  ParseResult,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { format } from "./help.ts";
import { createContext } from "./context.ts";

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

  let parser: Parser<Program<T>, ProgramInfo<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ProgramInfo<T> {
      let rootCtx: ParseContext = { ...ctx, progname: [name] };
      let { available } = rootCtx;

      let helpClaim = findFirst(available, (v) => v === "--help" || v === "-h");
      let versionClaim = versionString
        ? findFirst(available, (v) => v === "--version" || v === "-v")
        : undefined;

      let claims: Token[] = [];
      let postClaim = available;
      if (helpClaim) {
        claims.push({ type: "arg", from: helpClaim.index, to: helpClaim.index });
        postClaim = stripIndex(postClaim, helpClaim.index);
      }
      if (versionClaim) {
        claims.push({ type: "arg", from: versionClaim.index, to: versionClaim.index });
        postClaim = stripIndex(postClaim, versionClaim.index);
      }

      let main = inner.inspect({ ...rootCtx, available: postClaim });

      let value: Program<T> = {
        help: !!helpClaim,
        version: !!versionClaim,
        config: main.result.ok ? main.result.value : (undefined as T),
      };

      let result: ParseResult<Program<T>> = (main.result.ok || helpClaim || versionClaim)
        ? { ok: true, value, remainder: main.remainder }
        : { ok: false, error: main.result.error, remainder: main.remainder };

      return {
        type: "program",
        parser,
        prefix: rootCtx.prefix,
        claims,
        remainder: main.remainder,
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
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}

// --- internal ---

function findFirst(
  av: AvailableInput,
  pred: (v: string) => boolean,
): { index: number; value: string } | undefined {
  return av.args.find((a) => pred(a.value));
}

function stripIndex(av: AvailableInput, index: number): AvailableInput {
  return { ...av, args: av.args.filter((a) => a.index !== index) };
}
