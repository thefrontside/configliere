# Configliere invariants

These principles are drawn from the current rebuild and earlier design
transcripts. Current decisions take precedence over superseded architectures.
`★` marks principles that received especially enthusiastic assent.

The detailed phase-binding design is recorded in [Binding](./binding.md).

## Design

- ★ Sketch the ideal API first; write exact type expectations second; test
  third; implement last.
- ★ Hover types are part of the product.
- The primary generic represents the actual runtime value, not a definition tree
  or helper-type calculation.
- Definitions should read like configuration, not "config balls."
- Definitions are immutable function-composition pipelines.
- Any valid `A → B` transformation may participate in a pipeline.
- `extend()` packages context-free composition; `extend()` is identity.
- Static definitions contain enough metadata to render help and schemas without
  parsing input.
- Standard Schema validates values; it does not define source syntax or token
  grammar.
- Complexity may exist behind overloads and implementation-boundary casts, but
  not in user-facing types.

## Routing

- ★ Resolve the route before interpreting remaining tokens as parameters.
- The program name is identity, not part of its route: `/`, `/serve`,
  `/database/clean`.
- Command literals are routing tokens, not positional arguments.
- Every route is a distinct application entry point.
- Every route supports `HELP`.
- `VERSION` and `EXECUTE` exist only where declared.
- `command()` is exactly an executable `route()`.
- An executable route may still contain child routes.
- Controls are semantic methods, not special tokenizer token types.
- The deepest discoverable route owns the requested method.
- Control placement does not change the route: `app --help child` and
  `app child --help` target the child.
- Nothing after `--` participates in routing, controls, or option binding.
- There is always at least the root route; unmatched words become binding
  overflow rather than "route not found."
- Providers declare local names; mounting supplies route, namespace, and option
  prefixes.

## Input and claims

- Tokenization describes syntax only; bindings assign semantic meaning.
- Input is immutable.
- Tokens retain stable global indices and original order.
- Claims never make originally non-adjacent tokens adjacent.
- Parents establish scope; children claim only within that scope.
- Available input flows down; claims, issues, and models flow up.
- Claims plus remainder conserve the original input: nothing disappears or is
  claimed twice.
- Unknown tokens are diagnosed only after all applicable bindings have had an
  opportunity to claim them.
- The original CLI input is supplied once; continuations retain its unconsumed
  portion.

## Parameters and sources

- ★ A parameter introduces an address and a target value type.
- A binding reads a source's physical representation.
- A decoder interprets a captured representation.
- A schema validates the interpreted model value.
- ★ Binding failure means the source representation could not be captured.
- ★ Decoding failure means it was captured but could not be interpreted.
- ★ Schema failure means it was interpreted but is not a valid model value.
- CLI, environment, and JavaScript values have source-specific readers.
- CLI and environment readers may share decoders without sharing capture
  semantics.
- `switch()` owns boolean CLI grammar; schemas are never probed to infer token
  behavior.
- Source selection follows explicit precedence.
- A valid higher-priority winner is not invalidated by a bad shadowed source.
- ★ Shadowed invalid sources should remain available as diagnostics.
- A child configuration is validated through the child's value binding, not
  round-tripped through argv.

## Models

- The resolved route has a directly typed `model`.
- The result also carries path-addressed `models` for every matched route.
- Route identity and result projection are separate concerns.
- Namespacing is a mounting/address operation, not something plugin authors
  repeat locally.
- Exact route and method values discriminate the result union.

## Dynamic phases

- ★ Dynamic parsing is a typed pause, not baked-in discovery or asynchronous
  loading.
- Library parsing remains synchronous and pure; the application performs I/O
  between increments.
- Every route has at least one phase.
- Parameters belong to phases and are bound phase by phase.
- Phase parameter types and increment models are phase-local slices.
- A caller has already observed earlier increments; the final intent exposes the
  aggregate model.
- Once a phase is resolved, its values are immutable.
- Newly supplied values or environment sources apply only to future phases.
- A dynamic resolver returns an extension at its current pipeline position.
- The extension's return type determines the continuation type.
- `resume()` continues parsing; it never exposes the intermediate route.
- `resume()` accepts `Result<Requirement>`, allowing loader failures through the
  ordinary issue path.
- A failed requirement never invokes the resolver.
- `RequirementsOf<R>` preserves requirement order; `RequirementOf<R>` is its
  head.
- `ContinuationOf<R>` removes the current phase.
- The static result type says whether parsing yields another increment or an
  intent; callers should not need a runtime `done` check.
- Help and version may require resolving earlier phases when those phases can
  introduce the target route.

## Help and diagnostics

- ★ Help should feel free at every route depth.
- `printHelp()` accepts a Help intent and returns a string; it performs no I/O.
- `printVersion()` likewise renders rather than writes.
- Help, version, and execute share route resolution.
- Unsupported methods produce method-not-allowed, not malformed pseudo-intents.
- Issues should share one rich, normalized shape compatible with Standard Schema
  issues.
- Help may expose current values, winning sources, and shadowed invalid sources.
- Help intent normally precedes ordinary argument validation, except for phases
  required to discover the requested route.

## Tests

- ★ Behavioral tests should describe public parses, not internal composition
  machinery.
- Type tests exist where inference itself is the behavior.
- CLI-string fixtures and matchers such as `toHaveRoute()` and `toHaveModels()`
  should make intent visible.
- Do not test private search segments directly.
- Avoid loops and helper indirection when two literal assertions communicate the
  contract better.

## Still open

These have not been promoted to invariants:

- Exact shadowed-source warning policy.
- Holistic model transforms.
- Final alias syntax.
- Recursive-dynamic implementation details.
- The exact route, path, and path-addressed model context exposed by an
  increment.
- Recursive result typing for increments reached through child routes.
- Every edge of strict versus permissive option placement.
