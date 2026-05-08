# Help Command Design

**Status:** Draft
**Date:** 2026-05-08

## 1. Motivation

The current `--help` mechanism, where `program` claims `--help`/`-h` as a
boolean option, surfaced a disambiguation problem when subcommands have their
own help: in `myapp dev --help`, who claims `--help`? `program` claims it
first, leaving no way for `dev`'s help to be requested. Variations on the
claim-protocol (deepest-wins, positional-context, etc.) all introduce
arbitration rules that violate the layered claim protocol's "outermost first,
no global option-matching" guarantee.

Re-framing help as a **command** sidesteps the entire arbitration problem.
`myapp help dev` is unambiguous: the `commands` parser dispatches to `help`,
help renders dev's documentation as its result value. `--help` remains as a
plain program option that the application interprets — no special claim
arbitration anywhere.

Three things have to change for this to work cleanly:

1. The `commands` parser's API needs a small upgrade so user-defined commands
   and library-supplied commands compose uniformly.
2. The `help` command needs **some** form of context-driven access to its
   sibling commands so it can render documentation for the targeted one.
3. The help-renders-help case must terminate without recursion.

Sections below describe each.

## 2. Out of Scope

The following are explicitly deferred and not part of this design:

- **Reader-macro input rewriting** — rewriting `myapp dev --help` to
  `myapp help dev` at the program level. Elegant but adds a new conceptual
  layer (input transformation) that warrants its own design pass.
- **Nested help** — `myapp dev help` to render dev's help. Adding `help` as a
  child of subcommands' inner parsers is supported by the same machinery, but
  no library helper produces it; users who want it compose it manually.
- **`version` as a command** — `myapp version` analogous to help. Same idea,
  but version is conceptually thinner (no target arg, no overview/specific
  distinction) and `--version`/`-v` continues to be a program option for now.
- **Inheriting CLI args into the rendered scope** — `myapp help dev --port
  4000` showing dev with `--port 4000` already applied. The first
  implementation strips CLI args when rendering for a sibling, surfacing only
  values/envs/defaults.

These can each be picked up incrementally without revisiting the foundation
laid here.

## 3. New `commands` API

### 3.1 The `command` factory

```ts
export interface CommandSpec<Name extends string, T> {
  name: Name;
  parser: Parser<T>;
  description?: string;
  aliases?: string[];
}

export function command<Name extends string, T>(
  name: Name,
  parser: Parser<T>,
  opts?: { description?: string; aliases?: string[] },
): CommandSpec<Name, T>;
```

`command` is a small builder that bundles a name with its parser plus
optional metadata. It does no parsing itself; it returns a record consumed by
`commands(...)`.

### 3.2 `commands` consumes specs

```ts
export function commands<
  const Cs extends readonly CommandSpec<string, unknown>[],
>(
  specs: Cs,
  opts?: { default?: string },
): CommandsParser<
  {
    [I in keyof Cs]: Cs[I] extends CommandSpec<infer N, infer V>
      ? Command<V, N>
      : never;
  }[number]
>;
```

The TypeScript inference for the resulting `Command<T, Name>` union is the
same shape as today; the `const` modifier and indexed `infer` are preserved
across the new spec-based form.

This replaces the tuple-array form:

```ts
// Before
commands([
  ["dev", dev],
  ["build", build],
])

// After
commands([
  command("dev", dev),
  command("build", build),
])
```

The new form makes name-and-metadata-and-parser visually grouped, and
matches a natural extension point: `command("dev", dev, { description: ... })`.

It also lets the library export pre-built command specs (like `help`) as
constants, dropping them into any `commands(...)` list.

### 3.3 `CommandsParser` exposes its entries

The parser instance returned by `commands(...)` exposes its entries
publicly:

```ts
interface CommandsParser<T> extends Parser<T, CommandsInfo<T>> {
  default?: string;
  readonly entries: readonly CommandSpec<string, unknown>[];
  helpFor(ctx: ParseContext, name?: string): string;
}
```

`entries` is a read-only view of the specs the parser was constructed with.
`helpFor` is described in §5.

## 4. `ParseScope`: contextual values across compound dispatch

To let library-supplied commands access information from the parent
compound, `ParseContext` is extended with a typed key-value mechanism
modelled on Effection's `Context`. Values are scoped to a synchronous block
and propagate to children but never to siblings.

### 4.1 API

```ts
export interface ParseScope<T> { readonly name: string; }

export function createParseScope<T>(name: string): ParseScope<T>;
```

`ParseContext` gains:

```ts
interface ParseContext {
  // ... existing fields
  expect<T>(scope: ParseScope<T>): T;          // throws if not set
  get<T>(scope: ParseScope<T>): T | undefined; // returns undefined if not set
  with<T, R>(
    scope: ParseScope<T>,
    value: T,
    body: (ctx: ParseContext) => R,
  ): R;
}
```

`with` is **block-scoped**: it derives a new ctx with the scope set and
passes it to `body`. The derived ctx is not returned — callers cannot leak
it past the block. `body` may pass the derived ctx to other parsers, which
see the scope; once `body` returns, the original ctx is unchanged.

`expect` and `get` differ only in their not-set behavior: `expect` throws,
`get` returns `undefined`. `expect` is the default; `get` is for parsers
that must operate gracefully when scope is missing (the help-on-help
fallback in §5.3).

### 4.2 Implementation sketch

The derived ctx is built by spreading the parent ctx and replacing an
internal scopes map:

```ts
function makeWithMap(map: Map<ParseScope<unknown>, unknown>): ParseContext {
  return {
    // ... existing fields, including read which closes over input
    expect: (scope) => { /* lookup or throw */ },
    get: (scope) => map.get(scope) as unknown,
    with: (scope, value, body) => {
      let next = new Map(map).set(scope, value);
      return body(makeWithMap(next));
    },
  };
}
```

The derived ctx replaces only the scopes map and the bound expect/get/with
methods; everything else (input, available, prefix, progname, read) flows
through the spread.

### 4.3 Scope-aware spread in derived contexts

Currently `commands` (and `object`, `program`) build derived child contexts
via `{ ...ctx, prefix, available }` spread. Under §4.2, methods are
re-bound to the new map, so the spread pattern continues to work — `expect`,
`get`, `with` come from the derived ctx, not from the spread origin. The
existing parsers' spread sites need no change.

## 5. `CommandsScope` and the help command

### 5.1 The scope

```ts
// lib/commands.ts (or wherever CommandsScope lives)
export interface CommandsScopeValue {
  parser: CommandsParser<Command<unknown, string>>;
  ctx: ParseContext; // commands' own ctx, captured pre-dispatch
}

export const CommandsScope = createParseScope<CommandsScopeValue>("commands");
```

The captured ctx is essential: it lets the help command (or any other
sibling) re-derive scoping for arbitrary entries. When `commands` dispatches
to a child:

```ts
// In commands.claim AND commands.parse:
let parentCtx = ctx;
let dispatch = chooseCommand(parentCtx, entries, opts.default);
if (!dispatch) return /* no-match path */;
let chosen = entries.find(e => e.name === dispatch.name)!;
let innerCtx = innerContext(parentCtx, dispatch.name, dispatch.innerArgs);
let scope: CommandsScopeValue = { parser: this, ctx: parentCtx };

let inner = innerCtx.with(CommandsScope, scope, (scoped) =>
  chosen.parser.claim(scoped) // or .inspect(scoped) in the parse phase
);
```

Both phases (claim and parse) set the scope so children calling
`ctx.expect(CommandsScope)` see it consistently.

### 5.2 `helpFor`

`CommandsParser` exposes a render method that takes a parent ctx and an
optional target name:

```ts
helpFor(ctx: ParseContext, name?: string): string {
  if (!name) {
    // overview: render commands node itself with no CLI args
    let overviewCtx: ParseContext = {
      ...ctx,
      available: { ...ctx.available, args: [] },
    };
    return format(this.inspect(overviewCtx));
  }
  let entry = this.entries.find((e) => e.name === name);
  if (!entry) {
    let known = this.entries.map((e) => e.name).join(", ");
    return `Unknown command: ${name}.\nAvailable: ${known}`;
  }
  // Re-derive entry's scope (mirrors `commands`' innerContext logic).
  let scopedCtx = scopeFor(name, ctx);
  return entry.parser.help(undefined, scopedCtx);
}
```

`scopeFor(name, ctx)` is the same scoping logic `commands` uses internally
when dispatching: extend `prefix.values` and `prefix.envs` by name, reset
`prefix.args` to `[]`, scope `available.values`/`available.envs` by name,
strip CLI args (so the rendered scope shows current values/envs/defaults
without CLI claims). See §2 for the deferred "inherit CLI args" variant.

### 5.3 The `help` command

The help command's `Info` shape is a vanilla `ParserInfo<string>`; help
doesn't introduce any extras beyond the standard envelope.

```ts
// lib/help-command.ts (new internal implementation)
import type { ParserInfo } from "./types.ts";
import { defineParser } from "./parser.ts";
import { CommandsScope, command } from "./commands.ts";

let helpParser = defineParser<string, ParserInfo<string>>({
  type: "help-command",
  description: "Show help for a command",
  claim(ctx) {
    let entry = ctx.available.args.find((a) => !a.value.startsWith("-"));
    return entry ? [{ type: "arg", from: entry.index, to: entry.index }] : [];
  },
  parse(ctx, claims, remainder) {
    let scope = ctx.get(CommandsScope);
    let target = claims.length > 0 ? ctx.read(claims[0])[0] : undefined;
    let text: string;
    if (!scope) {
      text = "Usage: help [COMMAND]\n\nShow help for a command.";
    } else {
      text = scope.parser.helpFor(scope.ctx, target);
    }
    return {
      result: { ok: true, value: text, remainder },
      help: { progname: ctx.progname, args: [], opts: [], commands: [] },
    };
  },
});

export const help = command("help", helpParser, {
  description: "Show help for a command",
});
```

### 5.4 Behavior for each invocation

| Input               | Result                                      |
|---------------------|---------------------------------------------|
| `myapp help`        | `r.value.config.config = ` overview text    |
| `myapp help dev`    | `r.value.config.config = ` dev's help text  |
| `myapp help help`   | `r.value.config.config = ` help's help text |
| `myapp help bogus`  | `r.value.config.config = ` "Unknown command: bogus..." |

For `help help`: `helpFor(scope.ctx, "help")` runs. `scope.ctx` is the
parent commands' **own** ctx — captured before commands set up the
CommandsScope, so it does not carry that scope itself. (CommandsScope was
introduced inside the `with` block, on the *child* ctx.) Therefore
`scope.ctx.get(CommandsScope) === undefined`, and any ctx derived from it
also has no scope set. `helpFor` builds `scopedCtx` from `scope.ctx`,
calls `helpEntry.parser.help(undefined, scopedCtx)`. The auto-shim runs
help's `inspect` → `parse` → `ctx.get(CommandsScope)` — returns
`undefined`, help renders the static blurb. No recursion.

> Invariant: `scope.ctx` must always be the parent's pre-dispatch ctx, the
> one captured *before* the `with(CommandsScope, ...)` call. If we
> mistakenly captured the post-with ctx, `help help` would recurse. The
> scope-set in `commands` (§5.1) explicitly captures `parentCtx` outside
> the with-block to enforce this.

### 5.5 Conservation

Conservation holds at every level. Help is a regular command; its claim
grammar is "first non-dash token in available.args". Its claims aggregate
into commands' aggregate claims. The `--help` flag (claimed by program as
a boolean option, see §6) is unrelated to the help command's claims.

## 6. `--help` and `--version`

For this design, `--help` and `--version` continue to be claimed by
`program` as boolean options. The application interprets `r.value.help`
and `r.value.version` and decides what to render. Typical wiring:

```ts
let r = app.parse(input);
if (r.value.help) {
  // user typed --help; show help via the help command path
  let target = r.value.config?.name; // matched subcommand, if any
  console.log(target ? helpFor(target) : helpFor());
  return;
}
```

The application can call `app.parse({args: ["help", target]})` to use the
help command, or call `app.help()` for the auto-shim.

This double-mechanism is intentional for now. Folding `--help` into the
macro-rewrite proposal (§2) unifies them later without breaking the help
command's design.

## 7. Migration

### 7.1 Source changes

- `lib/types.ts`: extend `ParseContext` with `expect`, `get`, `with`.
- `lib/context.ts`: extend `createContext` to build the scope-aware ctx
  (via the shared `makeWithMap` factory).
- `lib/scope.ts` (new): `ParseScope`, `createParseScope`.
- `lib/commands.ts`: rewrite `commands(...)` to consume `CommandSpec[]`;
  add `command(...)` factory; expose `entries`/`helpFor`/scope-set on
  dispatch; export `CommandsScope`.
- `lib/help-command.ts` (new): the `help` const.
- `lib/mod.ts`: export `command`, `help`, `createParseScope`,
  `CommandsScope`.
- All examples and tests using the tuple-array `commands([[name, p], ...])`
  form update to `commands([command(name, p), ...])`.

### 7.2 Test additions

- `test/scope.test.ts`: ParseScope mechanics (expect/get/with, missing
  scope, nesting, scope shadowing).
- `test/help-command.test.ts`: each row of §5.4's behavior table.
- `test/commands.test.ts`: command-factory inference, scope set during
  dispatch, no-match path, `entries` accessor.

### 7.3 Backwards compatibility

Tuple-array form is dropped. The ergonomic difference is small (one
function call per entry); all examples and downstream code update in one
pass.

## 8. Audit and the parse chart

Help's claim is a regular arg token; it appears in the parse chart at
its node:

```
└─ "cmd" → commands                 grammar: ⟨dev | build | help⟩ as positional
                                    claims:  args [0..0] "help"
   │
   └─ "help" → help-command         grammar: positional command name
                                    claims:  args [1..1] "dev"
                                    result:  "Usage: myapp dev [OPTIONS]\n  ..."
```

Conservation holds the same as before; help is just another command.

## 9. Implications for existing code

- The `--help` claim in `program` is unchanged for now (§6).
- The `inject.ts` `freshCtx` helper is the prototype for §5.4's "fresh ctx
  in helpFor" — same shape.
- The `formatSource` logic in `help.ts` continues to drive the diagnostic
  display of invalid sources — when help renders dev with `PORT="invalid"`,
  the source shows up as "env=PORT 'invalid' (invalid)" or similar, helping
  users debug misconfiguration.
- The `gatherMetadata` path in `commands.ts` continues to populate
  `info.commands` for all entries; scope is **not** set during
  metadata-gathering (only during dispatch). Help's metadata-time inspect
  hits the no-scope path and renders the static blurb — fine for metadata
  purposes; the description and structure are populated regardless.
