# Configliere

Functional configuration parser that validates all program inputs (config files,
environment variables, CLI options) ahead of time using a single schema based on
the [Standard Schema](https://standardschema.dev) spec.

## Architecture

Configliere is a parser-combinator library. Small parsers compose into larger
ones. Every parser implements the `Parser` interface from `lib/types.ts` and
returns an `Increment` — either `Done|Fail` for single-step parsers or
`Next|Fail` for multi-step (phased) parsers.

### Key design concepts

- **Source tracking**: Every parsed value carries metadata about where it came

## Conventions

### File layout

In all TypeScript modules, exported types and values appear at the top of the
file. Module-private types and values appear after all exported ones.

### Naming

Strongly prefer one-word variable and function names (e.g. `dir` not `tmpDir`,
`result` not `parseResult`).

### Testing

- Framework: `@std/testing/bdd` (`describe`/`it`) with `@std/expect`
- Schema library in tests: `arktype` (via `type()`)
- Test helpers in `test/test-helpers.ts`: `parseOk()` and `parseNotOk()` wrap
  `parseSync` with assertions
- Tests live in `test/` and mirror `lib/` module names (e.g.
  `test/field.test.ts`)

### Runtime and tooling

- **Runtime**: Deno
- **Registry**: JSR (`@frontside/configliere`)
- **Linting**: `deno lint` (excludes `prefer-const` and `require-yield`)
- **Testing**: `deno test`
- **Examples**: Files in `examples/` must compile (`deno check`) and run
  (`deno run`) without errors
- **Build**: `deno task build:npm` (dnt) and `deno task build:jsr`

### Dependencies

When adding dependencies to the import map in `deno.json`, strongly prefer
`npm:` specifiers over `jsr:` specifiers whenever a package is available on npm.
Some packages (e.g. `@std/*`, `@deno/*`) are only available on JSR, and that is
fine.

### Git

- Use gitmoji for commit messages
- Do not include `Co-Authored-By` trailers
