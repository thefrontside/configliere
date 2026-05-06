# Parsing Theory Design

**Status:** Draft
**Date:** 2026-05-04

## 1. Motivation

Configliere parses configuration from three channels — values, envs, and args
— and composes parsers into trees. The current implementation has two related
weaknesses that surfaced as PR #15 attempted a localized fix:

1. **Circular correctness model.** The current spec adjudicates parser
   behavior in terms of "correct claiming" without an externally observable
   definition of what claiming is. PR #15 invoked a "remainder contract" that
   appealed to the same model it was trying to fix. There is no way to look
   at a parse and verify, from outside any single parser's implementation,
   that the parse is correct.

2. **Asymmetric scope across channels.** Values and envs encode their
   structure intrinsically (tree shape and prefixed keys, respectively). Args
   is a flat token list whose structure is parser-dependent and opaque. The
   same parser tree should produce the same result tree from any of the
   three channels, but no current model articulates how.

This document proposes a parsing theory that resolves both: claims are
externally observable and globally addressable, and the three channels share
a unified addressing scheme rooted in the parser tree's path structure.

## 2. Core Theory

### 2.1 The layered claim protocol

1. Every parser is given an input — a context containing `args`, `values`,
   `envs`.
2. Every parser has a **claim grammar** — a small, externally-declared
   description of what it consumes from each channel.
3. Every parser executes its claim against its given input. Whatever it does
   not claim is its remainder. **Claims happen regardless of validation
   outcome** — claim is about token consumption, not value correctness.
4. Every parser's `claims` is the **aggregate** of its own claims and all
   its descendants' claims. Compound parsers may delegate matching to
   children; the resulting tokens propagate up so conservation
   `claims ∪ remainder == available` holds at every level.
5. Outermost parsers see input first; whatever they claim is gone before any
   inner parser sees it. There is no global option-matching — every claim is
   scoped to "the input my parent gave me."
6. The parse tree records every claim. Conservation (input = ∪claims +
   remainder) is externally verifiable. Correctness is "every claim is
   accounted for, and each parser's claim grammar matches what it took."

### 2.2 Conservation and identifiability

The two together form the externally-verifiable correctness criterion:

- **Conservation:** for every input token across every channel, the token
  appears either in exactly one parser's claims or in the root remainder.
  Disjoint union; nothing dropped, nothing duplicated.
- **Identifiability:** every input token has a stable global address that
  survives remaindering. A claim refers to addresses, not local-to-parser
  positions.

A successful parse can be reconstructed token-for-token from the claim tree
plus the original input.

## 3. Token Model

A `Token` is an address into the original input. It has no value field; the
value is read by dereferencing the address against the input.

```ts
type Token =
  | { type: "arg"; from: number; to: number }
  | { type: "value"; source: string; path: string[] }
  | { type: "env"; source: string; name: string };
```

### 3.1 Args tokens are contiguous ranges

An args token is a closed range `[from..to]` over the original args array. A
single-index claim is a range of length one (`from === to`). Multi-token
claims (e.g., `option(string)` consuming `--name VAL`) are ranges of length
two. A non-contiguous parser (e.g., `many`) produces multiple separate
tokens.

| Claim                                    | Token shape              |
|------------------------------------------|--------------------------|
| `argument()` consuming `bar`             | `{from: i, to: i}`       |
| `option(boolean)` consuming `--foo`      | `{from: i, to: i}`       |
| `option(string)` consuming `--foo VAL`   | `{from: i, to: i+1}`     |
| `option(string)` consuming `--foo=VAL`   | `{from: i, to: i}`       |
| `passthrough()` consuming `-- … …`       | `{from: k, to: n-1}`     |
| `many(option(string))` two matches       | two tokens, one each     |

### 3.2 Values and envs tokens

Values tokens address a path within a named source value. Envs tokens
address a named env var within a named env source. Both are keyed; neither
has positional ordering.

### 3.3 Per-source claim cardinality

For a given parser at a given path:

- **values:** at most **one** token per values source. A given
  `(source, path)` resolves to a single subtree value. Multiple values
  sources mean up to *N* value-tokens for the same parser, one per source.
- **envs:** at most **one** token per env source. A given
  `(source, name)` resolves to a single env var. Multiple env sources mean
  up to *N* env-tokens, one per source.
- **args:** single match for `option`, multiple non-contiguous matches for
  `many(option)`, single range for `passthrough`, etc. — bounded by the
  parser's own claim grammar.

This is a structural property: keyed channels (values, envs) only address
a single value per source per address. Resolution layer combines the
per-source value-tokens across sources via priority (cli > env > values >
default).

## 4. Input, Tokens, and ParseContext

### 4.1 Input is immutable

The user-facing `Input` is the same shape as today — `{args, values, envs}`
— but is treated as **immutable** by the parsing system. No parser slices,
mutates, or shortens it. The original input is the canonical reference for
all addresses throughout the parse.

### 4.2 Tokens are outputs, not inputs

Tokens are not pre-computed from input. They are **output records**
produced by parsers as they claim. The act of claiming is what
constitutes a token: the parser identifies what region of input it is
consuming and emits a `Token` describing that region, addressed back to
the original input.

Phrased differently: there is no separate `lex()` phase that enumerates
input into a token stream. Parsing is one phase. Each parser receives
raw input — strings for args, structured values for the others — and
produces claim records as part of its output.

(If a separate lex phase ever proves useful, it can be added later as an
optimization or alternative API. The protocol does not require it.)

### 4.3 What ParseContext carries

`ParseContext` provides each parser with raw input — with **stable
addresses preserved** so claims can refer back to original positions:

```ts
type AvailableInput = {
  args:   { index:  number; value: string }[];
  values: { source: string; value: unknown }[];
  envs:   { source: string; value: Record<string, string> }[];
};

interface ParseContext {
  input: Input;              // immutable original
  available: AvailableInput; // view current parser may claim from
  prefix: Prefix;            // see §4.5
  progname: string[];
}
```

- `input` — the immutable original. Canonical reference for addresses.
- `available` — same shape as `Input`, but each args entry carries its
  original index, and values/envs entries carry their stable identifiers.
  As parsing descends, parents pass children narrower `available`
  views (prior siblings' claimed entries removed).
- A parser runs its claim grammar against `available`, producing a list
  of `Token` records as output. Its remainder is the `available` view
  with the claimed entries removed.

Claim/remainder accounting is **bookkeeping over stable addresses**: no
input mutation, no pre-pass.

### 4.4 What the new ParseContext does *not* carry

The current `ParseContext` carries fields that are properly implementation
state and do not belong in the public protocol. These are removed:

- **`commands: Record<string, Parser<…>>`** — leaked implementation detail
  used today to thread the available command set; not part of the parsing
  protocol. Removed.
- **`args: string[]`, `values: […]`, `envs: […]`** as mutable per-recursion
  state — replaced by `input` (immutable) plus `available` (addressed
  view).

### 4.5 Prefix shape and propagation

`Prefix` is the channel-specific addressing path threaded through
`ParseContext`. Definition:

```ts
type Prefix = {
  values: string[];   // path within a values-source value
  envs: string;       // prefix for env var names (e.g., "SERVE_")
  args: string[];     // dotted segments for args (e.g., ["plugin", "foo"])
};
```

It is **contextual**, not stored on the parser at construction. Parents
extend the prefix as they recurse; a leaf reads its current prefix off
its `ParseContext`.

For a child at key `k` of an `object`:
- `values: parent.values.concat(k)`
- `envs: parent.envs + snakeUpper(k) + "_"`
- `args: parent.args.concat(k)`

For the dispatched inner of a `commands` selection with name `name`:
- `values: parent.values.concat(name)`
- `envs: parent.envs + snakeUpper(name) + "_"`
- **`args: []`** — reset

The asymmetry exists because in args, the command name is consumed
positionally — it takes a token, establishing scope. Re-prefixing options
with the command name would be redundant. In values/envs there is no
positional consumption, so the address must include every level.

### 4.6 Tree-path versus result-tree path

`Prefix.values` is the path within a values input source — used for claim
addressing. The result-tree path (where the parser's value lands in the
final result) differs under `commands` because of the `Command<T, Name> =
{name, config: T}` wrapping.

Example: a parser shaped as
```ts
object({
  cmd: commands([["serve", object({port: option(z.number())})]])
})
```
has a leaf `option` whose `Prefix.values = ["cmd", "serve", "port"]` (used
to look up `entry.cmd.serve.port` in a values source), while its result
lands at `result.cmd.config.port` (because the matched command is wrapped
as `{name: "serve", config: {port: …}}`). Both paths are useful and are
carried separately on `ParserInfo`.

## 5. ParserInfo

Each node in the parse tree carries:

```ts
interface ParserInfo<T> {
  type: string;            // discriminator: "object", "option", "commands", …
  parser: Parser<T>;
  prefix: Prefix;
  claims: Token[];         // aggregate: own claims plus all descendants'
  remainder: AvailableInput; // available view minus claimed entries
  result: ParseResult<T>;
  // ... existing fields: help info, etc.
}
```

Claims are output records aggregated from the parser and all its
descendants. Remainder is the parser's `available` view with those
claimed entries removed — same shape as `AvailableInput`, ready to be
threaded as the next parser's input.

Conservation: for every parser, the addresses referenced by its `claims`
plus the addresses still present in its `remainder` equal the addresses
of its `available` input. The property holds at every node, not just the
root: a leaf claims its own tokens; a compound's `claims` aggregates
descendants' tokens, so the equation balances locally as well as
globally.

`type` is the existing discriminator string used to type-narrow
`ParserInfo` to specific subtypes (`ObjectInfo`, `CommandsInfo`,
`FieldInfo`, …). Values today are `"object"`, `"field"`, `"command"`,
`"commands"`, `"constant"`, `"inject"`. Under this design, the set
becomes `"object"`, `"option"`, `"argument"`, `"constant"`, `"many"`,
`"passthrough"`, `"commands"`, `"command"`, `"program"`, `"inject"`.

`info.claims` is the union of every claim made at this node and below —
own plus all descendants. Conservation holds at every level:
`info.claims ∪ info.remainder == info.available`. Audit walks the tree to
attribute each address to a specific parser; for any single node,
conservation is locally verifiable.

## 6. Claim Grammar Per Primitive

### 6.1 Leaves

#### `option<T>(schema, opts?)` — single named value

Claim grammar derived from `Prefix`:
- **args:** first token matching `--<prefix.args.join(".")>` patterns. For
  boolean schema: `--name`, `--no-name`, `--name=BOOL`, `-a` (alias).
  For non-boolean: `--name VAL`, `--name=VAL`, `-a VAL`. Single match.
- **values:** for each entry, one claim of the subtree at `prefix.values`
  if present.
- **envs:** for each entry, one claim of the env var matching `prefix.envs`
  (snake-uppercase) if present.

Path: leaf. Inherits parent prefix.

Resolution: up to (1 + |values entries| + |envs entries|) candidate values;
existing source-priority logic picks winner.

#### `argument<T>(schema)` — single positional, CLI-only

Claim grammar:
- **args:** first non-dash token in input. One claim.
- **values, envs:** none.

Path: leaf.

#### `constant<T>(value)` — fixed value

Claim grammar: empty across all channels.

Path: leaf.

#### `many<T>(parser)` — repeat over args

Claim grammar:
- **args:** repeat the wrapped parser's args grammar until no further match.
  Each iteration produces one token; the result is an array.
- **values, envs:** identical to the wrapped parser. `many` does not
  multiply claims on these channels; the schema is responsible for shape
  validation of the value at the wrapped path.

Path: prefix is unchanged from the wrapped parser; `many` does not modify
addressing.

#### `passthrough()` — claim `--` and the rest

Claim grammar:
- **args:** the bare `--` token plus all subsequent args tokens, as a single
  contiguous Token. Single match per input.
- **values, envs:** none.

Result type: `string | undefined` (or `string[] | undefined`, TBD by
implementation choice). Result is the materialized post-`--` content.

Path: leaf.

### 6.2 Compounds

#### `object({k: parser, …})`

Claim grammar: empty.

Orchestration: **strict-sequential**. Children evaluated in declaration
order. Each child receives the previous child's remainder as its input args;
values and envs are scoped per child by extending the channel-specific parts
of `Prefix`.

Path: extends parent prefix.

#### `commands([[name, parser], …], { default? })`

Claim grammar:
- **args:** first non-dash token whose value matches a command name or
  alias. **Scans past leading non-positional tokens** (loosens current
  `args[0]`-only check). Single match.
- **values:** for each entry, claim the subtree at `prefix.values`
  (whichever sub-key matches one of the command names) — the matched
  command's inner parser receives this scoped subtree.
- **envs:** for each entry, claim env vars whose names start with
  `prefix.envs + snakeUpper(matched-name) + "_"`.

Orchestration: **dispatch-then-delegate**. After claiming the selector,
hand inner: input minus the selector token. There is no positional barrier
— pre-selector and post-selector tokens both go to inner. Scope values and
envs by name.

Path: extends `Prefix.values` and `Prefix.envs` with the matched name;
**resets `Prefix.args` to `[]`**.

API: tuple-array form, not record:
```ts
commands([
  ["serve", parser],
  ["evaluate", parser],
], { default? })
```
This is required for TypeScript inference of the resulting union type.

`default` fires only if no positional matches.

#### `program(parser, opts?)`

Claim grammar:
- **args:** `--help`/`-h` and `--version`/`-v` as boolean options
  (configurable names/aliases).
- **values, envs:** none.

Orchestration: **wrapping**. Runs help/version claims alongside delegation
to inner. Result shape: `{help: boolean, version: boolean, config: T}` —
flat booleans alongside a populated config of the inner parser's type.

`program()` does not claim `--`; that is `passthrough()`'s job.

Path: root.

#### `inject<T, D>(fn: D => Parser<T>)` — dependent parser

Claim grammar: empty until injected. Returns a parser-factory; once a `D`
is supplied, the resulting parser claims as it would normally.

Orchestration: **dependent**. Produces a function that, given a dependency,
returns a parser. The application calls this with the dep, gets a parser,
runs it on subsequent input.

Path: passthrough through the produced parser.

## 7. Orchestration Patterns

The compound parsers map to four named patterns plus one modifier:

- **strict-sequential** *(`object`)*: children in declaration order, each
  receives previous child's remainder. Args, values, and envs all thread
  forward.
- **dispatch-then-delegate** *(`commands`)*: parent makes one own claim
  (selector token), then delegates everything else to the matched inner.
- **wrapping** *(`program`)*: parent has its own leaf-style claims plus an
  inner parser; both evaluated, inner's input is what parent's claims left
  behind.
- **dependent** *(`inject`)*: parent doesn't claim; produces a parser
  factory awaiting an external dependency.
- **repeat** *(`many`)*: re-run the wrapped parser's claim grammar on
  remainder until no further match. Args-only.

These names are descriptive characterizations of the primitives, not
configurable knobs. Future primitives may share or extend a pattern.

## 8. Disambiguation

Disambiguation is fully determined by the layered claim protocol — outer
parsers claim first, parent decides child order, no positional barriers
required.

### 8.1 Same-name across nesting levels

Parser:
```ts
object({
  foo: option(z.boolean()),
  cmd: commands([["run", object({foo: option(z.boolean())})]]),
})
```
Args: `--foo run --foo` (indices 0, 1, 2).

1. `object`'s first child (outer `option(foo)`) runs first, claims `--foo`
   at range `[0..0]`. Remainder: tokens at indices 1 and 2.
2. `object`'s second child (`commands`) runs on remainder. Its grammar
   scans for a positional matching a command name; finds `run` at index 1.
   Claims it. Hands inner: remainder minus the selector — just `--foo` at
   original index 2.
3. Inner `option(foo)` claims `--foo` at index 2.

Each `--foo` claimed once, by the correct parser. No special rule beyond
parent-driven sequential ordering and "first match" leaf grammar.

### 8.2 Args-channel nesting requires `commands`

For `object({inner: object({foo: option}), foo: option})` and args
`--foo bar`: there is no positional barrier in args to scope `inner.foo`.
The outer `option(foo)` claims `--foo`. The nested `inner.foo` is reachable
from values (`{inner: {foo: bar}}`) or envs (`INNER_FOO=bar`) but not from
args by itself, except via dotted name `--inner.foo bar`.

### 8.3 Boolean negation in nested names

Head-attached: `--no-<args-path-joined>`. Examples:

- Args-path `["foo"]`: `--foo`, `--no-foo`, `--foo=true|false`.
- Args-path `["plugin", "foo"]`: `--plugin.foo`, `--no-plugin.foo`,
  `--plugin.foo=true|false`.

Option names cannot start with `no-` (reserved for negation). Validated at
parser construction time.

Aliases are top-of-args-path only — single segment. Nested options must use
the long dotted form.

## 9. Removed Primitives and APIs

### 9.1 `sequence()` removed

`sequence()` is removed in favor of `inject()`. Multi-phase parsing is
expressed as an injected parser factory: phase 1 produces a `Parser<T>`
that depends on an out-of-band value loaded between phases. The application
loads the value (e.g. config file, plugin discovery), supplies it to the
factory, and parses subsequent input.

### 9.2 `and()` not introduced

An earlier sketch proposed `and([…])` as a sibling combinator. Investigation
showed that every use case is expressible as `object({…})` with explicit
keys. `object` remains the only structural combinator. Not introducing
`and` keeps every node in the parser tree keyed, which is required for
values and envs to address into it.

### 9.3 `field()` superseded

The current `field()` primitive mixes positional and named matching via a
runtime `argument: true` flag. It is replaced by two distinct leaves —
`option()` for named, `argument()` for positional — so the consumption
mode is encoded in the parser's type, not in a flag.

## 10. Audit and the Parse Chart

The audit is a renderable, externally-verifiable view of a parse. The parse
chart format:

```
input:
  args:    [0] "--config"  [1] "app.json"  [2] "serve"  [3] "--port"  [4] "8000"
  values:  [config.json] {serve: {port: 4000}}
  envs:    [process]     SERVE_PORT=3000

parse:
  program                              grammar: --help, --version
                                       claims:  ∅
  └─ object                            ⊘
     │
     ├─ "config" → option<string>      grammar: --config
     │                                 claims:
     │                                   args   [0..1] "--config" "app.json"
     │                                   values [config.json:.config = "app.json"]
     │
     ├─ "cmd" → commands               grammar: ⟨serve | evaluate⟩ as positional
     │                                 claims:
     │                                   args   [2..2] "serve"
     │   │
     │   └─ "serve" → object           ⊘
     │      │
     │      └─ "port" → option<number>     grammar: --port
     │                                     claims:
     │                                       args   [3..4] "--port" "8000"
     │                                       values [config.json:.serve.port = 4000]
     │                                       envs   [process:SERVE_PORT = "3000"]

remainder:
  args:    ∅
  values:  ∅
  envs:    ∅
```

Three sections always present:

- **`input:`** — original input with stable addresses.
- **`parse:`** — the parser tree. Each node shows its slot in the parent
  (the `"key" →` prefix), the parser type, its `grammar:` (what it can
  claim), and its `claims:` (what it actually claimed, with addresses and
  dereferenced values). `⊘` marks nodes with no own grammar and no own
  claims (pure orchestration).
- **`remainder:`** — addresses and content not claimed by any parser.

Every address in `parse:` and `remainder:` traces back to a position in
`input:`. Conservation is visually verifiable.

## 11. Implications for PR #15

PR #15 raised the question of whether `object()`'s tokenization loop should
halt on unclaimed tokens. Under this theory, the question dissolves:

- Each leaf has its own claim grammar. `option()` scans for its name
  pattern in its given input — finding it past leading non-matching tokens
  is part of the grammar, not a "loop policy."
- `commands()` similarly scans its input for a positional matching a
  command name; leading non-positionals are passed over by the grammar
  itself, not by a loop continuation rule.
- Conservation holds by construction.

The corrected implementation follows the theory: leaves implement their
grammars directly; compounds orchestrate without a sequential token loop
that can halt prematurely.

## 12. Summary of Primitives

| Primitive          | Kind     | Pattern                | Path rule         |
|--------------------|----------|------------------------|-------------------|
| `option(schema)`   | leaf     | (claim grammar)        | inherits prefix   |
| `argument(schema)` | leaf     | (claim grammar)        | inherits prefix   |
| `constant(value)`  | leaf     | (empty grammar)        | inherits prefix   |
| `many(parser)`     | leaf-mod | repeat                 | passthrough       |
| `passthrough()`    | leaf     | (claim grammar)        | inherits prefix   |
| `object({k: …})`   | compound | strict-sequential      | extends all       |
| `commands([…])`    | compound | dispatch-then-delegate | extends t/v/e, resets a |
| `program(p)`       | compound | wrapping               | root              |
| `inject(fn)`       | compound | dependent              | passthrough       |

## 13. Open Considerations

The following are deliberately deferred:

- **`passthrough()` result shape** — `string | undefined` versus `string[]
  | undefined`. Implementation choice; tradeoffs documented but not
  decided.
- **Shell-style "literal after `--`"** — option claims still match tokens
  after a `--` claimed by something else. Current design only supports
  passthrough semantics. A second flavor (e.g. `terminator()`) can be added
  if needed.
- **`many` on envs and values** — `many<E>(parser: Parser<E>)` produces
  `Parser<E[]>`. For args, repeating the inner grammar yields multiple
  elements naturally. For envs, a single matching env var is a string
  scalar; producing an array requires a parsing convention (comma-
  separated, indexed names like `FILES_0`/`FILES_1`, etc.) that has not
  been chosen. For values, the entry's value at the wrapped path may
  already be an array, in which case the schema validates element-wise —
  but the relationship between this and the args repetition is not
  fully worked out. Implementation may either (a) defer `many` entirely,
  (b) ship `many` as args-only and explicitly restrict it, or
  (c) pick conventions for envs/values. To be decided when implementing.
