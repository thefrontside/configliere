import type { Field, Issue, Source, Spec } from "./types.ts";

export class Missing<S extends Spec, K extends keyof S> implements Issue<S> {
  constructor(public field: Field<S, K>, public source: Source<S, K>) {}

  get summary() {
    let sourcekeys = [
      `--${this.field.optionName()}`,
      `${this.field.envName()}`,
    ];
    return `${sourcekeys.join(" | ")}: required, but was missing`; // TODO: provide with object sources.
  }
}

export class InvalidEnv<S extends Spec, K extends keyof S> implements Issue<S> {
  constructor(
    public field: Field<S, K>,
    public source: Source<S, K>,
    private message: string,
  ) {}

  get summary() {
    return `${this.field.envName()}: ${this.message}`;
  }
}

export class InvalidOption<S extends Spec, K extends keyof S>
  implements Issue<S> {
  constructor(
    public field: Field<S, K>,
    public source: Source<S, K>,
    private message: string,
  ) {}

  get summary() {
    return `--${this.field.optionName()}: ${this.message}`;
  }
}

export class InvalidArgument<S extends Spec, K extends keyof S>
  implements Issue<S> {
  constructor(
    public field: Field<S, K>,
    public source: Source<S, K>,
    private message: string,
  ) {}

  get summary() {
    return `argument ${this.field.name.toUpperCase()}: ${this.message}`;
  }
}

export class InvalidObject<S extends Spec, K extends keyof S>
  implements Issue<S> {
  constructor(
    public field: Field<S, K>,
    public source: Extract<Source<S, K>, { type: "object" }>,
    private message: string,
  ) {}

  get summary() {
    return `${String(this.source.key)} ${this.field.name}: ${this.message}`;
  }
}

export class InvalidDefault<S extends Spec, K extends keyof S> {
  constructor(
    public field: Field<S, K>,
    public source: Extract<Source<S, K>, { type: "default" }>,
    private message: string,
  ) {}

  get summary() {
    return `Schema error: invalid default for '${this.field.name}: ${this.message}. This is most likely a bug in the configuration schema`;
  }
}

export class UnrecognizedArgument {
  sourceType = "argument" as const;
  constructor(public value: unknown, public index: number) {}

  get summary() {
    return `unrecognized argument: ${this.value}`;
  }
}

export class UnrecognizedOption {
  sourceType = "option" as const;
  constructor(public optionString: string, public optionValue: unknown) {}

  get summary() {
    return `unrecognized option --${this.optionString}`;
  }
}

export class UnrecognizedObjectValue {
  sourceType = "object" as const;

  constructor(
    public sourceName: string,
    public sourceKey: string,
    public sourceValue: unknown,
  ) {}
  get summary() {
    return `unrecognized key '${this.sourceKey} in ${this.sourceName}`;
  }
}
