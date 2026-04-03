# Configliere Specification

**Version:** 0.4 — Draft (final sentence-level calibration)\
**Status:** Normative draft for repository inclusion\
**Derived from:** Reverse-engineering research and focused research briefs
(phased parsing, type inference, introspection architecture,
environment-variable scoping), grounded in 13 transcript sessions and current
library source code.\
**Revision note:** This version makes a final sentence-level pass. Source
equivalence claims are scoped with SHOULD where source-form limitations apply.
Source priority is labeled as provisionally normative. The inject
resolve-function pattern is labeled as current API shape. Helper extraction
obligation distinguishes the convention (normative) from the roster (current).
Test agenda items are annotated by purpose: [Verify current] vs. [Lock down
contract].

---

## 1. Purpose

Configliere is a parser-combinator configuration system for TypeScript
applications that run across CLI, server, and tooling contexts.

Configliere treats application configuration as a **single pre-validated value**
rather than a scattered set of ad hoc reads at runtime. A Configliere program
defines a schema of typed fields, composes them into objects and commands, and
parses input from three unified sources — CLI arguments, environment variables,
and config-file object values — into one validated result with full source
provenance.

The system produces:

- a typed, validated configuration value,
- a record of which source provided each value and why,
- structurally derived help text,
- and a parser tree that is inspectable at any point.

Configliere uses Standard Schema validators for field-level validation, making
it compatible with arktype, zod, valibot, and other conforming schema libraries.

---

## 2. Design Philosophy

### 2.1 Source equivalence

Source equivalence is a core design goal: CLI arguments, environment variables,
and config-file object values are treated as conceptually equivalent input
channels for _field-level configuration_. A field that accepts `--port 8080`
from the CLI SHOULD also accept `PORT=8080` from the environment and
`{ port: 8080 }` from a config file. The same schema validates all three.

Source equivalence applies to the field/configuration model — the space of typed
scalar and simple values that fields can represent. It does not imply perfect
symmetry across all configuration concepts and source forms:

- Command _selection_ is CLI-only (§9.1). This is an explicit asymmetry, not a
  gap.
- Env vars undergo string coercion that CLI and config values do not require.
- Env vars have no natural representation for nested objects or arrays beyond
  simple conventions (e.g., comma-separated lists).
- Not every structural concept (e.g., a command map, a nested object tree) has a
  direct env-var equivalent.

Within the supported field model, every field SHOULD be configurable through
every source channel, and every source MUST be validated by the same schema.
Where a source cannot naturally represent a field's value (e.g., an env var for
a deeply nested object), the limitation is inherent to the source form, not a
violation of source equivalence. The goal is that a user who knows one source
can predict the behavior of another — not that every source is syntactically
identical or structurally equivalent.

### 2.2 Parser combinators as the core architecture

Configliere's architecture is built on small, composable parser functions.
`field()` parses a single value. `object()` composes fields. `commands()`
composes command variants. `program()` adds help/version screening. `inject()`
defers a phase behind a dependency.

Parsers compose by nesting. There is no orchestration layer that "knows about"
all the parsers — each parser receives a context, processes its scope, and
returns a result. Composition is structural, not procedural.

### 2.3 Provenance and inspectability

Every configuration value MUST be traceable to its source. Configliere tracks
which source provided each field's value — whether CLI argument, environment
variable, config-file entry, default, or none — and makes this information
available through the info tree.

The project's goal is that the origin of every configuration value should be
inspectable and never mysterious.

### 2.4 Type inference as a first-class requirement

TypeScript type inference for parser composition is a correctness requirement,
not a cosmetic concern. When a user composes parsers from literal object maps,
the resulting types MUST be inferred without explicit annotation. Inference
failures in the library's generic signatures are treated as bugs with blocking
priority.

### 2.5 Structural derivation of help and introspection

Help text and parser introspection MUST derive from parser structure, not from
manually maintained documentation. Each parser contributes to help through its
`inspect()` method. There is no separate documentation layer. `format()` renders
what `inspect()` reports.

### 2.6 Compositional phased parsing

Multi-phase parsing (where later phases depend on earlier results or runtime IO)
MUST remain compositional. There is no "preamble hack," callback escape hatch,
or side-channel architecture. Each phase is a parser. Phases compose by nesting
— a parser's value may contain a factory function that produces the next phase's
parser.

### 2.7 Resistance to special cases

Configliere is suspicious of special cases. When a behavior appears to require
special handling, the preferred response is to find a general mechanism.
`program()` is not architecturally special — it is a parser whose dependency
type happens to be `void`. `inject()` is not architecturally special — it is a
parser whose value happens to be a function.

---

## 3. Terminology

**Parser.** A value with `parse()`, `inspect()`, and `help()` methods that
processes a `ParseContext` and produces a typed result. Parsers are the
fundamental building block.

**Parser composition.** Building larger parsers from smaller ones by nesting.
`object()` composes fields. `commands()` composes command variants. Each
composition level preserves type inference.

**Field.** A parser for a single typed value, backed by a Standard Schema
validator. A field is the leaf node in a parser tree. It knows how to extract
its value from CLI args, env vars, and config-file values.

**Object parser.** A parser that composes named fields into a typed object.
`object({ port: field(type("number")), host: field(type("string")) })` produces
`Parser<{ port: number; host: string }>`.

**Commands parser.** A parser that dispatches to one of several named command
parsers based on the first positional CLI argument. Each command has its own
inner parser. Commands introduces scoping for config-file values and environment
variables.

**Program.** A parser that screens for `--help` and `--version` flags, sets the
root program name, and delegates to a config parser. Program wraps any parser to
provide CLI entry-point behavior.

**Parse result.** The outcome of parsing: `Done<T>` (success with typed value)
or `Fail` (failure with error). Both carry a `remainder` of unconsumed input.

**Remainder.** The unconsumed portion of input after a parser has attempted to
match what it recognizes. "Did not consume" means "did not match," not "did not
reach due to early termination." Remainder flows upward from child to parent.

**Source.** A record of where a field's value came from:
`{ sourceName, sourceType, value, issues }`. Source types include `"none"`,
`"default"`, `"value"` (config file or CLI-injected), and `"env"`.

**Provenance.** The traceability chain from a field's resolved value back to the
source that provided it. Provenance is visible through `FieldInfo.source` and
`FieldInfo.sources`.

**Help.** Human-readable text describing a parser's fields, options, arguments,
and commands. Help is derived structurally from `inspect()`, not maintained
separately.

**Inspect.** The canonical parser operation. `inspect(ctx: ParseContext)` walks
the parser tree and returns a `ParserInfo<T>` containing the parse result, help
metadata, source information, and child info. `parse()` and `help()` derive from
`inspect()`.

**ParseContext.** The immutable, downward-flowing context that carries input
data (args, values, envs) and structural scope (progname, path, commands map)
through the parser tree.

**Info tree / ParserInfo.** The tree of `ParserInfo<T>` nodes produced by
`inspect()`. The info tree mirrors the parser tree. Each node contains the parse
result, remainder, help metadata, and type-specific fields (e.g., `attrs` for
objects, `commands` for command sets).

**Command selection.** The act of choosing which command to execute. Command
selection is based on CLI arguments only — the first positional argument (or
alias, or default).

**Command configuration.** The act of providing values to the selected command's
fields. Command configuration is tripartite — CLI args, env vars, and
config-file values all contribute.

**Phase.** A parse step in a multi-step pipeline. Phase 1 runs, the application
does IO (e.g., loads a config file), then phase 2 runs with enriched input.

**Dependency-generated phase.** A phase whose parser is constructed at runtime
from a dependency value. The parser does not exist until the dependency is
resolved. Represented by `inject((dep: D) => Parser<T>)`.

**Env scoping / command prefix.** The process by which `commands()` transforms
the environment-variable map for a matched command, stripping a command-name
prefix (e.g., `SERVE_PORT` → `PORT` inside the `serve` command) and narrowing
config-file values to the command's subtree.

---

## 4. Core Abstractions

### 4.1 What a parser represents

A parser is a composable unit that, given a `ParseContext`, produces a
`ParserInfo<T>` containing:

- a parse result (`Done<T>` or `Fail`),
- a remainder of unconsumed input,
- pre-classified help metadata,
- and type-specific structural information.

Every parser implements `parse()`, `inspect()`, and `help()`. The current
architectural shape of the parser interface is:

```ts
// Illustrative — reflects the current observed interface shape.
// Exact signatures may evolve; what is normative is the behavioral
// contract described in §4.2, not this specific type definition.
interface Parser<T, Info extends ParserInfo<T> = ParserInfo<T>> {
  parse(input?: Input, ctx?: ParseContext): ParseResult<T>;
  inspect(ctx: ParseContext): Info;
  help(input?: Input, ctx?: ParseContext): string;
}
```

### 4.2 Parse vs. inspect responsibilities

The current intended architectural direction is that `inspect()` is the
canonical operation. It does the actual work of walking the parser tree,
computing results, and building the info tree.

`parse()` SHOULD be equivalent to `inspect(ctx ?? createContext(input)).result`.

`help()` SHOULD be equivalent to `format(inspect(ctx ?? createContext(input)))`.

Implementations SHOULD NOT maintain separate code paths for parsing, help
generation, or introspection. The project's clear direction is that all three
derive from `inspect()`.

> **Current intended contract.** The "inspect is the workhorse" principle is
> supported by direct statements from the project lead and a full observed
> refactor across all parsers. This specification treats it as the strongest
> available architectural direction. However, the exact API contract (whether
> `parse()` literally calls `inspect()` or merely produces equivalent results)
> is implementation-defined. What the spec requires is behavioral equivalence:
> `parse()` and `inspect().result` MUST agree for the same input.

### 4.3 Structural composition expectations

Parser composition MUST preserve type inference (§13). Container parsers
(object, commands, program) MUST embed child parsers and propagate context
downward. Each parser MUST build its own `help` contribution in its `inspect()`
method — help MUST NOT be reverse-engineered from the info tree by a separate
classifier.

### 4.4 Parser-local vs. orchestration above parsers

`inspect()` is authoritative for any individual parser. Concerns that span
multiple parsers — specifically cross-phase help assembly (§12.4) — sit above
`inspect()` and are the application's responsibility.

---

## 5. Input Model

### 5.1 Supported input sources

Configliere supports three input sources:

1. **CLI arguments** (`args: string[]`). Parsed from the command line. Options
   are `--name value` or `--name=value`. Boolean fields are switches (`--debug`
   / `--no-debug`). Positional arguments are declared with `cli.argument()`.

2. **Environment variables**
   (`envs: { name: string; value: Record<string, string> }[]`). Each env source
   is a named record of string key-value pairs. Field paths determine env-key
   lookup (§10.1). String values are coerced to the field's type.

3. **Config-file object values** (`values: { name: string; value: unknown }[]`).
   Each value source is a named object (typically from a parsed JSON/YAML file).
   Object keys correspond to field names.

### 5.2 What equivalence means

Every field SHOULD be configurable through every source, subject to the
asymmetries described in §2.1. The same Standard Schema validator MUST validate
values regardless of which source provides them. Source priority (§6.3)
determines which value wins when multiple sources provide conflicting values.

### 5.3 What equivalence does not mean

Source equivalence has explicit exceptions and asymmetries, detailed in §2.1.
The most significant: command selection is CLI-only (§9.1), env vars require
string coercion, and not every structural configuration concept has a direct
env-var equivalent.

---

## 6. Source Model and Provenance

### 6.1 Source identity

Every source has a `sourceName` (e.g., `"cli"`, `"env"`, `"config.json"`) and a
`sourceType` (one of `"none"`, `"default"`, `"value"`, `"env"`).

### 6.2 Source tracking

`FieldInfo<T>` MUST always carry:

- `source: Source<T>` — the winning source (the one whose value was used),
- `sources: Source<T>[]` — all attempted sources in priority order.

Source and sources MUST NOT be optional. They MUST be populated for every parsed
field, regardless of whether the value came from explicit input or a default.

### 6.3 Source priority

This specification provisionally defines the following priority order (highest
to lowest):

1. CLI arguments (injected as `"value"` sources by `scopeInput`)
2. Environment variables (`"env"`)
3. Config-file object values (`"value"`)
4. Default value (`"default"`)
5. None / undefined (`"none"`)

The winner is the last valid (no validation issues) source in collection order.
Since sources are collected in increasing priority order, `findLast` selects the
highest-priority valid source.

> **Current intended contract.** This priority order is implemented in observed
> code and matches the traditional `cli > env > config > default > none`
> convention for CLI tools. The project lead has not explicitly stated this
> ordering as doctrine, but it is consistent with established conventions and
> with the observed implementation. This specification treats it as
> provisionally normative — the strongest available reading of the current
> architecture, likely to be confirmed rather than revised.

### 6.4 Provenance visibility

Help output SHOULD display the winning source's provenance (e.g.,
`[env: PORT=8080]`, `[default: 3000]`, `[config.json: port=8080]`). Invalid
sources (those with validation issues) MUST NOT be displayed in help output.

### 6.5 Known provenance limitation: env-var identity after scoping

> **Open.** When `scope()` transforms the env map for a command (§10.2), the
> original env-var key is lost. A user who sets `SERVE_PORT=8080` sees
> `[env: PORT=8080]` in help output — the connection between what they set and
> what the system reports is obscured. This is a tension with the project's
> inspectability emphasis. The spec does not currently require tracking
> pre-scoping env-var identity, but acknowledges this as a gap in the provenance
> model.

---

## 7. Precedence Model

### 7.1 Field-level precedence

Within a single field, the precedence model is as defined in §6.3: CLI > env >
config value > default > none. This MUST be consistent across all parser types.

### 7.2 Command-scoped precedence

When a field is inside a command, the field sees a _scoped_ environment and
value set (§10). Within that scoped set, the same precedence model applies. The
scoping itself does not change precedence — it changes which values are visible.

### 7.3 Scoped vs. global env-var precedence

> **Transitional.** When both a global env var (e.g., `PORT=3000`) and a
> command-scoped env var (e.g., `SERVE_PORT=8080`) are present, the scoped value
> SHOULD take precedence. The current implementation achieves this only when the
> scoped key appears after the global key in `Object.entries()` iteration order.
> Implementations SHOULD use a two-pass approach (process non-prefixed keys
> first, then overwrite with prefix-stripped keys) to guarantee scoped-wins
> regardless of input ordering.

---

## 8. Parsing Model

### 8.1 `field(schema, ...mods)`

**Role:** Parses a single typed value from the available sources.

**Contract:**

- MUST validate the value against the provided Standard Schema.
- MUST collect all sources (none, default, values, envs) and pick the
  highest-priority valid one.
- MUST derive its env-var key from `ctx.path` (§10.1).
- MUST report all attempted sources in `FieldInfo.sources`.
- MUST classify itself as an argument (if `argument: true`) or an option in its
  `help` contribution.

**Type expectation:** `field(type("number"))` MUST produce
`Parser<number, FieldInfo<number>>` without annotation.

### 8.2 `object(attrs)`

**Role:** Composes named fields (or partial parser entries) into a typed object.

**Contract:**

- MUST iterate child entries and call `child.inspect(childCtx)` for each, with
  `ctx.path` extended by the child's key.
- MUST collect child help items (args, opts, commands) into its own `help`.
- MUST handle metadata-only entries (e.g., `{ description: "..." }`) by
  defaulting to `field(optionalBoolean)`.
- MUST scope CLI args by matching against child field paths (via `scopeInput`).
- MUST scope config-file values by extracting each child's key from value
  objects.
- MUST parse known options interspersed with unrecognized tokens. When no field
  matcher claims a token, skip it, preserve it in remainder, and continue
  matching. `--` terminates option processing; `--` and all subsequent tokens go
  to remainder as-is. Unrecognized tokens appear in remainder in original
  relative order.

**Type expectation:**
`object({ port: field(type("number")), host: field(type("string")) })` MUST
produce `Parser<{ port: number; host: string }>` without annotation.

### 8.3 `commands(map, opts?)`

**Role:** Dispatches to one of several named command parsers based on CLI
argument matching.

**Contract:**

- MUST match the first positional CLI argument against command names and
  aliases.
- MUST support a `default` option specifying a fallback command when no name
  matches.
- MUST scope config-file values and environment variables for each command via
  `scope()` (§10).
- MUST build `help.commands` listing all available commands.
- MUST NOT select commands based on config-file keys or env-var values (§9.1).

**Type expectation:** `commands({ run: object({...}), build: object({...}) })`
MUST infer a parser whose value type is a union of `Command<Config, Name>` with
literal string name types.

### 8.4 `program(opts)`

**Role:** Provides CLI entry-point behavior — help/version flag screening, root
progname, and delegation to a config parser.

**Contract:**

- MUST screen for `--help`/`-h` and `--version`/`-v` before delegating to the
  config parser.
- MUST also detect `--help`/`-h` and `--version`/`-v` in the config parser's
  remainder after delegation, for tokens that no sub-parser handled. When a
  sub-parser (e.g., `command()`) handles `--help`, it removes the token from its
  result remainder, so it will not be detected again at the program level.
- `--help`/`-h` and `--version`/`-v` MUST be detected regardless of position in
  argv (before `--`). Detection includes consumption: the handled token MUST NOT
  appear in `result.remainder.args`.
- MUST set `progname: [name]` in the root context.
- MUST produce `Parser<Program<T>>` where `T` is the config parser's value type.
- MUST merge preamble options (help, version) into the help output alongside the
  config parser's help.

> **Subcommand help routing.** When `program()` wraps `commands()`,
> subcommand-targeted help (e.g., `myapp dev --help`) is handled by
> `command()`, not by `program()`. `command()` runs the inner parser first with
> all args; if `--help` survives in the inner parser's remainder (no descendant
> consumed it), `command()` produces help for that command. `program()` only
> catches help/version tokens that survive into the config parser's remainder —
> i.e., tokens that no sub-parser handled.

> **Provisional: Help-validation interaction (Decision B).** When `--help` is
> detected alongside missing required fields, `command()` runs the inner parser
> with all args; whether the inner parse succeeds or fails, the command still
> returns `ok: true` with `help: true` if `--help` is found in remainder. At the
> program level, the `(main.result.ok || help || ver)` guard ensures `ok: true`
> when help is detected. Whether finer-grained help-mode validation suppression
> is needed is deferred.

### 8.5 `inject(fn)`

**Role:** Defers a parse phase behind a dependency. The factory function `fn`
produces a parser when called with the dependency value.

**Contract:**

- In the current architecture, the returned parser's value is the resolve
  function `(dep: D) => Parser<T>`. [Current API shape — the
  resolve-function-as-value pattern is the established approach, though the
  exact value representation is an API design choice that could evolve.]
- MUST pass `ParseContext` through and bake it into the resolved parser via
  closure. [Core to phased parsing — without this, resolved parsers lose their
  position in the hierarchy.]
- MUST contribute empty help (no args, opts, or commands) — the resolved parser
  has its own help. [Directly observed and architecturally required — inject
  cannot describe what it doesn't yet know.]
- SHOULD NOT call the factory function during `inspect()` unless the dependency
  type is legitimately satisfiable. When `D` is `void`, calling the factory
  during `inspect()` is valid (this is how `program()` resolves its config
  parser). For non-void `D`, calling the factory with a placeholder or invalid
  argument is not acceptable under the current design direction.

> **Note.** The project lead stated "probing is disqualifying" but then
> clarified "just not with invalid arguments." The boundary between valid and
> invalid probing is not fully settled. The clearest rule: a factory may be
> called during `inspect()` only with a value of its declared dependency type.

### 8.6 `constant(value)`

**Role:** A parser that always succeeds with a fixed value.

**Contract:**

- MUST return `{ ok: true, value }` regardless of input.
- MUST contribute empty help.

---

## 9. Command Model

### 9.1 Command selection

Command selection MUST be based on CLI arguments only. The first positional
argument is matched against command names and aliases. If no match is found and
a `default` is specified, the default command is selected. If no match and no
default, parsing fails with a `NoCommandMatchError`.

Commands MUST NOT be selected based on config-file keys or environment
variables.

> **Evidence basis.** This is the best-evidenced design decision in the command
> model. Command selection by config-file key was implemented and then
> explicitly removed by the project lead. Env-var-based selection was never
> implemented. This specification treats CLI-only selection as normative based
> on the strength of that decision, while acknowledging that the project lead
> has not explicitly stated it as permanent doctrine — only actively chosen it
> over the alternative.

### 9.2 Command configuration

Once a command is selected, its fields MUST be configurable through all three
sources (CLI, env, config file). The `scope()` function (§10) narrows the input
for each command.

### 9.3 Default commands

When `commands(map, { default: "name" })` specifies a default, and no CLI
argument matches any command name or alias, the default command MUST be
selected. The default command MUST receive scoped input identically to
explicitly selected commands.

### 9.4 Alias behavior

Command aliases are alternative names for matching. When a command is matched by
alias, scoping SHOULD use the canonical command name (the key in the commands
map), not the alias.

> **Note.** This behavior is inferred from the code structure (`match()` returns
> canonical entries) but has not been directly tested or explicitly stated by
> the project lead. The spec treats it as the intended direction.

### 9.5 Canonical naming

The canonical command name — the key in the commands map — is authoritative for:

- env-var prefix derivation,
- config-file key extraction,
- progname construction,
- help display.

Aliases are used only for CLI matching.

### 9.6 Nested commands

> **Open.** Nested commands (commands within commands) are structurally
> supported by the parser architecture. The env-scoping mechanism would compose
> by successive prefix stripping if applied recursively. However, nested command
> env scoping is not tested, not discussed in the design transcripts, and not
> confirmed as an intended use case. Implementations MAY support nested
> commands, but this specification does not guarantee specific nested
> env-scoping behavior.

---

## 10. Environment-Variable Scoping Model

### 10.1 Path-based env key derivation

A field's env-var key MUST be derived from its `ctx.path`:

1. Each path segment is converted to `UPPER_SNAKE_CASE`.
2. Segments are joined with `_`.

Example: path `["port"]` → key `PORT`. Path `["serverPort"]` → key
`SERVER_PORT`. Path `["server", "port"]` → key `SERVER_PORT`.

### 10.2 Command prefix stripping

When `commands()` scopes input for a matched command, the `scope()` function
MUST:

1. **For config-file values:** Extract the subtree keyed by the command name.
   `{ serve: { port: 8080 } }` → `{ port: 8080 }` for command `serve`.

2. **For env vars:** Create a new env map where:
   - Keys starting with the command prefix (e.g., `SERVE_`) are stripped of the
     prefix (e.g., `SERVE_PORT` → `PORT`).
   - Keys not starting with the prefix are passed through unchanged.

The command prefix MUST be derived as
`toSnake(commandName).toUpperCase() + "_"`.

> **Implementation note.** The current implementation uses the `ts-case-convert`
> library for `toSnake` conversion. Whether the spec should define conversion
> rules independently of this library is an open question (§17). What is
> normative: the prefix is the UPPER_SNAKE_CASE form of the command name
> followed by `_`.

### 10.3 Global env-var pass-through

> **Transitional.** The current implementation passes non-prefixed env vars
> through into commands, so a global `DATABASE_URL` is visible inside any
> command. This behavior is consistent with the project's philosophy but has not
> been explicitly confirmed as a deliberate design choice. Implementations
> SHOULD maintain this pass-through behavior. The specification may strengthen
> this to MUST in a future version.

### 10.4 Alias names and env keys

Alias names SHOULD NOT affect env-var prefix derivation. The canonical command
name SHOULD be used for the prefix. If `serve` has alias `s`, the env prefix is
`SERVE_`, not `S_`.

> **Note.** This follows from the code structure (canonical name is returned by
> `match()` and passed to `scope()`), not from an explicit design statement. The
> spec treats canonical-name scoping as the intended direction.

### 10.5 Known limitation: prefix collision

When a field name produces an env key that starts with the command prefix,
`scope()` strips the prefix before the field can see it. Example: `serveMode`
inside `serve` → env key `SERVE_MODE` → stripped to `MODE` by scoping → field
looks for `SERVE_MODE` but finds only `MODE`.

> **Open.** This collision is a known limitation of the prefix-stripping
> algorithm. Users SHOULD avoid field names that produce env keys beginning with
> the command prefix. Whether `scope()` should be made schema-aware to avoid
> false prefix matches is an open design question.

---

## 11. Help and Introspection Model

### 11.1 `inspect()` as the architectural center

The current architectural direction is that `inspect(ctx: ParseContext)` serves
as the canonical parser operation. In this model, it:

1. Accepts a `ParseContext` with input data and structural scope.
2. Walks the parser tree, calling child `inspect()` with derived contexts.
3. Returns a `ParserInfo<T>` containing parse result, help metadata, provenance,
   child info, and remainder.

`parse()` and `help()` SHOULD derive from `inspect()` (see §4.2). `parse()` and
`inspect().result` MUST agree for the same input. Implementations SHOULD NOT
maintain separate code paths for parsing vs. introspection.

> **Transitional architectural direction.** This section describes the clearest
> current direction of the architecture, supported by direct statements and
> observed refactors. The exact boundary between "inspect is the workhorse" as a
> hard implementation requirement vs. a guiding principle is still being
> established. What is firmly settled: `parse()` results and `inspect()` results
> MUST be consistent. What is an architectural direction: that `inspect()` is
> literally the single entry point from which parse and help derive.

### 11.2 `ParseContext`

`ParseContext` carries both input data and structural scope. It MUST flow
downward immutably — parents create new contexts for children; contexts MUST NOT
be mutated.

Current fields:

| Field                                                     | Category | Purpose                             |
| --------------------------------------------------------- | -------- | ----------------------------------- |
| `progname: string[]`                                      | Scope    | Position in program name hierarchy  |
| `path: string[]`                                          | Scope    | Position in schema object hierarchy |
| `commands: Record<string, Parser<...>>`                   | Scope    | Sibling commands map                |
| `args: string[]`                                          | Input    | CLI arguments                       |
| `values: { name: string; value: unknown }[]`              | Input    | Config-file values                  |
| `envs: { name: string; value: Record<string, string> }[]` | Input    | Environment variables               |

`createContext(input?: Input): ParseContext` bridges from user-facing `Input` to
internal `ParseContext`, producing empty structural fields.

> **Transitional.** The six-field structure above describes the current
> implementation. Whether this exact field set is canonical or subject to
> evolution is not yet decided. What is settled: ParseContext carries input data
> and structural scope, and flows downward immutably. What may evolve: the exact
> set of scope fields, and whether `commands` belongs on the context or on the
> parser itself.

### 11.3 `ParserInfo<T>` and the info tree

The current `ParserInfo<T>` carries the following base fields:

- `type: string` — discriminator for the info subtype
- `parser: Parser<T>` — back-reference to the producing parser
- `result: ParseResult<T>` — the parse outcome
- `remainder: Input` — unconsumed input
- `help: HelpInfo` — pre-classified help metadata

These fields MUST be present on every info node. The `result`, `remainder`, and
`help` fields are the architectural minimum — they ensure that `parse()` can
derive from `inspect().result` and that help can derive from `inspect().help`.

Specialized info types extend `ParserInfo<T>` with type-specific fields. The
current observed set:

- `FieldInfo<T>`: path, source, sources, required, argument, array, aliases,
  description, default, boolean
- `ObjectInfo<T>`: `attrs: { [K in keyof T]: ParserInfo<T[K]> }`
- `CommandInfo<T>`: name, description, aliases, config, commands
- `CommandsInfo<T>`: `commands: { [C in T as C["name"]]: CommandInfo<C> }`
- `ProgramInfo<T>`: name, version, `main: ParserInfo<T>`
- `ConstantInfo<T>`: value

> **Note.** The exact field set on each info subtype reflects the current
> implementation. The base fields (`result`, `remainder`, `help`) are
> architecturally required. The `parser` back-reference and `type` discriminator
> are strongly evidenced. The specialized fields on each subtype are observed
> and consistent, but their exact set may evolve — for instance, whether
> `remainder` belongs on `ParserInfo` or on `ParseResult` has been questioned in
> transcripts. This specification treats the current shape as provisional.

### 11.4 Help derivation

Each parser MUST build its `help: HelpInfo` field in its `inspect()`:

- `field` → classifies itself as arg or opt
- `object` → collects children's help items
- `commands` → lists commands in `help.commands`
- `command` → resets help to its own config's items, sets progname
- `program` → merges preamble opts (help, version) with main help
- `inject` → empty help
- `constant` → empty help

`format()` reads `info.help` and renders it. Implementations SHOULD NOT use a
`classify()` function or `switch (info.type)` dispatcher that reverse-engineers
help from info types — each parser is responsible for building its own `help`
contribution.

> **Note.** An earlier `classify()` approach was explicitly rejected by the
> project lead: "`HelpInfo` is not really a thing. It should be ObjectInfo and
> it should just reference ParserInfo. Any type discrimination can happen in the
> actual format()." The per-parser help-building pattern is the clear intended
> direction.

### 11.5 Invariants

Help MUST NOT contain fake path fallbacks (e.g., `|| "field"`, `|| "object"`).

Progname MUST be consistently propagated. `program()` sets `progname: [name]`.
`command()` appends its name. Every container MUST propagate progname to
children.

> **Transitional.** The _mechanism_ for progname propagation — whether through
> `ParseContext.progname`, a mutable `Parser.progname` property, or a
> `ParserInfo.parent` field — has gone through multiple implementations during
> the project's evolution. The current observed code uses
> `ParseContext.progname`. This specification requires the invariant (progname
> is consistently propagated) without mandating the specific mechanism.

Path MUST be propagated through `ParseContext`. `object()` appends each child's
key. Fields use path for CLI option key derivation and env-var key mapping.

---

## 12. Phased Parsing Model

### 12.1 Static phased parsing

When both parsers are known at construction time, all help is available before
any phase executes. This is the simplest case and MUST be fully supported.

### 12.1.1 Interspersed extraction guarantee

A phase-1 parser MUST extract all known flags regardless of their position relative to tokens that belong to later phases. Because `object()` uses interspersed parsing (§8.2), a bootstrap parser defining `--config` but not a positional `<suite>` will successfully extract `--config` from `run ./suite --config app.json`, passing `run` and `./suite` through as remainder for phase-2.

### 12.2 Dependency-generated phases

`inject((dep: D) => Parser<T>)` represents a phase whose parser depends on
runtime state. The factory function produces the parser when called with the
dependency value.

The contract for `inject()` is defined in §8.5. The key phased-parsing
implications:

- When `D` is `void`, the factory MAY be called during `inspect()` (this is how
  `program()` resolves its config parser and provides full help).
- For non-void `D`, the factory SHOULD NOT be called until the caller provides a
  legitimate dependency value. Calling the factory with a placeholder or invalid
  argument to obtain a "preview" parser for help purposes is not acceptable
  under the current design direction (see §8.5 note on probing).
- After the caller resolves the dependency, the returned parser has baked
  context and full help is available through standard `inspect()`.

> **Note.** The now-removed `step()` combinator did call
> `resume(undefined as never)` to create a preview parser for help. This worked
> for cases where parser _structure_ was dependency-independent. Whether a
> similar mechanism should be reintroduced as an opt-in pattern (e.g.,
> `inject(fn, { preview: fn(defaultDeps) })`) remains an open design question.

### 12.3 What unified help can and cannot mean

Full exact pre-resolution help for a parser whose structure depends on an
unresolved dependency is **not achievable**. You cannot enumerate commands
contributed by plugins that haven't been loaded.

The spec defines the following help levels:

| Phase type                         | Pre-resolution help         | Post-resolution help           |
| ---------------------------------- | --------------------------- | ------------------------------ |
| Static                             | Complete                    | Complete                       |
| Enriched values (static structure) | Complete                    | Complete                       |
| Static structure, dynamic defaults | Structural preview possible | Complete                       |
| Dependency-generated structure     | Phase 1 only                | Complete                       |
| Recursive nesting                  | Phase 1 only per level      | Complete after all resolutions |

Implementations MUST NOT claim pre-resolution help is complete when it is only
partial. If a help formatter encounters an inject boundary, it MUST NOT silently
skip it and present the result as complete.

### 12.4 Cross-phase help assembly

Cross-phase help assembly — combining help from multiple `inspect()` results —
sits **above** `inspect()`. It is the application's responsibility, not a
per-parser concern.

After the application resolves a dependency and obtains the phase 2 parser, it
calls `inspect()` on that parser. The resolved parser has baked context, so its
help includes correct progname and remainder. The application combines phase 1
and phase 2 help.

> **Open.** Whether the library should provide a help-accumulation utility
> (e.g., `mergeHelp(info1, info2)`) or leave this entirely to the application is
> not yet specified.

### 12.5 Context baking

When `inject()` captures a `ParseContext` and the caller invokes the resolve
function, the returned parser MUST have the original context baked in. Calling
`parse()` or `inspect()` on the resolved parser MUST use the baked context
(progname, path, args, values, envs) without the caller needing to provide them
again.

> **Note.** Context baking is the mechanism that makes phased parsing ergonomic
> — it ensures the resolved parser "remembers" where it sits in the program
> hierarchy. The exact implementation (closure capture vs. explicit context
> parameter) is implementation-defined. What the spec requires is the behavioral
> invariant: the resolved parser behaves as if it has the original context.

---

## 13. Type Inference Contract

### 13.1 Guaranteed inference for literal composition

The following inference behaviors MUST hold without explicit annotation **when
parsers are composed using inline literal object maps** (the canonical use
case):

1. `object({ key: field(schema) })` MUST infer `Parser<{ key: SchemaType }>`.
2. `commands({ name: { ...object({...}) } })` MUST infer a parser whose type
   parameter is a union of `Command<Config, Name>` with literal `Name` strings.
3. `program({ config: parser })` MUST preserve the config parser's type through
   to `ProgramType`.
4. `field(schema)` MUST infer `Parser<SchemaType, FieldInfo<SchemaType>>`.
5. Types inferred at inner composition levels (field → object → commands →
   program) MUST survive to the outer level without collapsing to `unknown`.

These guarantees apply to the canonical case of literal composition. For
computed or dynamically constructed parser maps, see §13.5.

### 13.2 Extraction helpers

Configliere SHOULD provide type-level extraction helpers that take a parser type
(`typeof parser`) as input and extract useful derived types. The convention that
extraction helpers operate on _parser types_ (not on extracted value types) is
established by the project lead: "Everything with *Type should take as a
parameter a parser."

The current observed set of helpers includes:

- `ConfigType<P>` — extracts `T` from `Parser<T>`.
- `CommandsType<P>` — extracts the command union.
- `CommandType<P, N>` — extracts a single command member by name, prettified.
- `ProgramType<P>` — unwraps `Program<T>` to get `T`.

What is normative:

- The convention that extraction helpers operate on parser types, not on
  extracted value types. [Directly stated by the project lead.]
- Any provided extraction helper MUST produce correct types for the supported
  composition patterns.

What is the current intended direction but may evolve:

- The exact set and naming of helpers listed above is the current observed
  roster. Future versions may add, rename, or restructure these helpers as the
  type-level architecture matures.

> **Open.** Whether this set is complete — and in particular whether a
> `ConfigFileType` or similar helper for config-file authoring shapes is needed
> — is an unresolved question (see §13.7 and §17).

### 13.3 No hidden defaults

`Parser<T>` MUST NOT default `T` to `unknown` or `any`. A bare `Parser` without
a type argument MUST be a compile error. Generic interfaces and functions in the
public API MUST NOT default type parameters to `unknown` or `any`.

### 13.4 Forbidden patterns

Public API generic signatures MUST NOT use key-remapping patterns
(`[C in T as C["name"]]`) that TypeScript cannot reverse-infer from object
literals.

Type extraction helpers that may produce unions MUST NOT apply non-distributed
mapped type transformations (e.g., `{ [K in keyof T]: T[K] }` directly on a
union, which collapses to `{}`).

### 13.5 Computed maps and annotation

When command maps are built dynamically (via `reduce()`, `Object.fromEntries()`,
or similar), TypeScript may erase literal key types before `commands()` is
called. This is a TypeScript limitation, not a library defect.

This specification distinguishes two cases:

- **Fully runtime-derived maps** (keys from IO or runtime values): inference
  produces `unknown`. Explicit type annotation is REQUIRED. This is out of scope
  for the inference guarantee (§16).
- **Statically computable but TypeScript-widened maps** (keys derivable from
  static information, but erased by `Object.keys()` or `reduce()`): inference
  requires explicit annotation, but the annotation burden may be reducible. The
  `satisfies` operator is the RECOMMENDED pattern.

`commands()` MUST infer correctly from whatever type it receives — the
limitation is upstream of the library.

> **Open.** The exact boundary between "inference must work" and "annotation
> required" for statically-computable-but-widened maps is not precisely defined.
> Whether the library should invest in reducing annotation burden (via identity
> helpers, `const` generics, or documented patterns) is a product-design choice,
> not a settled contract question. See §17.

### 13.6 Display quality

TypeScript tooltip display (e.g., showing `CommandsOf<{...}>` instead of the
expanded union) is not under Configliere's control.

> **Non-normative.** Display quality is an ergonomic goal the project cares
> about but cannot guarantee. Implementations SHOULD pursue display improvements
> where possible, but display quality regressions are not treated with the same
> severity as inference correctness regressions.

### 13.7 Config-file type extraction

> **Open.** `ConfigType<P>` extracts the parsed runtime output type. For
> `object()` parsers, this coincides with the config-file authoring shape. For
> `commands()` parsers, it does not — the parsed output is a `Command<C, N>`
> union, while a config file would contain a record keyed by command name.
> Whether a separate extraction concept is needed for config-file typing is an
> open design question. See §17.

---

## 14. Error Model

### 14.1 Parse failure

When a field fails validation, `inspect()` MUST produce a `Fail` result with the
validation error. `ObjectValidationError` aggregates child failures with their
paths.

### 14.2 Command mismatch

When no command matches the input, `commands()` MUST produce a
`NoCommandMatchError` listing available commands.

### 14.3 Help on failure

When `program()` detects `--help`, it MUST produce help text even if the
underlying parse would fail. The help/version screening occurs before config
parsing.

### 14.4 Error provenance

Validation errors SHOULD include the field path and the failing source's
identity where possible.

---

## 15. Extension and Evolution Model

### 15.1 Parser composition as the extension mechanism

New functionality SHOULD be added through parser composition — new combinator
functions that return `Parser<T>` — not through special-case hooks or
configuration flags.

### 15.2 Phased/injected growth

Multi-phase parsing MUST remain compositional. New phases are added by nesting
`inject()` inside existing parsers. There MUST NOT be a global phase registry or
orchestration layer.

### 15.3 Command extension

New commands are added by extending the map passed to `commands()`. The type
system reflects the extension through union widening.

### 15.4 Schema enrichment

Configliere delegates field validation to Standard Schema. New schema libraries
can be adopted without changes to Configliere, as long as they implement the
Standard Schema specification.

### 15.5 Constraint against special cases

Implementations SHOULD NOT introduce behaviors that only work for specific
parser types (e.g., help features that only work with `program()` but not with
standalone `commands()`). When special behavior is needed, it SHOULD be
expressed through the type system (e.g., `D = void` making `inject()` resolvable
during inspect).

---

## 16. Explicit Non-Goals

The following are not supported by the current architecture. Each is graded by
the strength of evidence for its exclusion.

1. **Env-var-based command selection.** No `COMMAND=serve` mechanism exists.
   Commands are selected by CLI arguments only. [Not implemented; never
   discussed as a possibility.]

2. **Config-file-based command selection.** This was implemented and explicitly
   removed by the project lead. [Directly rejected — the strongest evidence for
   any non-goal in this list.]

3. **Exact inference for fully runtime-derived maps.** When keys come from
   runtime values (e.g., `Object.fromEntries(runtimeKeys.map(...))`), TypeScript
   erases literal types before Configliere's API is called. This is a TypeScript
   limitation, not a library defect. [Outside the supported model — not a design
   rejection, but a platform boundary.]

4. **Exact pre-resolution help for dependency-generated parser structure.** A
   parser whose commands depend on unresolved runtime state cannot enumerate
   those commands before resolution. [Architectural impossibility — not a design
   choice, but a logical consequence of the phased model.]

5. **Display-quality guarantees for TypeScript tooltips.** TypeScript controls
   how type aliases are displayed in editor tooltips. Configliere cares about
   display quality as an ergonomic goal but cannot guarantee it. [Outside the
   library's control — not a rejection, but a platform limitation.]

6. **Structure-only introspection without input.** `inspect()` requires a
   `ParseContext`. There is currently no "describe your structure without
   parsing" operation. [Not implemented; not requested in transcripts. Whether
   it _should_ be supported is an open question (§17), but it is not currently
   offered.]

7. **Automatic help accumulation across phases.** Cross-phase help assembly is
   currently the application's responsibility. [Not implemented. Whether the
   library should provide a utility is an open question (§17), but no such
   utility currently exists.]

---

## 17. Open Questions and Transitional Areas

The following areas are unresolved and MUST NOT be silently treated as settled:

1. **Provenance preservation of original env keys after scoping.** After
   `scope()` transforms env keys, the original key (e.g., `SERVE_PORT`) is lost.
   This conflicts with the project's inspectability emphasis. Whether to track
   pre-scoping identity is an open design question.

2. **Nested command env semantics.** Whether `API_USERS_PORT` should reach a
   `port` field inside `api > users` is mechanically plausible but untested and
   undiscussed. The spec does not guarantee specific nested-command env
   behavior.

3. **Config-file authoring type extraction.** `ConfigType<P>` extracts the
   parsed output type, not the config-file authoring shape. For commands, these
   differ. Whether a separate `ConfigFileType<P>` or equivalent is needed is
   unresolved.

4. **Computed-map inference boundary.** Where "inference must always work" stops
   and "annotation required" begins is not precisely defined for
   statically-computable-but-TypeScript-widened maps.

5. **Scoped-wins ordering guarantee.** Whether `scope()` must guarantee that
   command-prefixed env vars always beat global env vars of the same derived
   key, regardless of insertion order, is not yet normative.

6. **Prefix collision handling.** Whether `scope()` should be made schema-aware
   to avoid false prefix matches on field names is unresolved.

7. **`ParseContext` field set.** Whether the current six-field `ParseContext`
   structure is canonical or subject to evolution is not yet decided.

8. **Help accumulation API.** Whether the library provides a utility for
   combining help from multiple `inspect()` results across phases is not
   specified.

9. **Progname propagation mechanism.** The most recent observed code uses
   `ParseContext.progname`. Whether a mutable `Parser.progname` property or a
   `ParserInfo.parent` field also participate is an implementation detail that
   may evolve.

10. **Command-scoped help dispatch.** Whether `commands.help()` should match
    against args and delegate to the matched command's help, or always show the
    top-level listing, is unresolved.

11. **`toSnake` dependency.** Env-key derivation currently depends on the
    `ts-case-convert` library for `toSnake` conversion. Whether the spec should
    define conversion rules independently is open.

---

## 18. Normative Test Agenda

The following test families MUST be maintained. This section names required test
categories, not exhaustive test cases.

Each test item is marked by purpose:

- **[Verify current]** — confirms behavior observed working in the current
  implementation.
- **[Lock down contract]** — asserts an intended invariant that this
  specification treats as normative.

### 18.1 Source precedence

- CLI args beat env vars [Lock down contract]
- env vars beat config values [Lock down contract]
- config values beat defaults [Lock down contract]
- defaults beat none [Lock down contract]
- multiple sources provide valid values for the same field [Lock down contract]

### 18.2 Source provenance

- `FieldInfo.source` and `FieldInfo.sources` are always populated [Lock down
  contract]
- source types are correct [Verify current]
- the winning source is identified [Lock down contract]
- invalid sources are not displayed in help output [Verify current]

### 18.3 Object parsing

- correct type inference from literal maps [Lock down contract]
- value extraction from all three sources [Lock down contract]
- CLI arg matching via `scopeInput` [Verify current]
- path propagation to children [Lock down contract]
- metadata-only entry defaulting [Verify current]

### 18.4 Command selection and configuration

- command matching by name [Lock down contract]
- command matching by alias [Lock down contract]
- default command selection [Lock down contract]
- config-file value scoping by command key [Lock down contract]
- env-var scoping by command prefix [Lock down contract]
- tripartite configuration for selected commands [Lock down contract]
- `NoCommandMatchError` when no command matches [Verify current]

### 18.5 Environment-variable scoping

- scoped env var reaches the correct field [Verify current]
- global env var reaches a field inside a command [Lock down contract]
- scoped env wins over global env of the same derived key [Lock down contract]
- alias invocation uses canonical name for scoping [Lock down contract]
- default command receives scoped env vars [Lock down contract]

### 18.6 Help derivation

- `format()` reads `info.help` directly [Lock down contract]
- field classification (arg vs. opt) [Verify current]
- object collection of children's help items [Verify current]
- commands listing in help output [Verify current]
- program merging of preamble opts with main help [Verify current]
- progname propagation in help output [Lock down contract]

### 18.7 `inspect()` invariants

- `parse()` results and `inspect().result` agree for the same input [Lock down
  contract]
- `help()` output and `format(inspect())` agree for the same input [Lock down
  contract]
- every `ParserInfo` has result, remainder, and help [Lock down contract]
- container parsers embed child info [Verify current]
- `FieldInfo` always has source and sources [Lock down contract]

### 18.8 Phased parsing

- inject returns empty help [Verify current]
- resolved parser has full help [Lock down contract]
- resolved parser has baked context [Lock down contract]
- context (progname, args) flows through resolution [Lock down contract]

### 18.9 Type inference

Compile-time type tests:

- `object()` infers exact value type from literal map [Lock down contract]
- `commands()` infers exact command union with literal name strings [Lock down
  contract]
- `ConfigType` extracts `T` from `Parser<T>` [Lock down contract]
- `CommandType` extracts named command member [Lock down contract]
- `ProgramType` extracts inner config type [Lock down contract]
- `commands()` does not collapse to `Command<unknown, string>` [Lock down
  contract]
- `ConfigType` on command union does not collapse to `{}` [Lock down contract]
- bare `Parser` without type argument fails to compile [Lock down contract]

### 18.10 Helper extraction

Tests MUST verify that provided extraction helpers (currently `ConfigType`,
`CommandType`, `CommandsType`, `ProgramType`) extract correct types from parser
instances. [Lock down contract — for whatever helpers exist at the time.] If the
helper set evolves, tests MUST cover whatever helpers are provided.

### 18.11 Interspersed parsing and help detection

- `object()` interspersed parsing: flags before, after, and interleaved with unknown positionals; all-consume and no-consume cases [Verify current]
- `--` terminates option processing [Lock down contract]
- Remainder preserves original token order for unrecognized tokens [Lock down contract]
- `--help`/`-h` position-insensitive at both program and command level [Lock down contract]
- Subcommand help shape preserved: `config.help === true`, `config.text` present [Lock down contract]
- Handled help/version tokens do not appear in `result.remainder.args` [Lock down contract]
- Contextual args consumed during help are not in result remainder [Lock down contract]
- Phased parsing: phase-1 extracts known flags regardless of position [Verify current]
- Help-validation interaction: `--help` with missing required fields (observation, provisional) [Verify current]

---

_This specification is derived from reverse-engineering research across 13
transcript sessions and current library source code. Items marked **Open** or
**Transitional** represent areas where the evidence does not support firm
normative language. Interface snippets labeled **Illustrative** show the current
observed shape rather than an exact permanent contract. Evidence-graded notes
throughout distinguish settled contract from current intended direction and
provisional interpretation. The specification aims to be strong enough to guide
implementation and testing while remaining honest about what is established and
what is still being determined._
