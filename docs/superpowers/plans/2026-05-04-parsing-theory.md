# Parsing Theory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing parser model with the layered claim protocol from the parsing theory spec — globally-addressable Tokens emitted as claim outputs, immutable input with stable addresses, `Prefix`-driven channel scoping, and a primitives surface of `option`/`argument`/`constant`/`many`/`passthrough` + `object`/`commands`/`program`/`inject`.

**Architecture:** One coherent rewrite. New types replace the existing `ParseContext`/`ParserInfo` foundation; new leaf primitives replace `field()`; existing compounds (`object`, `commands`, `program`) are rewritten to use the claim protocol. Migration is phased with commits at phase boundaries; tests pass at each commit. The spec at `docs/superpowers/specs/2026-05-04-parsing-theory-design.md` is the source of truth.

**Tech Stack:** Deno + TypeScript. `@standard-schema/spec` for schemas. `ts-case-convert` for snake_case. Existing test runner: `deno test`. Lint: `deno lint`. Type check: `deno check`.

**Phases (commits at boundaries):**

1. Foundation — new types, `AvailableInput`, ParseContext rewrite, adapter.
2. Leaves — `option`, `argument`, `constant`, `passthrough`, `many`.
3. `object` rewrite — strict-sequential orchestration over claim protocol.
4. `commands` rewrite — tuple-array API, scan-past-non-positionals, args-path reset.
5. `program` rewrite — wrapping pattern, `--help` / `--version`.
6. `inject` adjustments + remove `sequence()`.
7. `ParserInfo.claims` + parse chart renderer.
8. Migration — delete `field.ts` and `parse-args.ts`, update `mod.ts` exports, update existing tests/examples.

---

## Phase 1: Foundation

**Goal:** Land the new core types (`Token`, `Prefix`, `AvailableInput`, `ParseContext`, `Input`) and the adapter that produces an `AvailableInput` from a raw `Input`. Existing parsers keep compiling against transitional shims; new parsers are not yet introduced.

**Files in this phase:**
- Modify: `lib/types.ts` — add `Token`, `Prefix`, `AvailableInput`; rewrite `ParseContext`.
- Modify: `lib/context.ts` — rewrite `createContext` to produce new shape.
- Create: `lib/available.ts` — pure helpers for working with `AvailableInput` (subtract claims, materialize remainder).
- Create: `test/available.test.ts` — tests for the helpers.

### Task 1.1: Define new core types in `lib/types.ts`

**Files:**
- Modify: `lib/types.ts:1-136`

- [ ] **Step 1: Add `Token` type at the top of the public types**

Open `lib/types.ts`. Above the existing `ParseResult` type, add:

```ts
export type Token =
  | { type: "arg"; from: number; to: number }
  | { type: "value"; source: string; path: string[] }
  | { type: "env"; source: string; name: string };
```

- [ ] **Step 2: Add `Prefix` type below `Token`**

```ts
export interface Prefix {
  values: string[];
  envs: string;
  args: string[];
}
```

- [ ] **Step 3: Add `AvailableInput` type below `Prefix`**

```ts
export interface AvailableInput {
  args: { index: number; value: string }[];
  values: { source: string; value: unknown }[];
  envs: { source: string; value: Record<string, string> }[];
}
```

- [ ] **Step 4: Rewrite `ParseContext`**

Replace the existing `ParseContext` interface (currently at `lib/types.ts:17-24`) with:

```ts
export interface ParseContext {
  progname: string[];
  prefix: Prefix;
  input: Input;
  available: AvailableInput;
}
```

The `path: string[]`, `commands: Record<…>`, `args: string[]`, `values: …`, `envs: …` fields are **removed**. They become either part of `prefix`, derivable from `input`, or no longer the public protocol's concern.

- [ ] **Step 5: Update `ParserInfo`, `Done`, `Fail`**

Replace `ParserInfo`, `Done`, `Fail` interfaces (lines 5-15 and 67-73 in original) with:

```ts
export interface Done<T> {
  ok: true;
  value: T;
  remainder: AvailableInput;
}

export interface Fail {
  ok: false;
  error: Error;
  remainder: AvailableInput;
}

export interface ParserInfo<T> {
  type: string;
  parser: Parser<T>;
  prefix: Prefix;
  claims: Token[];
  remainder: AvailableInput;
  result: ParseResult<T>;
  help: HelpInfo;
}
```

This is the new shape every parser produces. Note `remainder: AvailableInput` (not `Input`), `claims: Token[]` (new), `prefix: Prefix` (new), and `path: string[]` removed.

- [ ] **Step 6: Run type check**

Run: `deno check lib/types.ts`
Expected: errors elsewhere in the codebase (existing parsers reference removed `ctx.path`, `ctx.args`, etc.). Type errors are expected at this point — they will be resolved as parsers are migrated. The file `lib/types.ts` itself should type-check cleanly.

### Task 1.2: Rewrite `lib/context.ts` to produce new shape

**Files:**
- Modify: `lib/context.ts:1-12`

- [ ] **Step 1: Replace `createContext` body**

Open `lib/context.ts` and replace its entire contents with:

```ts
import type { AvailableInput, Input, ParseContext, Prefix } from "./types.ts";

export function createContext(input: Input = {}): ParseContext {
  let normalized: Input = {
    args: input.args ?? [],
    values: input.values ?? [],
    envs: input.envs ?? [],
  };
  return {
    progname: [],
    prefix: emptyPrefix(),
    input: normalized,
    available: toAvailable(normalized),
  };
}

export function emptyPrefix(): Prefix {
  return { values: [], envs: "", args: [] };
}

export function toAvailable(input: Input): AvailableInput {
  return {
    args: (input.args ?? []).map((value, index) => ({ index, value })),
    values: (input.values ?? []).map((entry) => ({
      source: entry.name,
      value: entry.value,
    })),
    envs: (input.envs ?? []).map((entry) => ({
      source: entry.name,
      value: entry.value,
    })),
  };
}
```

- [ ] **Step 2: Run type check**

Run: `deno check lib/context.ts`
Expected: no errors in `lib/context.ts`.

### Task 1.3: Add `Input.values` and `Input.envs` types compatibility

**Files:**
- Modify: `lib/types.ts` (the `Input` interface around lines 48-58 in original)

- [ ] **Step 1: Verify `Input` shape**

Confirm `Input` in `lib/types.ts` still has:

```ts
export interface Input {
  values?: { name: string; value: unknown }[];
  envs?: { name: string; value: Record<string, string> }[];
  args?: string[];
}
```

This is the user-facing input shape. It is the input to `createContext`; not changed.

### Task 1.4: Create `lib/available.ts` with args-claim helpers

**Files:**
- Create: `lib/available.ts`

The helpers in this file deal only with **args** subtraction. Values and envs entries remain in `available` even after parsers consume specific paths/names, because multiple parsers may read non-overlapping paths from the same source. Per-source consumption is recorded in `claims` for audit, but the source entry itself stays available for siblings.

- [ ] **Step 1: Write the file**

Create `lib/available.ts` with:

```ts
import type { AvailableInput, Token } from "./types.ts";

export function emptyAvailable(): AvailableInput {
  return { args: [], values: [], envs: [] };
}

export function subtractArgs(
  available: AvailableInput,
  claims: Token[],
): AvailableInput {
  let argIndices = new Set<number>();
  for (let token of claims) {
    if (token.type === "arg") {
      for (let i = token.from; i <= token.to; i++) argIndices.add(i);
    }
  }
  if (argIndices.size === 0) return available;
  return {
    ...available,
    args: available.args.filter((a) => !argIndices.has(a.index)),
  };
}

export function isEmpty(av: AvailableInput): boolean {
  return av.args.length === 0 && av.values.length === 0 && av.envs.length === 0;
}
```

- [ ] **Step 2: Type check**

Run: `deno check lib/available.ts`
Expected: clean.

### Task 1.5: Test `lib/available.ts` helpers

**Files:**
- Create: `test/available.test.ts`

- [ ] **Step 1: Write tests**

Create `test/available.test.ts`:

```ts
import { assertEquals } from "@std/assert";
import { subtractArgs, emptyAvailable, isEmpty } from "../lib/available.ts";
import type { AvailableInput, Token } from "../lib/types.ts";

Deno.test("subtractArgs removes claimed args by index", () => {
  let av: AvailableInput = {
    args: [{ index: 0, value: "a" }, { index: 1, value: "b" }, { index: 2, value: "c" }],
    values: [],
    envs: [],
  };
  let claims: Token[] = [{ type: "arg", from: 1, to: 1 }];
  let result = subtractArgs(av, claims);
  assertEquals(result.args, [{ index: 0, value: "a" }, { index: 2, value: "c" }]);
});

Deno.test("subtractArgs removes range of args", () => {
  let av: AvailableInput = {
    args: [{ index: 0, value: "a" }, { index: 1, value: "b" }, { index: 2, value: "c" }],
    values: [],
    envs: [],
  };
  let claims: Token[] = [{ type: "arg", from: 0, to: 1 }];
  let result = subtractArgs(av, claims);
  assertEquals(result.args, [{ index: 2, value: "c" }]);
});

Deno.test("subtractArgs ignores non-arg tokens", () => {
  let av: AvailableInput = {
    args: [{ index: 0, value: "a" }],
    values: [{ source: "config", value: { x: 1 } }],
    envs: [],
  };
  let claims: Token[] = [{ type: "value", source: "config", path: ["x"] }];
  let result = subtractArgs(av, claims);
  assertEquals(result.args, [{ index: 0, value: "a" }]);
  assertEquals(result.values, av.values);
});

Deno.test("emptyAvailable is empty", () => {
  assertEquals(isEmpty(emptyAvailable()), true);
});
```

- [ ] **Step 2: Run tests**

Run: `deno test test/available.test.ts`
Expected: 4 tests pass.

### Phase 1 commit

- [ ] **Commit foundation work**

```bash
git add lib/types.ts lib/context.ts lib/available.ts test/available.test.ts
git commit -m "♻️ introduce Token, Prefix, AvailableInput, new ParseContext"
```

Note: existing parsers in `lib/field.ts`, `lib/object.ts`, etc. still reference removed `ParseContext` fields. They will be rewritten in subsequent phases. The codebase will not type-check end-to-end until Phase 8.

---

## Phase 2: Leaf Primitives

**Goal:** Land the new leaf primitives (`option`, `argument`, `constant`, `many`, `passthrough`) with full claim grammars and tests. They consume `ParseContext.available` and emit `Token[]` outputs.

**Files in this phase:**
- Create: `lib/option.ts` — named-value leaf.
- Create: `lib/argument.ts` — positional leaf, CLI-only.
- Modify: `lib/constant.ts` — adapt to new types.
- Create: `lib/many.ts` — args-only repeat modifier.
- Create: `lib/passthrough.ts` — `--`-and-rest leaf.
- Create: `lib/source.ts` — shared source-priority resolution helper.
- Tests for each.

### Task 2.1: Define `Source<T>` and resolution helper in `lib/source.ts`

**Files:**
- Create: `lib/source.ts`

- [ ] **Step 1: Write the file**

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { validate } from "./validate.ts";

export type Source<T> = {
  sourceType: "none" | "default" | "value" | "env" | "cli";
  sourceName: string;
  value: T;
  issues?: readonly StandardSchemaV1.Issue[];
};

export function resolve<T>(sources: Source<T>[]): {
  winner: Source<T>;
} {
  let valid = sources.filter((s) => !s.issues);
  return { winner: valid[valid.length - 1] ?? sources[sources.length - 1] };
}

export function noneSource<T>(schema: StandardSchemaV1<T>): Source<T> {
  let none = validate(schema, undefined);
  return {
    sourceType: "none",
    sourceName: "none",
    value: (none.issues ? undefined : none.value) as T,
    issues: none.issues,
  };
}

export function defaultSource<T>(
  schema: StandardSchemaV1<T>,
  value: unknown,
): Source<T> {
  let { issues } = validate(schema, value);
  return {
    sourceType: "default",
    sourceName: "default",
    value: value as T,
    issues,
  };
}
```

- [ ] **Step 2: Type check**

Run: `deno check lib/source.ts`
Expected: clean.

### Task 2.2: Implement `lib/option.ts`

**Files:**
- Create: `lib/option.ts`

- [ ] **Step 1: Write `option` skeleton**

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  AvailableInput,
  ParseContext,
  ParseResult,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { validate, ValidationError } from "./validate.ts";
import { isBoolean } from "./schema.ts";
import { toSnake, toKebabCase } from "./case.ts";
import { createContext } from "./context.ts";
import { defaultSource, noneSource, resolve, Source } from "./source.ts";
import { format } from "./help.ts";

export interface OptionInfo<T> extends ParserInfo<T> {
  type: "option";
  schema: StandardSchemaV1<T>;
  required: boolean;
  boolean: boolean;
  default?: unknown;
  aliases?: string[];
  description?: string;
  source: Source<T>;
  sources: Source<T>[];
}

export interface OptionOpts<T> {
  default?: T;
  aliases?: string[];
  description?: string;
}

export function option<T>(
  schema: StandardSchemaV1<T>,
  opts: OptionOpts<T> = {},
): Parser<T, OptionInfo<T>> {
  let parser: Parser<T, OptionInfo<T>> = {
    description: opts.description,
    aliases: opts.aliases,
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): OptionInfo<T> {
      return inspectOption(parser, schema, opts, ctx);
    },
    help(input, ctx) {
      let info = parser.inspect(ctx ?? createContext(input));
      return format(info, info.prefix.args.join("."));
    },
  };
  return parser;
}

// --- internal ---

function inspectOption<T>(
  parser: Parser<T, OptionInfo<T>>,
  schema: StandardSchemaV1<T>,
  opts: OptionOpts<T>,
  ctx: ParseContext,
): OptionInfo<T> {
  let { prefix, available } = ctx;
  let claims: Token[] = [];
  let sources: Source<T>[] = [noneSource(schema)];
  if (opts.default !== undefined) {
    sources.push(defaultSource(schema, opts.default));
  }

  // values: one claim per source if path matches
  for (let entry of available.values) {
    let value = readPath(entry.value, prefix.values);
    if (value === undefined) continue;
    claims.push({ type: "value", source: entry.source, path: prefix.values });
    let { issues, value: validated } = validate(schema, value);
    sources.push({
      sourceType: "value",
      sourceName: entry.source,
      value: (issues ? value : validated) as T,
      issues,
    });
  }

  // envs: one claim per source if name matches
  let envName = prefix.envs + prefix.args.map((s) => toSnake(s).toUpperCase()).join("_");
  for (let entry of available.envs) {
    let raw = entry.value[envName];
    if (raw === undefined) continue;
    claims.push({ type: "env", source: entry.source, name: envName });
    let coerced = coerceEnvValue(schema, raw);
    let { issues, value: validated } = validate(schema, coerced);
    sources.push({
      sourceType: "env",
      sourceName: entry.source,
      value: (issues ? coerced : validated) as T,
      issues,
    });
  }

  // args: first match
  let argMatch = matchArgs(schema, prefix, opts.aliases ?? [], available);
  if (argMatch) {
    claims.push(argMatch.token);
    let { issues, value: validated } = validate(schema, argMatch.value);
    sources.push({
      sourceType: "cli",
      sourceName: "cli",
      value: (issues ? argMatch.value : validated) as T,
      issues,
    });
  }

  let { winner } = resolve(sources);
  let remainder = subtractClaims(available, claims);
  let result: ParseResult<T> = winner.issues
    ? { ok: false, error: new ValidationError(sources), remainder }
    : { ok: true, value: winner.value, remainder };

  let info: OptionInfo<T> = {
    type: "option",
    parser,
    prefix,
    claims,
    remainder,
    result,
    schema,
    required: !!validate(schema, undefined).issues,
    boolean: isBoolean(schema),
    default: opts.default,
    aliases: opts.aliases,
    description: opts.description,
    source: winner,
    sources,
    help: { progname: ctx.progname, args: [], opts: [], commands: [] },
  };
  info.help.opts.push(info as unknown as ParserInfo<unknown>);
  return info;
}

function readPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (let segment of path) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function coerceEnvValue<T>(schema: StandardSchemaV1<T>, raw: string): unknown {
  if (isBoolean(schema)) {
    let lower = raw.toLowerCase().trim();
    if (lower === "true" || lower === "yes" || lower === "1") return true;
    if (lower === "false" || lower === "no" || lower === "0") return false;
    return raw;
  }
  let n = Number(raw);
  if (!isNaN(n)) return n;
  return raw;
}

function optionName(prefix: { args: string[] }): string {
  return `--${toKebabCase(prefix.args.join(".")).toLowerCase()}`;
}

function negatedOptionName(prefix: { args: string[] }): string {
  return `--no-${toKebabCase(prefix.args.join(".")).toLowerCase()}`;
}

function matchArgs<T>(
  schema: StandardSchemaV1<T>,
  prefix: { args: string[] },
  aliases: string[],
  available: AvailableInput,
): { token: Token; value: unknown } | undefined {
  let name = optionName(prefix);
  let nameEq = `${name}=`;
  let neg = negatedOptionName(prefix);
  let isBool = isBoolean(schema);

  for (let i = 0; i < available.args.length; i++) {
    let entry = available.args[i];
    let v = entry.value;
    let next = available.args[i + 1];

    // --name=val or --no-name (single-token forms)
    if (isBool && v === name) {
      return { token: { type: "arg", from: entry.index, to: entry.index }, value: true };
    }
    if (isBool && v === neg) {
      return { token: { type: "arg", from: entry.index, to: entry.index }, value: false };
    }
    if (v.startsWith(nameEq)) {
      let raw = v.slice(nameEq.length);
      return {
        token: { type: "arg", from: entry.index, to: entry.index },
        value: isBool ? coerceBool(raw) : raw,
      };
    }
    // alias short forms (top-level only — nested aliases are not supported)
    if (prefix.args.length === 1) {
      for (let alias of aliases) {
        if (v === alias) {
          if (isBool) {
            return { token: { type: "arg", from: entry.index, to: entry.index }, value: true };
          }
          if (next && !next.value.startsWith("-")) {
            return {
              token: { type: "arg", from: entry.index, to: next.index },
              value: next.value,
            };
          }
        }
      }
    }
    // --name VAL (two-token form)
    if (!isBool && v === name && next && !next.value.startsWith("-")) {
      return {
        token: { type: "arg", from: entry.index, to: next.index },
        value: next.value,
      };
    }
  }
  return undefined;
}

function coerceBool(raw: string): boolean | string {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function subtractClaims(av: AvailableInput, claims: Token[]): AvailableInput {
  let argIdx = new Set<number>();
  let valKeys = new Set<string>();
  let envKeys = new Set<string>();
  for (let t of claims) {
    if (t.type === "arg") for (let i = t.from; i <= t.to; i++) argIdx.add(i);
    else if (t.type === "value") valKeys.add(`${t.source}|${t.path.join(".")}`);
    else envKeys.add(`${t.source}|${t.name}`);
  }
  return {
    args: av.args.filter((a) => !argIdx.has(a.index)),
    values: av.values, // values entries remain; the path within them was claimed, not the entry
    envs: av.envs,     // env entries remain; the name within them was claimed
  };
}
```

- [ ] **Step 2: Type check**

Run: `deno check lib/option.ts`
Expected: clean. May have unresolved references to `lib/schema.ts` exports (`isBoolean`); see next task.

### Task 2.3: Move `isBoolean` from `parse-args.ts` to `schema.ts`

**Files:**
- Modify: `lib/schema.ts`

- [ ] **Step 1: Add `isBoolean` to `lib/schema.ts`**

Append to `lib/schema.ts`:

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { validate } from "./validate.ts";

export function isBoolean<S extends StandardSchemaV1<unknown>>(
  schema: S,
): boolean {
  return !validate(schema, false).issues && !validate(schema, true).issues;
}
```

(Note: if `lib/schema.ts` already has imports, deduplicate.)

- [ ] **Step 2: Type check**

Run: `deno check lib/schema.ts lib/option.ts`
Expected: clean.

### Task 2.4: Test `option`

**Files:**
- Create: `test/option.test.ts`

- [ ] **Step 1: Write basic tests**

```ts
import { assertEquals } from "@std/assert";
import * as z from "zod/mini";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";

function ctx(args: string[] = [], values: { name: string; value: unknown }[] = [], envs: { name: string; value: Record<string, string> }[] = []) {
  let c = createContext({ args, values, envs });
  return { ...c, prefix: { values: ["foo"], envs: "", args: ["foo"] } };
}

Deno.test("option claims --foo VAL from args", () => {
  let p = option(z.string());
  let info = p.inspect(ctx(["--foo", "bar"]));
  assertEquals(info.result.ok, true);
  if (info.result.ok) assertEquals(info.result.value, "bar");
  assertEquals(info.claims.length, 1);
  assertEquals(info.claims[0], { type: "arg", from: 0, to: 1 });
});

Deno.test("option claims --foo=VAL from args", () => {
  let p = option(z.string());
  let info = p.inspect(ctx(["--foo=bar"]));
  assertEquals(info.claims[0], { type: "arg", from: 0, to: 0 });
  if (info.result.ok) assertEquals(info.result.value, "bar");
});

Deno.test("option boolean claims --foo as true", () => {
  let p = option(z.boolean());
  let info = p.inspect(ctx(["--foo"]));
  assertEquals(info.claims[0], { type: "arg", from: 0, to: 0 });
  if (info.result.ok) assertEquals(info.result.value, true);
});

Deno.test("option boolean claims --no-foo as false", () => {
  let p = option(z.boolean());
  let info = p.inspect(ctx(["--no-foo"]));
  assertEquals(info.claims[0], { type: "arg", from: 0, to: 0 });
  if (info.result.ok) assertEquals(info.result.value, false);
});

Deno.test("option scans past leading non-matching tokens", () => {
  let p = option(z.string());
  let info = p.inspect(ctx(["other", "--foo", "bar"]));
  assertEquals(info.claims[0], { type: "arg", from: 1, to: 2 });
});

Deno.test("option claims from values source by path", () => {
  let p = option(z.string());
  let info = p.inspect(ctx([], [{ name: "config", value: { foo: "from-values" } }]));
  assertEquals(info.claims.length, 1);
  assertEquals(info.claims[0], { type: "value", source: "config", path: ["foo"] });
  if (info.result.ok) assertEquals(info.result.value, "from-values");
});

Deno.test("option claims from envs source by name", () => {
  let p = option(z.string());
  let info = p.inspect(ctx([], [], [{ name: "process", value: { FOO: "from-env" } }]));
  assertEquals(info.claims.length, 1);
  assertEquals(info.claims[0], { type: "env", source: "process", name: "FOO" });
});

Deno.test("option cli wins over env wins over value", () => {
  let p = option(z.string());
  let info = p.inspect(ctx(
    ["--foo", "from-cli"],
    [{ name: "config", value: { foo: "from-values" } }],
    [{ name: "process", value: { FOO: "from-env" } }],
  ));
  if (info.result.ok) assertEquals(info.result.value, "from-cli");
});

Deno.test("option does not match when no source", () => {
  let p = option(z.string());
  let info = p.inspect(ctx([]));
  assertEquals(info.claims.length, 0);
});
```

- [ ] **Step 2: Run tests**

Run: `deno test test/option.test.ts`
Expected: 9 tests pass.

### Task 2.5: Implement `lib/argument.ts`

**Files:**
- Create: `lib/argument.ts`

- [ ] **Step 1: Write the file**

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  AvailableInput,
  ParseContext,
  ParseResult,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { validate, ValidationError } from "./validate.ts";
import { createContext } from "./context.ts";
import { defaultSource, noneSource, resolve, Source } from "./source.ts";
import { format } from "./help.ts";

export interface ArgumentInfo<T> extends ParserInfo<T> {
  type: "argument";
  schema: StandardSchemaV1<T>;
  required: boolean;
  default?: unknown;
  description?: string;
  source: Source<T>;
  sources: Source<T>[];
}

export interface ArgumentOpts<T> {
  default?: T;
  description?: string;
}

export function argument<T>(
  schema: StandardSchemaV1<T>,
  opts: ArgumentOpts<T> = {},
): Parser<T, ArgumentInfo<T>> {
  let parser: Parser<T, ArgumentInfo<T>> = {
    description: opts.description,
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ArgumentInfo<T> {
      let { prefix, available } = ctx;
      let claims: Token[] = [];
      let sources: Source<T>[] = [noneSource(schema)];
      if (opts.default !== undefined) {
        sources.push(defaultSource(schema, opts.default));
      }

      // first non-dash token in available args
      let entry = available.args.find((a) => !a.value.startsWith("-"));
      if (entry) {
        claims.push({ type: "arg", from: entry.index, to: entry.index });
        let { issues, value } = validate(schema, entry.value);
        sources.push({
          sourceType: "cli",
          sourceName: "cli",
          value: (issues ? entry.value : value) as T,
          issues,
        });
      }

      let { winner } = resolve(sources);
      let remainder: AvailableInput = {
        ...available,
        args: available.args.filter((a) => !claims.some((c) => c.type === "arg" && a.index >= c.from && a.index <= c.to)),
      };
      let result: ParseResult<T> = winner.issues
        ? { ok: false, error: new ValidationError(sources), remainder }
        : { ok: true, value: winner.value, remainder };

      let info: ArgumentInfo<T> = {
        type: "argument",
        parser,
        prefix,
        claims,
        remainder,
        result,
        schema,
        required: !!validate(schema, undefined).issues,
        default: opts.default,
        description: opts.description,
        source: winner,
        sources,
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
      info.help.args.push(info as unknown as ParserInfo<unknown>);
      return info;
    },
    help(input, ctx) {
      let info = parser.inspect(ctx ?? createContext(input));
      return format(info, info.prefix.args.join("."));
    },
  };
  return parser;
}
```

- [ ] **Step 2: Type check**

Run: `deno check lib/argument.ts`
Expected: clean.

### Task 2.6: Test `argument`

**Files:**
- Create: `test/argument.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { assertEquals } from "@std/assert";
import * as z from "zod/mini";
import { argument } from "../lib/argument.ts";
import { createContext } from "../lib/context.ts";

function ctx(args: string[] = []) {
  let c = createContext({ args });
  return { ...c, prefix: { values: ["x"], envs: "", args: ["x"] } };
}

Deno.test("argument claims first non-dash token", () => {
  let p = argument(z.string());
  let info = p.inspect(ctx(["foo", "--bar"]));
  assertEquals(info.claims, [{ type: "arg", from: 0, to: 0 }]);
  if (info.result.ok) assertEquals(info.result.value, "foo");
});

Deno.test("argument scans past leading dash tokens", () => {
  let p = argument(z.string());
  let info = p.inspect(ctx(["--bar", "foo"]));
  assertEquals(info.claims, [{ type: "arg", from: 1, to: 1 }]);
  if (info.result.ok) assertEquals(info.result.value, "foo");
});

Deno.test("argument with no positional emits no claim", () => {
  let p = argument(z.string(), { default: "x" });
  let info = p.inspect(ctx(["--foo"]));
  assertEquals(info.claims.length, 0);
  if (info.result.ok) assertEquals(info.result.value, "x");
});

Deno.test("argument does not claim from values or envs", () => {
  let p = argument(z.string());
  let c = createContext({
    args: [],
    values: [{ name: "config", value: { x: "from-values" } }],
    envs: [{ name: "process", value: { X: "from-env" } }],
  });
  let info = p.inspect({ ...c, prefix: { values: ["x"], envs: "", args: ["x"] } });
  assertEquals(info.claims.length, 0);
});
```

- [ ] **Step 2: Run tests**

Run: `deno test test/argument.test.ts`
Expected: 4 tests pass.

### Task 2.7: Update `lib/constant.ts` to new types

**Files:**
- Modify: `lib/constant.ts`

- [ ] **Step 1: Read existing file**

Open `lib/constant.ts` to see its current structure.

- [ ] **Step 2: Rewrite**

Replace contents with:

```ts
import type {
  ParseContext,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { createContext } from "./context.ts";
import { format } from "./help.ts";

export interface ConstantInfo<T> extends ParserInfo<T> {
  type: "constant";
  value: T;
}

export function constant<T>(value: T): Parser<T, ConstantInfo<T>> {
  let parser: Parser<T, ConstantInfo<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ConstantInfo<T> {
      let claims: Token[] = [];
      let remainder = ctx.available;
      return {
        type: "constant",
        parser,
        prefix: ctx.prefix,
        claims,
        remainder,
        result: { ok: true, value, remainder },
        value,
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}
```

- [ ] **Step 3: Type check**

Run: `deno check lib/constant.ts`
Expected: clean.

### Task 2.8: Test `constant`

**Files:**
- Modify or create: `test/constant.test.ts`

- [ ] **Step 1: Write/update tests**

```ts
import { assertEquals } from "@std/assert";
import { constant } from "../lib/constant.ts";
import { createContext } from "../lib/context.ts";

Deno.test("constant emits no claims and returns its value", () => {
  let p = constant("hello");
  let info = p.inspect(createContext({ args: ["x", "y"] }));
  assertEquals(info.claims.length, 0);
  if (info.result.ok) assertEquals(info.result.value, "hello");
});
```

- [ ] **Step 2: Run tests**

Run: `deno test test/constant.test.ts`
Expected: pass.

### Task 2.9: Implement `lib/passthrough.ts`

**Files:**
- Create: `lib/passthrough.ts`

- [ ] **Step 1: Write the file**

```ts
import type {
  ParseContext,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { createContext } from "./context.ts";
import { format } from "./help.ts";

export interface PassthroughInfo extends ParserInfo<string[] | undefined> {
  type: "passthrough";
}

export function passthrough(): Parser<string[] | undefined, PassthroughInfo> {
  let parser: Parser<string[] | undefined, PassthroughInfo> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): PassthroughInfo {
      let { prefix, available } = ctx;
      let claims: Token[] = [];
      let value: string[] | undefined;

      // find the first available `--` token
      let sentinelPos = available.args.findIndex((a) => a.value === "--");
      if (sentinelPos !== -1) {
        let sentinel = available.args[sentinelPos];
        let last = available.args[available.args.length - 1];
        claims.push({ type: "arg", from: sentinel.index, to: last.index });
        value = available.args.slice(sentinelPos + 1).map((a) => a.value);
      }

      let claimedSet = new Set<number>();
      for (let t of claims) {
        if (t.type === "arg") for (let i = t.from; i <= t.to; i++) claimedSet.add(i);
      }
      let remainder = {
        ...available,
        args: available.args.filter((a) => !claimedSet.has(a.index)),
      };

      return {
        type: "passthrough",
        parser,
        prefix,
        claims,
        remainder,
        result: { ok: true, value, remainder },
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}
```

- [ ] **Step 2: Type check**

Run: `deno check lib/passthrough.ts`
Expected: clean.

### Task 2.10: Test `passthrough`

**Files:**
- Create: `test/passthrough.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { assertEquals } from "@std/assert";
import { passthrough } from "../lib/passthrough.ts";
import { createContext } from "../lib/context.ts";

Deno.test("passthrough claims -- and everything after", () => {
  let p = passthrough();
  let info = p.inspect(createContext({ args: ["a", "--", "b", "c"] }));
  assertEquals(info.claims, [{ type: "arg", from: 1, to: 3 }]);
  if (info.result.ok) assertEquals(info.result.value, ["b", "c"]);
});

Deno.test("passthrough with no -- emits no claim", () => {
  let p = passthrough();
  let info = p.inspect(createContext({ args: ["a", "b"] }));
  assertEquals(info.claims.length, 0);
  if (info.result.ok) assertEquals(info.result.value, undefined);
});

Deno.test("passthrough with bare -- claims just the sentinel", () => {
  let p = passthrough();
  let info = p.inspect(createContext({ args: ["a", "--"] }));
  assertEquals(info.claims, [{ type: "arg", from: 1, to: 1 }]);
  if (info.result.ok) assertEquals(info.result.value, []);
});
```

- [ ] **Step 2: Run tests**

Run: `deno test test/passthrough.test.ts`
Expected: 3 tests pass.

### Task 2.11: Implement `lib/many.ts`

**Files:**
- Create: `lib/many.ts`

- [ ] **Step 1: Write the file**

```ts
import type {
  AvailableInput,
  ParseContext,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { createContext } from "./context.ts";
import { format } from "./help.ts";

export interface ManyInfo<T> extends ParserInfo<T[]> {
  type: "many";
  iterations: ParserInfo<T>[];
}

export function many<T>(inner: Parser<T>): Parser<T[], ManyInfo<T>> {
  let parser: Parser<T[], ManyInfo<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ManyInfo<T> {
      let values: T[] = [];
      let claims: Token[] = [];
      let iterations: ParserInfo<T>[] = [];
      let available = ctx.available;

      // repeat until inner produces no args claim
      while (true) {
        let info = inner.inspect({ ...ctx, available });
        let argClaims = info.claims.filter((c) => c.type === "arg");
        if (argClaims.length === 0) break;

        if (info.result.ok) values.push(info.result.value);
        claims.push(...info.claims);
        iterations.push(info);

        // subtract claimed args from available; values/envs are consumed once outside the loop
        let argIdx = new Set<number>();
        for (let c of argClaims) {
          for (let i = c.from; i <= c.to; i++) argIdx.add(i);
        }
        available = { ...available, args: available.args.filter((a) => !argIdx.has(a.index)) };
      }

      // Final inspect with empty args picks up values/envs source contributions if any
      // (deferred — see open question in spec §13)

      return {
        type: "many",
        parser,
        prefix: ctx.prefix,
        claims,
        remainder: available,
        result: { ok: true, value: values, remainder: available },
        iterations,
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}
```

- [ ] **Step 2: Type check**

Run: `deno check lib/many.ts`
Expected: clean.

### Task 2.12: Test `many`

**Files:**
- Create: `test/many.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { assertEquals } from "@std/assert";
import * as z from "zod/mini";
import { many } from "../lib/many.ts";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";

function ctx(args: string[] = []) {
  let c = createContext({ args });
  return { ...c, prefix: { values: ["foo"], envs: "", args: ["foo"] } };
}

Deno.test("many claims multiple --foo VAL pairs", () => {
  let p = many(option(z.string()));
  let info = p.inspect(ctx(["--foo", "a", "--foo", "b", "--foo", "c"]));
  if (info.result.ok) assertEquals(info.result.value, ["a", "b", "c"]);
  assertEquals(info.iterations.length, 3);
});

Deno.test("many with no matches yields empty array", () => {
  let p = many(option(z.string()));
  let info = p.inspect(ctx(["--bar", "x"]));
  if (info.result.ok) assertEquals(info.result.value, []);
});
```

- [ ] **Step 2: Run tests**

Run: `deno test test/many.test.ts`
Expected: 2 tests pass.

### Phase 2 commit

- [ ] **Commit leaf primitives**

```bash
git add lib/option.ts lib/argument.ts lib/constant.ts lib/passthrough.ts lib/many.ts lib/source.ts lib/schema.ts \
        test/option.test.ts test/argument.test.ts test/constant.test.ts test/passthrough.test.ts test/many.test.ts
git commit -m "✨ add option, argument, constant, passthrough, many leaf parsers"
```

---

## Phase 3: `object` Rewrite

**Goal:** Rewrite `lib/object.ts` to use the strict-sequential orchestration pattern over the new claim protocol. Each child sees the previous child's remainder; values/envs are scoped per child via `Prefix` extension.

**Files in this phase:**
- Modify: `lib/object.ts` — full rewrite.
- Modify: `test/object.test.ts` — adjust for new API.

### Task 3.1: Rewrite `lib/object.ts`

**Files:**
- Modify: `lib/object.ts`

- [ ] **Step 1: Read existing file** (for reference; the rewrite below is complete)

- [ ] **Step 2: Replace contents**

```ts
import type {
  AvailableInput,
  ParseContext,
  ParseResult,
  Parser,
  ParserInfo,
  Prefix,
  Token,
} from "./types.ts";
import { createContext } from "./context.ts";
import { format } from "./help.ts";
import { toSnake } from "ts-case-convert";

export type Attrs<T extends object> = {
  [K in keyof T]: Parser<T[K]>;
};

export interface ObjectInfo<T extends object> extends ParserInfo<T> {
  type: "object";
  attrs: { [K in keyof T]: ParserInfo<T[K]> };
}

export function object<T extends object>(
  attrs: Attrs<T>,
): Parser<T, ObjectInfo<T>> {
  let parser: Parser<T, ObjectInfo<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ObjectInfo<T> {
      let entries = Object.entries(attrs) as [keyof T & string, Parser<unknown>][];
      let result: Record<string, unknown> = {};
      let attrInfos: Record<string, ParserInfo<unknown>> = {};
      let aggClaims: Token[] = [];
      let available = ctx.available;
      let errors: { path: string[]; error: Error }[] = [];

      for (let [key, child] of entries) {
        let childPrefix: Prefix = {
          values: ctx.prefix.values.concat(key),
          envs: ctx.prefix.envs + toSnake(key).toUpperCase() + "_",
          args: ctx.prefix.args.concat(key),
        };
        let childAvail = scopeForChild(available, key);
        let childInfo = child.inspect({
          ...ctx,
          prefix: childPrefix,
          available: childAvail,
        });
        attrInfos[key] = childInfo;
        aggClaims.push(...childInfo.claims);
        if (childInfo.result.ok) {
          result[key] = childInfo.result.value;
        } else {
          errors.push({
            path: childPrefix.values,
            error: childInfo.result.error,
          });
        }
        // strip args claimed by child from `available` for next sibling
        let argIdx = new Set<number>();
        for (let t of childInfo.claims) {
          if (t.type === "arg") for (let i = t.from; i <= t.to; i++) argIdx.add(i);
        }
        available = {
          ...available,
          args: available.args.filter((a) => !argIdx.has(a.index)),
        };
      }

      let remainder = available;
      let resultPR: ParseResult<T> = errors.length > 0
        ? {
          ok: false,
          error: new ObjectValidationError(errors),
          remainder,
        }
        : { ok: true, value: result as T, remainder };

      let help: ObjectInfo<T>["help"] = {
        progname: ctx.progname,
        args: [],
        opts: [],
        commands: [],
      };
      for (let info of Object.values(attrInfos) as ParserInfo<unknown>[]) {
        help.args.push(...info.help.args);
        help.opts.push(...info.help.opts);
        help.commands.push(...info.help.commands);
      }

      return {
        type: "object",
        parser,
        prefix: ctx.prefix,
        claims: [],
        remainder,
        result: resultPR,
        attrs: attrInfos as ObjectInfo<T>["attrs"],
        help,
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}

export class ObjectValidationError extends Error {
  constructor(public fields: { path: string[]; error: Error }[]) {
    let message = fields.map(({ path, error }) =>
      `${path.join(".")}: ${error.message}`
    ).join("\n");
    super(message);
    this.name = "ObjectValidationError";
  }
}

// --- internal ---

function scopeForChild(available: AvailableInput, key: string): AvailableInput {
  return {
    args: available.args,
    values: available.values.flatMap((entry) => {
      let v = entry.value;
      if (v == null || typeof v !== "object") return [];
      let inner = (v as Record<string, unknown>)[key];
      if (inner === undefined) return [];
      return [{ source: entry.source, value: inner }];
    }),
    envs: available.envs,
  };
}
```

- [ ] **Step 3: Type check**

Run: `deno check lib/object.ts`
Expected: clean (or only references to other yet-unmigrated files).

### Task 3.2: Update `test/object.test.ts`

**Files:**
- Modify: `test/object.test.ts`

- [ ] **Step 1: Read existing tests**

Open `test/object.test.ts`. Existing tests use the old `field()` API; they need updating to `option()`/`argument()`.

- [ ] **Step 2: Rewrite tests using new primitives**

Replace existing tests with equivalents that use `option()` and `argument()`. Cover:
- Basic args claim: `object({foo: option(z.string())})` with `--foo bar`.
- Multiple options: `object({a: option(z.string()), b: option(z.string())})`.
- Mixed option + argument.
- Values projection: nested object with values input.
- Envs projection.
- Same-name options at different nesting levels (should not collide).

```ts
import { assertEquals } from "@std/assert";
import * as z from "zod/mini";
import { object } from "../lib/object.ts";
import { option } from "../lib/option.ts";
import { argument } from "../lib/argument.ts";
import { createContext } from "../lib/context.ts";

Deno.test("object claims --foo bar via option child", () => {
  let p = object({ foo: option(z.string()) });
  let info = p.inspect(createContext({ args: ["--foo", "bar"] }));
  if (info.result.ok) assertEquals(info.result.value, { foo: "bar" });
});

Deno.test("object threads args remainder between siblings", () => {
  let p = object({
    foo: option(z.string()),
    bar: option(z.string()),
  });
  let info = p.inspect(createContext({ args: ["--foo", "x", "--bar", "y"] }));
  if (info.result.ok) assertEquals(info.result.value, { foo: "x", bar: "y" });
});

Deno.test("object projects values per-child", () => {
  let p = object({ foo: option(z.string()) });
  let info = p.inspect(createContext({
    args: [],
    values: [{ name: "config", value: { foo: "from-values" } }],
  }));
  if (info.result.ok) assertEquals(info.result.value, { foo: "from-values" });
});

Deno.test("object projects envs by prefixed key", () => {
  let p = object({ foo: option(z.string()) });
  let info = p.inspect(createContext({
    args: [],
    envs: [{ name: "process", value: { FOO: "from-env" } }],
  }));
  if (info.result.ok) assertEquals(info.result.value, { foo: "from-env" });
});

Deno.test("nested object extends prefix for envs and values", () => {
  let p = object({
    plugin: object({ name: option(z.string()) }),
  });
  let info = p.inspect(createContext({
    args: [],
    envs: [{ name: "process", value: { PLUGIN_NAME: "x" } }],
  }));
  if (info.result.ok) assertEquals(info.result.value, { plugin: { name: "x" } });
});

Deno.test("nested object claims --plugin.name from args", () => {
  let p = object({
    plugin: object({ name: option(z.string()) }),
  });
  let info = p.inspect(createContext({ args: ["--plugin.name", "x"] }));
  if (info.result.ok) assertEquals(info.result.value, { plugin: { name: "x" } });
});
```

- [ ] **Step 3: Run tests**

Run: `deno test test/object.test.ts`
Expected: 6 tests pass.

### Phase 3 commit

- [ ] **Commit object rewrite**

```bash
git add lib/object.ts test/object.test.ts
git commit -m "♻️ rewrite object() over claim protocol"
```

---

## Phase 4: `commands` Rewrite

**Goal:** Rewrite `lib/commands.ts` to:
- Take a tuple-array form `commands([["name", parser], ...])` for TS inference.
- Scan past leading non-positionals to find its selector.
- Reset `prefix.args` for the inner; extend `prefix.values`/`envs`.
- Hand inner all of available minus the selector token (no positional barrier).

**Files in this phase:**
- Modify: `lib/commands.ts` — full rewrite, API change.
- Modify: `test/commands.test.ts` — adjust for new API.

### Task 4.1: Rewrite `lib/commands.ts`

**Files:**
- Modify: `lib/commands.ts`

- [ ] **Step 1: Replace contents**

```ts
import type {
  AvailableInput,
  Command,
  CommandInfo,
  CommandsInfo,
  ParseContext,
  ParseResult,
  Parser,
  ParserInfo,
  Prefix,
  Token,
} from "./types.ts";
import { createContext } from "./context.ts";
import { format } from "./help.ts";
import { toSnake } from "ts-case-convert";

export type CommandEntry<Name extends string, T> = readonly [Name, Parser<T>];

export interface CommandsParser<T extends Command<unknown, string>>
  extends Parser<T, CommandsInfo<T>> {
  default?: string;
}

export function commands<
  const E extends readonly (readonly [string, Parser<unknown>])[],
>(
  entries: E,
  opts: { default?: string } = {},
): CommandsParser<
  { [I in keyof E]: E[I] extends readonly [infer N extends string, Parser<infer V>] ? Command<V, N> : never }[number]
> {
  type ResultType = Command<unknown, string>;

  let parser: CommandsParser<ResultType> = {
    default: opts.default,
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): CommandsInfo<ResultType> {
      let { available } = ctx;

      // find first non-dash token whose value matches a name (or alias)
      let nameSet = new Set(entries.map(([n]) => n));
      let matchPos = available.args.findIndex((a) =>
        !a.value.startsWith("-") && nameSet.has(a.value)
      );
      let chosenName: string | undefined;
      let claims: Token[] = [];
      let innerAvailable: AvailableInput;

      if (matchPos !== -1) {
        let matched = available.args[matchPos];
        chosenName = matched.value;
        claims.push({ type: "arg", from: matched.index, to: matched.index });
        innerAvailable = {
          ...available,
          args: available.args.filter((_, i) => i !== matchPos),
        };
      } else if (opts.default && nameSet.has(opts.default)) {
        chosenName = opts.default;
        innerAvailable = available;
      } else {
        let remainder = available;
        return {
          type: "commands",
          parser,
          prefix: ctx.prefix,
          claims: [],
          remainder,
          result: {
            ok: false,
            error: new NoCommandMatchError([...nameSet]),
            remainder,
          },
          commands: {},
          help: { progname: ctx.progname, args: [], opts: [], commands: [] },
        } as unknown as CommandsInfo<ResultType>;
      }

      let chosen = entries.find(([n]) => n === chosenName)!;
      let innerPrefix: Prefix = {
        values: ctx.prefix.values.concat(chosenName),
        envs: ctx.prefix.envs + toSnake(chosenName).toUpperCase() + "_",
        args: [],
      };

      // scope values to entries that have the chosen name as a key, project
      // scope envs by prefix
      let scopedValues = innerAvailable.values.flatMap((entry) => {
        let v = entry.value;
        if (v == null || typeof v !== "object") return [];
        let inner = (v as Record<string, unknown>)[chosenName!];
        if (inner === undefined) return [];
        return [{ source: entry.source, value: inner }];
      });
      let scopedEnvs = innerAvailable.envs.map((entry) => {
        let scoped: Record<string, string> = {};
        let p = innerPrefix.envs;
        for (let [k, val] of Object.entries(entry.value)) {
          if (k.startsWith(p)) scoped[k.slice(p.length)] = val;
          else scoped[k] = val;
        }
        return { source: entry.source, value: scoped };
      });

      let innerCtx: ParseContext = {
        ...ctx,
        prefix: innerPrefix,
        available: { args: innerAvailable.args, values: scopedValues, envs: scopedEnvs },
      };
      let innerInfo = chosen[1].inspect(innerCtx);

      let resultValue: Command<unknown, string> = innerInfo.result.ok
        ? { name: chosenName, config: innerInfo.result.value } as Command<unknown, string>
        : { name: chosenName } as unknown as Command<unknown, string>;

      let result: ParseResult<ResultType> = innerInfo.result.ok
        ? { ok: true, value: resultValue as ResultType, remainder: innerInfo.remainder }
        : { ok: false, error: innerInfo.result.error, remainder: innerInfo.remainder };

      // command-info wrapper
      let commandInfo: CommandInfo<Command<unknown, string>> = {
        type: "command",
        parser: chosen[1] as unknown as Parser<Command<unknown, string>>,
        prefix: innerPrefix,
        claims: [],
        remainder: innerInfo.remainder,
        result: innerInfo.result.ok
          ? { ok: true, value: resultValue, remainder: innerInfo.remainder }
          : { ok: false, error: innerInfo.result.error, remainder: innerInfo.remainder },
        name: chosenName,
        description: chosen[1].description,
        aliases: chosen[1].aliases,
        config: innerInfo,
        commands: {},
        help: innerInfo.help,
      };

      let allCommandInfos: Record<string, CommandInfo<Command<unknown, string>>> = {
        [chosenName]: commandInfo,
      };

      return {
        type: "commands",
        parser,
        prefix: ctx.prefix,
        claims,
        remainder: innerInfo.remainder,
        result,
        commands: allCommandInfos as CommandsInfo<ResultType>["commands"],
        help: innerInfo.help,
      } as unknown as CommandsInfo<ResultType>;
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  } as CommandsParser<ResultType>;

  return parser as CommandsParser<{
    [I in keyof E]: E[I] extends readonly [infer N extends string, Parser<infer V>] ? Command<V, N> : never;
  }[number]>;
}

export class NoCommandMatchError extends Error {
  constructor(public available: string[]) {
    super(`No command matched. Available: ${available.join(", ")}`);
    this.name = "NoCommandMatchError";
  }
}
```

- [ ] **Step 2: Type check**

Run: `deno check lib/commands.ts`
Expected: clean.

### Task 4.2: Update `test/commands.test.ts`

**Files:**
- Modify: `test/commands.test.ts`

- [ ] **Step 1: Replace contents**

```ts
import { assertEquals } from "@std/assert";
import * as z from "zod/mini";
import { commands } from "../lib/commands.ts";
import { object } from "../lib/object.ts";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";

Deno.test("commands dispatches on first positional matching a name", () => {
  let p = commands([
    ["serve", object({ port: option(z.string()) })],
    ["build", object({ out: option(z.string()) })],
  ]);
  let info = p.inspect(createContext({ args: ["serve", "--port", "8000"] }));
  if (info.result.ok) {
    assertEquals(info.result.value.name, "serve");
    assertEquals(info.result.value.config, { port: "8000" });
  }
});

Deno.test("commands scans past leading non-positional tokens", () => {
  let p = commands([
    ["serve", object({ port: option(z.string()) })],
  ]);
  let info = p.inspect(createContext({ args: ["--unknown", "serve", "--port", "8000"] }));
  if (info.result.ok) {
    assertEquals(info.result.value.name, "serve");
  }
});

Deno.test("commands resets args-path so inner uses bare option names", () => {
  let p = commands([
    ["serve", object({ port: option(z.string()) })],
  ]);
  let info = p.inspect(createContext({ args: ["serve", "--port", "8000"] }));
  if (info.result.ok && "config" in info.result.value) {
    assertEquals(info.result.value.config, { port: "8000" });
  }
});

Deno.test("commands hands inner pre-and-post selector tokens (no positional barrier)", () => {
  let p = commands([
    ["serve", object({ port: option(z.string()), host: option(z.string()) }) as any],
  ]);
  // --host is before serve, --port is after; both should reach inner
  let info = p.inspect(createContext({ args: ["--host", "h", "serve", "--port", "8000"] }));
  if (info.result.ok && "config" in info.result.value) {
    assertEquals(info.result.value.config, { port: "8000", host: "h" });
  }
});

Deno.test("commands scopes values by command name", () => {
  let p = commands([
    ["serve", object({ port: option(z.string()) })],
  ]);
  let info = p.inspect(createContext({
    args: ["serve"],
    values: [{ name: "config", value: { serve: { port: "8000" } } }],
  }));
  if (info.result.ok && "config" in info.result.value) {
    assertEquals(info.result.value.config, { port: "8000" });
  }
});

Deno.test("commands scopes envs by command prefix", () => {
  let p = commands([
    ["serve", object({ port: option(z.string()) })],
  ]);
  let info = p.inspect(createContext({
    args: ["serve"],
    envs: [{ name: "process", value: { SERVE_PORT: "8000" } }],
  }));
  if (info.result.ok && "config" in info.result.value) {
    assertEquals(info.result.value.config, { port: "8000" });
  }
});

Deno.test("same-name option at outer and inner levels — both claim", () => {
  let p = object({
    foo: option(z.boolean()),
    cmd: commands([
      ["run", object({ foo: option(z.boolean()) })],
    ]),
  });
  let info = p.inspect(createContext({ args: ["--foo", "run", "--foo"] }));
  if (info.result.ok) {
    assertEquals(info.result.value.foo, true);
    if ("config" in info.result.value.cmd) {
      assertEquals(info.result.value.cmd.config, { foo: true });
    }
  }
});

Deno.test("commands fails when no name matches and no default", () => {
  let p = commands([
    ["serve", object({ port: option(z.string()) })],
  ]);
  let info = p.inspect(createContext({ args: [] }));
  assertEquals(info.result.ok, false);
});

Deno.test("commands uses default when no name matches", () => {
  let p = commands([
    ["serve", object({ port: option(z.string(), { default: "x" }) })],
  ], { default: "serve" });
  let info = p.inspect(createContext({ args: [] }));
  assertEquals(info.result.ok, true);
});
```

- [ ] **Step 2: Run tests**

Run: `deno test test/commands.test.ts`
Expected: 9 tests pass.

### Phase 4 commit

- [ ] **Commit commands rewrite**

```bash
git add lib/commands.ts test/commands.test.ts
git commit -m "♻️ rewrite commands() with tuple-array API and claim protocol"
```

---

## Phase 5: `program` Rewrite

**Goal:** Rewrite `lib/program.ts` as the wrapping pattern: claims `--help`/`-h`/`--version`/`-v` itself, delegates to inner, exposes `{help, version, config}` result.

**Files in this phase:**
- Modify: `lib/program.ts`.
- Update: `test/help.test.ts` (existing).

### Task 5.1: Rewrite `lib/program.ts`

**Files:**
- Modify: `lib/program.ts`

- [ ] **Step 1: Replace contents**

```ts
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
  let { name, versionString } = { name: opts.name, versionString: opts.version };
  let inner = opts.config;

  let parser: Parser<Program<T>, ProgramInfo<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ProgramInfo<T> {
      let rootCtx: ParseContext = { ...ctx, progname: [name] };
      let { available } = rootCtx;

      // claim --help / -h
      let helpClaim = findFirst(available, (v) => v === "--help" || v === "-h");
      // claim --version / -v (only if version is provided)
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
```

- [ ] **Step 2: Type check**

Run: `deno check lib/program.ts`
Expected: clean.

### Task 5.2: Test `program`

**Files:**
- Modify or create: `test/program.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { assertEquals } from "@std/assert";
import * as z from "zod/mini";
import { program } from "../lib/program.ts";
import { object } from "../lib/object.ts";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";

Deno.test("program claims --help", () => {
  let p = program({
    name: "myapp",
    config: object({ x: option(z.string(), { default: "y" }) }),
  });
  let info = p.inspect(createContext({ args: ["--help"] }));
  if (info.result.ok) {
    assertEquals(info.result.value.help, true);
    assertEquals(info.result.value.version, false);
  }
});

Deno.test("program claims -v when version provided", () => {
  let p = program({
    name: "myapp",
    version: "1.0.0",
    config: object({ x: option(z.string(), { default: "y" }) }),
  });
  let info = p.inspect(createContext({ args: ["-v"] }));
  if (info.result.ok) {
    assertEquals(info.result.value.version, true);
  }
});

Deno.test("program delegates to inner when no help/version", () => {
  let p = program({
    name: "myapp",
    config: object({ x: option(z.string()) }),
  });
  let info = p.inspect(createContext({ args: ["--x", "v"] }));
  if (info.result.ok) {
    assertEquals(info.result.value.help, false);
    assertEquals(info.result.value.config, { x: "v" });
  }
});
```

- [ ] **Step 2: Run tests**

Run: `deno test test/program.test.ts`
Expected: 3 tests pass.

### Phase 5 commit

- [ ] **Commit program rewrite**

```bash
git add lib/program.ts test/program.test.ts
git commit -m "♻️ rewrite program() with wrapping pattern and help/version claims"
```

---

## Phase 6: `inject` Adjustments + Remove `sequence`

**Goal:** Make `inject` work against the new `ParseContext`. Remove any traces of `sequence()` from the codebase.

**Files in this phase:**
- Modify: `lib/inject.ts`.
- Modify: `test/inject.test.ts`.
- Search: any references to `sequence` and remove.

### Task 6.1: Update `lib/inject.ts`

**Files:**
- Modify: `lib/inject.ts`

- [ ] **Step 1: Adjust to new types**

```ts
import type { Input, ParseContext, Parser, ParserInfo } from "./types.ts";
import { createContext, toAvailable } from "./context.ts";
import { format } from "./help.ts";

export function inject<T, D>(
  fn: (dep: D) => Parser<T>,
): Parser<(dep: D) => Parser<T>> {
  let parser: Parser<(dep: D) => Parser<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ParserInfo<(dep: D) => Parser<T>> {
      let resolve = (dep: D): Parser<T> => {
        let inner = fn(dep);
        return {
          ...inner,
          parse(input, override) {
            let nextCtx = override ?? {
              ...ctx,
              input: input ?? ctx.input,
              available: toAvailable(input ?? ctx.input),
            };
            return inner.inspect(nextCtx).result;
          },
          inspect(override) {
            return inner.inspect(override);
          },
          help(input, override) {
            return inner.help(input ?? ctx.input, override ?? ctx);
          },
        };
      };
      return {
        type: "inject",
        parser,
        prefix: ctx.prefix,
        claims: [],
        remainder: ctx.available,
        result: { ok: true, value: resolve, remainder: ctx.available },
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}
```

- [ ] **Step 2: Type check**

Run: `deno check lib/inject.ts`
Expected: clean.

### Task 6.2: Update `test/inject.test.ts`

**Files:**
- Modify: `test/inject.test.ts`

- [ ] **Step 1: Read existing tests**

If existing tests use the old API, adapt them to use `option`/`argument` and the new types. Tests should verify that `inject` produces a parser-factory whose result, when given a dep, parses correctly.

```ts
import { assertEquals } from "@std/assert";
import * as z from "zod/mini";
import { inject } from "../lib/inject.ts";
import { object } from "../lib/object.ts";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";

Deno.test("inject produces parser-factory dependent on injected value", () => {
  let p = inject<{ port: number }, string>((host) =>
    object({ port: option(z.number()) })
  );

  let info = p.inspect(createContext({ args: [] }));
  if (info.result.ok) {
    let factory = info.result.value;
    let inner = factory("localhost");
    let r = inner.parse({ args: ["--port", "8080"] });
    assertEquals(r.ok, true);
    if (r.ok) assertEquals(r.value, { port: 8080 });
  }
});
```

- [ ] **Step 2: Run tests**

Run: `deno test test/inject.test.ts`
Expected: pass.

### Task 6.3: Remove `sequence()` references

**Files:**
- Search: any references to `sequence` across the codebase.

- [ ] **Step 1: Grep for sequence**

Search the codebase for `sequence`:

```
Grep pattern="\\bsequence\\b" path="lib/"
Grep pattern="\\bsequence\\b" path="test/"
Grep pattern="\\bsequence\\b" path="examples/"
```

If `lib/sequence.ts` exists (it does not appear in the current `lib/`), delete it.

- [ ] **Step 2: Remove `sequence` export from `lib/mod.ts` if present**

Open `lib/mod.ts`. Remove any `export * from "./sequence.ts";` line if present.

- [ ] **Step 3: Replace `sequence` usage in examples**

For each `examples/` file using `sequence(...)`, rewrite using `inject(fn)` per spec §9.1: phase 1's parser produces a factory; the application loads dependencies between phases and supplies them to the factory.

Pattern (before):
```ts
sequence([phase1, phase2])
```
Pattern (after):
```ts
inject<typeof Phase2Output, DepFromPhase1>((dep) => phase2WithDep(dep))
```
Where the application code is responsible for parsing phase1, performing I/O, calling the inject factory with the dep, and parsing phase2.

If any example is not worth porting, delete it.

### Phase 6 commit

- [ ] **Commit inject + remove sequence**

```bash
git add lib/inject.ts lib/mod.ts test/inject.test.ts examples/
git commit -m "♻️ adapt inject() to new ParseContext, remove sequence()"
```

---

## Phase 7: Parse Chart

**Goal:** Add a parse-chart renderer per spec §10. `ParserInfo.claims` and `remainder: AvailableInput` were already wired in Phase 1 (Task 1.1 step 5).

**Files in this phase:**
- Create: `lib/chart.ts` — renderer.
- Create: `test/chart.test.ts`.

### Task 7.1: Implement `lib/chart.ts`

**Files:**
- Create: `lib/chart.ts`

- [ ] **Step 1: Write the renderer**

```ts
import type {
  AvailableInput,
  Input,
  ParserInfo,
  Token,
} from "./types.ts";
import { toAvailable } from "./context.ts";

export function chart<T>(info: ParserInfo<T>, input: Input): string {
  let av = toAvailable(input);
  let lines: string[] = [];
  lines.push("input:");
  lines.push("  args:    " + av.args.map((a) => `[${a.index}] ${JSON.stringify(a.value)}`).join("  "));
  if (av.values.length) {
    for (let v of av.values) {
      lines.push(`  values:  [${v.source}] ${JSON.stringify(v.value)}`);
    }
  }
  if (av.envs.length) {
    for (let e of av.envs) {
      lines.push(`  envs:    [${e.source}] ${formatEnvs(e.value)}`);
    }
  }
  lines.push("");
  lines.push("parse:");
  renderNode(info as ParserInfo<unknown>, input, "", lines);
  lines.push("");
  lines.push("remainder:");
  lines.push("  args:    " + (info.remainder.args.length ? info.remainder.args.map((a) => `[${a.index}] ${JSON.stringify(a.value)}`).join("  ") : "∅"));
  lines.push("  values:  " + (info.remainder.values.length ? info.remainder.values.map((v) => `[${v.source}]`).join(", ") : "∅"));
  lines.push("  envs:    " + (info.remainder.envs.length ? info.remainder.envs.map((e) => `[${e.source}]`).join(", ") : "∅"));
  return lines.join("\n");
}

// --- internal ---

function renderNode(
  info: ParserInfo<unknown>,
  input: Input,
  indent: string,
  out: string[],
): void {
  let label = info.type;
  if (info.claims.length === 0) {
    out.push(`${indent}${label}  ⊘`);
  } else {
    out.push(`${indent}${label}`);
    out.push(`${indent}  claims:`);
    for (let claim of info.claims) {
      out.push(`${indent}    ${formatClaim(claim, input)}`);
    }
  }
  // descend into children where applicable (object.attrs, commands.commands, program.main)
  if ("attrs" in info) {
    let attrs = (info as unknown as { attrs: Record<string, ParserInfo<unknown>> }).attrs;
    for (let [k, child] of Object.entries(attrs)) {
      out.push(`${indent}  ├─ "${k}" →`);
      renderNode(child, input, indent + "  │  ", out);
    }
  }
  if ("commands" in info) {
    let cmds = (info as unknown as { commands: Record<string, ParserInfo<unknown>> }).commands;
    for (let [k, child] of Object.entries(cmds)) {
      out.push(`${indent}  └─ "${k}" →`);
      renderNode(child, input, indent + "     ", out);
    }
  }
  if ("main" in info) {
    let main = (info as unknown as { main: ParserInfo<unknown> }).main;
    out.push(`${indent}  └─`);
    renderNode(main, input, indent + "     ", out);
  }
}

function formatClaim(t: Token, input: Input): string {
  if (t.type === "arg") {
    let slice = (input.args ?? []).slice(t.from, t.to + 1).map((s) => JSON.stringify(s)).join(" ");
    return `args   [${t.from}..${t.to}] ${slice}`;
  }
  if (t.type === "value") {
    return `values [${t.source}:.${t.path.join(".")}]`;
  }
  return `envs   [${t.source}:${t.name}]`;
}

function formatEnvs(env: Record<string, string>): string {
  return Object.entries(env).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ");
}
```

- [ ] **Step 2: Type check**

Run: `deno check lib/chart.ts`
Expected: clean.

### Task 7.2: Test `chart`

**Files:**
- Create: `test/chart.test.ts`

- [ ] **Step 1: Write a smoke test**

```ts
import { assert } from "@std/assert";
import * as z from "zod/mini";
import { chart } from "../lib/chart.ts";
import { object } from "../lib/object.ts";
import { option } from "../lib/option.ts";
import { createContext } from "../lib/context.ts";

Deno.test("chart renders a successful parse", () => {
  let p = object({ foo: option(z.string()) });
  let input = { args: ["--foo", "bar"] };
  let info = p.inspect(createContext(input));
  let rendered = chart(info, input);
  assert(rendered.includes("input:"));
  assert(rendered.includes("parse:"));
  assert(rendered.includes("--foo"));
  assert(rendered.includes("\"foo\" →") || rendered.includes(`"foo"`));
  assert(rendered.includes("remainder:"));
});
```

- [ ] **Step 2: Run tests**

Run: `deno test test/chart.test.ts`
Expected: pass.

### Phase 7 commit

- [ ] **Commit chart renderer**

```bash
git add lib/chart.ts test/chart.test.ts
git commit -m "✨ add parse-chart renderer"
```

---

## Phase 8: Migration

**Goal:** Delete `lib/field.ts`, `lib/parse-args.ts`, and `lib/remaining.ts`. Update `lib/mod.ts` exports. Update remaining tests and examples to new API. Pass full test suite + lint + type check.

**Files in this phase:**
- Delete: `lib/field.ts`, `lib/parse-args.ts`, `lib/remaining.ts`.
- Modify: `lib/mod.ts`.
- Modify: existing tests still using `field()`.
- Modify: `examples/`.

### Task 8.1: Delete obsolete files

**Files:**
- Delete: `lib/field.ts`
- Delete: `lib/parse-args.ts`
- Delete: `lib/remaining.ts`

- [ ] **Step 1: Remove the files**

```bash
git rm lib/field.ts lib/parse-args.ts lib/remaining.ts
```

- [ ] **Step 2: Update `test/field.test.ts`**

Either delete `test/field.test.ts` entirely (its responsibilities are covered by `test/option.test.ts` + `test/argument.test.ts`), or rewrite as integration tests.

```bash
git rm test/field.test.ts
```

(Or, if there are integration scenarios in `test/field.test.ts` worth preserving, port them into `test/option.test.ts` first.)

### Task 8.2: Update `lib/mod.ts`

**Files:**
- Modify: `lib/mod.ts`

- [ ] **Step 1: Replace contents**

```ts
export * from "./types.ts";
export * from "./constant.ts";
export * from "./option.ts";
export * from "./argument.ts";
export * from "./many.ts";
export * from "./passthrough.ts";
export * from "./object.ts";
export * from "./commands.ts";
export * from "./program.ts";
export * from "./inject.ts";
export * from "./context.ts";
export * from "./chart.ts";
```

Removed: `field.ts`. Added: `option.ts`, `argument.ts`, `many.ts`, `passthrough.ts`, `chart.ts`.

- [ ] **Step 2: Type check**

Run: `deno check lib/`
Expected: clean.

### Task 8.3: Update remaining tests

**Files:**
- Modify: `test/help.test.ts`, `test/boolean.test.ts`, `test/lens.test.ts`

- [ ] **Step 1: Read each file and identify substitutions**

For each file, read its current content and apply these substitutions:

| Old | New |
|-----|-----|
| `field(schema, cli.argument())` | `argument(schema)` |
| `field(schema)` | `option(schema)` |
| `field(schema, field.array())` | `many(option(schema))` |
| `field(schema, field.default(v))` | `option(schema, { default: v })` |
| `field(schema, cli.argument(), field.default(v))` | `argument(schema, { default: v })` |
| imports of `field`, `cli` from `mod.ts` | imports of `option`, `argument`, `many` |

If a test inspects internal matcher behavior from `parse-args.ts`, replace with a public-API test asserting the observable behavior (claims emitted, value resolved, remainder shape).

- [ ] **Step 2: Decide on `lib/lens.ts`**

Read `lib/lens.ts` and `test/lens.test.ts`. Determine whether the lens
abstraction is reachable from the new public API:

- If `lib/lens.ts` only references types removed in this refactor (e.g.,
  `Field`, the old `ParseContext` shape), and no parser imports it, **delete
  both `lib/lens.ts` and `test/lens.test.ts`**.
- If `lib/lens.ts` provides a useful abstraction over the new `ParserInfo`
  / `Token` shapes, **adapt it** in this task and update its test.

Run `Grep pattern="\\blens\\b" path="lib/"` to determine if anything in `lib/` still uses it. If only `mod.ts` re-exports lens, that's not enough to keep it.

- [ ] **Step 3: Run all tests**

Run: `deno test`
Expected: all tests pass.

### Task 8.4: Update `examples/`

**Files:**
- Modify: every file in `examples/`

- [ ] **Step 1: List existing examples**

Run: `Glob pattern="examples/*.ts"` to enumerate.

- [ ] **Step 2: For each example, apply migrations**

Substitutions (same patterns as Task 8.3 plus):

| Old | New |
|-----|-----|
| `commands({a: parserA, b: parserB})` | `commands([["a", parserA], ["b", parserB]])` |
| `sequence([phase1, phase2])` | `inject(...)` per Task 6.3 step 3 |
| `result.help` (from `Program<T>`) | unchanged — still boolean |
| `result.config` | unchanged — still `T` |
| `result.version: string` (old) | `result.version: boolean` (new); the actual version string is on the program parser via `program({version: "1.0.0"})` |

If `examples/duplo.ts` (untracked) uses removed APIs, port or delete.

- [ ] **Step 3: Run each example with sample input**

For each example file, run it with the args it documents in its header comment (or with `--help` if it has no documented usage):

```bash
deno run examples/<file>.ts --help
```
Expected: runs to completion, shows help or expected behavior. No type errors, no runtime errors.

### Task 8.5: Final type check, lint, test

- [ ] **Step 1: Type check**

Run: `deno check`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `deno lint`
Expected: zero issues.

- [ ] **Step 3: Tests**

Run: `deno test`
Expected: all tests pass.

### Phase 8 commit

- [ ] **Commit migration**

```bash
git add -A
git commit -m "♻️ delete field.ts/parse-args.ts/remaining.ts, update barrel and tests"
```

---

## Final Verification

- [ ] **Run the full pipeline:**

```bash
deno check
deno lint
deno test
```

All must pass. If anything fails, address before considering the implementation complete.

- [ ] **Verify spec coverage:**

Re-read `docs/superpowers/specs/2026-05-04-parsing-theory-design.md`. Confirm:
- §1 motivation addressed (PR #15 dissolves; three channels share addressing).
- §2 layered claim protocol implemented in every parser.
- §3 Token model exists and is honored.
- §4 ParseContext rewritten; `commands` field gone; immutable input + addressed available.
- §5 ParserInfo includes `claims: Token[]`.
- §6 every primitive matches its claim grammar.
- §7 orchestration patterns observed.
- §8 disambiguation cases work (covered by tests in Phase 4).
- §9 `sequence`, `field`, `and` removed (and never reintroduced).
- §10 chart renderer present.
- §11 PR #15 implication: tests prove options/commands extract from anywhere.
- §13 open considerations remain documented.

If any spec section lacks a corresponding implementation, file an issue with what's missing.
