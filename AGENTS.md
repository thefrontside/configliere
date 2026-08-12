# Configliere

Configuration for programs.

## Current state

Configliere is undergoing a ground-up rebuild. No implementation architecture is
established yet. Design from the bottom up with small API sketches, exact type
expectations, and tests before implementation. Do not carry architectural
assumptions forward from pre-rebuild history.

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
