# Phase binding

`bindPhase()` is a source scheduler, not a source interpreter.

CLI, Values, and Env all attempt to supply values for parameters, but they do
not traverse their inputs in the same way. CLI is positional: its safely visible
input can grow as options and arguments consume words. Values and Env are
address sources: once the route and parameter address are known, their
visibility is stable.

The binding algorithm should preserve that distinction while giving every source
the same attempt protocol. The intended precedence is visible directly in its
structure:

```text
CLI fixed point
Env
Values
undefined
```

Adding another non-positional source should require one source adapter and one
entry in the ordered source list, not another branch in `bindPhase()`.

## Attempts and remainders

Every immutable source remainder belongs in one object so there is exactly one
place to propagate it:

```ts
interface Rest {
  readonly tokens: Tokenizer<Symbol>;
  readonly values: Values;
  readonly envs: Envs;
}
```

A source attempt must distinguish absence from a captured value that failed:

```ts
interface Binding<T> {
  readonly rest: Rest;
  readonly result: Result<T>;
}
```

The outcomes mean:

- `exists: false`: this source supplied nothing, so the next source may be
  tried.
- `exists: true` and `result.ok: true`: the source supplied a valid value and
  the parameter is settled.
- `exists: true` and `result.ok: false`: the source captured or supplied
  something invalid. The parameter is still settled and lower-priority sources
  are blocked.

A malformed CLI option is therefore an existing, failed attempt because it
claimed input. A decoding or schema error from a higher-priority source must not
disappear by silently selecting a lower-priority value.

Explicit `undefined` from a JavaScript value source is also present. It must be
distinguished from an absent property, must shadow lower-priority sources, and
must be passed to the schema.

Only after every source reports absence should the schema receive `undefined`.
This final validation is where required, optional, and defaulting schemas
diverge.

Source adapters share the attempt shape while retaining their own capture
mechanics:

```ts
fromCLI({ param, view, rest }): Maybe<Binding<unknown>>;
fromValues({ param, route, rest }): Maybe<Binding<unknown>>;
fromEnv({ param, route, rest }): Maybe<Binding<unknown>>;
```

CLI and Env decode captured text before validating it. Values are already
JavaScript values and go directly to schema validation.

## The CLI horizon

An unresolved CLI word may be either parameter data or a route selector that
cannot be discovered until a later dynamic phase. The parser cannot safely let
the current route inspect the suffix until that word's role is known.

The **horizon** is the first remaining word in the current route segment. It is
the inclusive boundary of safe lookahead. This is not a cursor: it does not
identify the current consumption position.

The horizon itself must be visible so an option or positional argument can prove
that the word is data by claiming it. The entire suffix after it remains hidden
because, if the horizon becomes a child selector, every following option belongs
to that child.

### Dynamic route discovery

Consider:

```text
index:    0       1        2       3       4
argv:    -c   app.json   auth0  --port   9001
                  ^
               horizon
view:    [--------------] |----- hidden -----|
```

The current phase may inspect indices 0 and 1. Its `config` parameter claims
`-c app.json`, proving that `app.json` is data. The next remaining word becomes
the horizon:

```text
index:    0       1        2       3       4
argv:    -c   app.json   auth0  --port   9001
                           ^
                        horizon
view:                    [---] |--- hidden ---|
```

Nothing in the current phase offers a claim for `auth0`. CLI binding has reached
a fixed point and must stop.

If `resume()` introduces an `auth0` route, route search can now claim index 2 as
its selector. The child receives `--port 9001`. Without the horizon, a parent
parameter named `port` could see through the unresolved word and steal the
child's option.

### Retrying provisional misses

Consider:

```text
--target  local  --port  9000  auth0
           ^
        horizon
```

Suppose `port` is visited before `target`.

During the first sweep, `port` cannot see `--port 9000`, so its miss is only
provisional. `target` claims `--target local`, consuming the horizon. The next
remaining word is now `9000`:

```text
--target  local  --port  9000  auth0
                            ^
                         horizon
```

The next sweep retries `port`, which claims `--port 9000`. The horizon then
moves to `auth0`:

```text
--target  local  --port  9000  auth0
                                  ^
                               horizon
```

No parameter offers a claim for it, so CLI binding stops. This is a fixed-point
calculation rather than an ordinary left-to-right cursor.

### Competing claims

Every pending reader inspects the same immutable view before any claim is
committed. If several readers offer claims, the claim beginning earliest in the
original argv wins. Exact ties preserve parameter declaration order.

For example:

```text
argv:       --port  9000  input.txt
option:     [-----------]
argument:           [--]
```

The option wins because its claim begins at `--port`; the positional reader
cannot steal `9000`. On the next step, the argument claims `input.txt`. Two
positional readers instead offer the same word, so their declaration order
decides which one receives it.

This arbitration comes entirely from proposed claims. Readers carry no
option-versus-argument tag, and custom readers participate in exactly the same
protocol. Failed reads compete normally, ensuring an invalid option still owns
the tokens it captured.

Route search always runs before phase binding. A currently discoverable route
therefore beats an option value. A route introduced only after the current
requirement cannot retroactively preempt a word legitimately consumed by the
current phase; the parser could not yet know that route name. Setter syntax is
the unambiguous escape hatch.

## Tokenizer support

There is one global tokenizer and one global claim ledger for a parse. A binding
phase needs borrowed, bounded views into that tokenizer rather than temporary
tokenizers whose claims later have to be reconstructed.

The central addition is a first-class view:

```ts
interface TokenInput<T> extends Iterable<T> {
  claimOne(/* ... */): Claim<T>;
  claimPair(/* ... */): Claim<T>;
  claimAll(/* ... */): Claim<T>;
}

class Tokenizer<T> implements TokenInput<T> {
  view(options: {
    range: TokenRange;
    through?: number;
  }): TokenInput<T>;
}
```

A view changes visibility only. It never owns claims. Every claim made through a
view returns a remainder rooted in the global tokenizer. As a result,
`bindPhase()` can propagate the returned tokenizer directly and never needs to:

1. Materialize the visible tokens.
2. Compare them with a temporary remainder.
3. Recover the claimed indices.
4. Replay those claims against the global tokenizer.

The tokenizer should materialize one stable token array and carry one cumulative
immutable set of claimed indices. Claims should not create an ever-deepening
stack of tokenizer iterators.

The remaining invariants are:

- Stable global token indices identify every claim.
- Claims leave holes; they never make originally non-adjacent tokens a pair.
- `through` is inclusive.
- An absent `through` means the full route segment is visible.
- Finding the first remaining word is CLI-binding policy, not generic tokenizer
  policy, and can remain a small binding helper.

Route segments are contiguous index intervals between selector tokens. The
existing segment start and end can therefore become a real range:

```ts
interface TokenRange {
  readonly start: number; // exclusive
  readonly end?: number; // exclusive
}
```

Claimed tokens leave holes inside the interval. There is no need to copy token
arrays into each segment.

## Target `bindPhase()` loop

The target implementation is deliberately small:

```ts
function bindPhase(options: BindPhaseOptions): PhaseBinding {
  let { phase, segment } = options;
  let rest = options.rest;

  let pending = new Map(
    Object.entries(phase.params) as [string, Param<string, unknown>][],
  );
  let results = new Map<string, Result<unknown>>();

  function accept(
    param: Param<string, unknown>,
    attempt: Maybe<Binding<unknown>>,
  ): void {
    if (!attempt.exists) {
      return;
    }

    rest = attempt.value.rest;
    results.set(param.name, attempt.value.result);
    pending.delete(param.name);
  }

  // Positional source: arbitrate claims until no reader can make progress.
  while (true) {
    let horizon = firstWord(rest.tokens, segment.range);
    let offer;

    for (let param of pending.values()) {
      let view = rest.tokens.view({
        range: segment.range,
        through: horizon?.index,
      });
      let read = param.cli.read(view);

      if (read.result.ok && !read.result.value.exists) {
        continue;
      }

      let index = earliest(read.claim.tokens);
      if (!offer || index < offer.index) {
        offer = { param, read, index };
      }
    }

    if (!offer) {
      break;
    }

    accept(offer.param, fromRead(offer.param, offer.read, rest));
  }

  // Stable address sources: array order is precedence.
  for (let source of [fromEnv, fromValues]) {
    for (let param of pending.values()) {
      accept(
        param,
        source({
          param,
          route: segment.path,
          rest,
        }),
      );
    }
  }

  // Absence is conclusive only after every source misses.
  for (let param of pending.values()) {
    results.set(
      param.name,
      validate(param, undefined, [param.name]),
    );
  }

  return collect({ rest, results });
}
```

The source-outer address loop makes precedence explicit. Deleting a parameter
from `pending` on every existing attempt prevents fallback after invalid input.
Recomputing proposals after each committed claim advances the horizon without
letting one reader observe another reader's speculative remainder.

When the final word is consumed, the absent horizon creates an unbounded view,
which exposes trailing flags or setters. The loop terminates when no reader
offers another claim.

## Parser integration

A phase owns the introduction of its value and environment sources; parser state
owns their lifetime after introduction.

When a phase becomes active, mount its newly declared sources at the current
route path:

```ts
rest = {
  ...rest,
  values: rest.values.mount(segment.path, phase.values),
  envs: rest.envs.mount(segment.path, phase.envs),
};
```

Those sources remain available to every downstream phase. Input-level Values and
Env sources are mounted at `/` before the first phase. Sources introduced on a
child route are mounted at that child's route path. Sources introduced by a
dynamic continuation become visible only after that continuation is resumed.

Parser state should carry `rest` as one value and replace it wholesale with the
phase result:

```ts
state = {
  ...state,
  rest: binding.rest,
};
```

This prevents each new source family from creating another independently
forgotten remainder assignment. Phase stitching must also concatenate source
declarations just as it merges phase parameters and routes.

Shadowed-source diagnostics should remain a later, non-claiming inspection or
audit pass. They must not complicate or weaken winner selection in the primary
binding loop.

## Behavioral coverage

The design should be established with observable tests for these cases:

- A claim through a token view updates the global tokenizer while preserving
  hidden tokens.
- Consuming the horizon exposes the next word and retries previously absent
  parameters.
- A stable horizon leaves the entire suffix untouched.
- A named option claim outranks an overlapping positional claim without reader
  metadata.
- Positional readers retain declaration order when they offer the same word.
- CLI overrides Values even when its option is not visible until a later sweep.
- Env overrides Values when that is the declared source order.
- Invalid CLI blocks valid Env and Values.
- Invalid Env blocks valid Values.
- Only total absence invokes required, optional, or defaulting schema behavior.
- A dynamically introduced child receives every token after its selector.
- Sources introduced by a phase become available at that phase and persist
  downstream.

The essential simplification is not to pretend that CLI, Values, and Env have
identical traversal mechanics. They have identical attempt semantics, but CLI
alone has a moving visibility boundary. Keeping that distinction explicit is
what prevents source binding from becoming a collection of intertwined special
cases.
