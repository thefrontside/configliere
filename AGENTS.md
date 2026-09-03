# Configliere

Configuration for programs.

## Current state

Configliere is undergoing a ground-up rebuild. No implementation architecture is
established yet. Design from the bottom up with small API sketches, exact type
expectations, and tests before implementation. Do not carry architectural
assumptions forward from pre-rebuild history.

## Design references

- Read [`docs/insights.md`](docs/insights.md) before changing the architecture;
  it records the current design invariants and open questions.
- Read [`docs/binding.md`](docs/binding.md) before changing tokenization, route
  segmentation, phase binding, source precedence, Values, or Env handling.

## Conventions

### File layout

In all TypeScript modules, exported types and values appear at the top of the
file. Module-private types and values appear after all exported ones.

### Naming

Strongly prefer one-word variable and function names (e.g. `dir` not `tmpDir`,
`result` not `parseResult`).

### Testing

- Framework: `@std/testing/bdd` (`describe`/`it`) with `@std/expect`
- Tests live in `test/` and mirror the source layout.
- Runtime parser tests assert only observable parse outcomes, such as increments,
  intents, models, routes, and issues. Do not inspect definition internals such
  as phases, parameters, or children, even when publicly accessible.
- Do not test implementation mechanics such as resolver call counts, timing, or
  traversal order.
- When replacing an internal assertion, preserve its behavioral contract with
  an outcome-based test rather than dropping the coverage.

### Runtime and tooling

- **Runtime**: Deno
- **Registry**: JSR (`@frontside/configliere`)
- **Linting**: `deno lint` (excludes `prefer-const`)
- **Testing**: `deno task test`
- **Build**: `deno task build:npm` (dnt) and `deno task build:jsr`

### Dependencies

When adding dependencies to the import map in `deno.json`, strongly prefer
`npm:` specifiers over `jsr:` specifiers whenever a package is available on npm.
Some packages (e.g. `@std/*`, `@deno/*`) are only available on JSR, and that is
fine.

### Git

- Use gitmoji for commit messages
- Do not include `Co-Authored-By` trailers
