import {
  isNumber,
  parseArgs,
  type ParseOptions,
} from "../vendor/parse_args.ts";
import { toEnvCase, toKebabCase } from "./case.ts";
import {
  InvalidArgument,
  InvalidEnv,
  InvalidObject,
  InvalidOption,
  Missing,
  UnrecognizedArgument,
  UnrecognizedObjectValue,
  UnrecognizedOption,
} from "./issues.ts";
import type {
  Config,
  Field,
  Inputs,
  Issue,
  ObjectInput,
  ParseResult,
  Source,
  Sources,
  Spec,
  Unrecognized,
} from "./types.ts";

export class Configliere<S extends Spec> {
  fields: Field<S, keyof S>[];
  sources: Sources<S>;
  constructor(public spec: S) {
    this.fields = Object.keys(spec).reduce((fields, name) => {
      return fields.concat({
        name,
        spec: this.spec[name],
        envName: () => toEnvCase(name),
        optionName: () => toKebabCase(name),
      } as Field<S, keyof S>);
    }, [] as Field<S, keyof S>[]);
    this.sources = this.fields.reduce((sources, field) => ({
      ...sources,
      [field.name]: { type: "none", key: field.name },
    }), {} as Sources<S>);
  }

  parse = (inputs: Inputs): ParseResult<S> => {
    let unrecognized: Unrecognized[] = [];
    let { objects = [], env, args = [] } = inputs;
    let sources = objects.reduce((sources, input) => {
      return Object.create(
        sources,
        Object.entries(input.value).reduce((props, [key, value]) => {
          if (typeof this.spec[key] == "undefined") {
            unrecognized.push(
              new UnrecognizedObjectValue(input.source, key, value),
            );
            return props;
          } else {
            return {
              ...props,
              [key]: {
                enumerable: true,
                value: {
                  type: "object",
                  key,
                  value,
                  name: input.source,
                },
              },
            };
          }
        }, {}),
      ) as Sources<S>;
    }, this.sources);

    if (env) {
      sources = Object.create(
        sources,
        this.fields.reduce((sources, field) => {
          let stringvalue = env[field.envName()];
          if (typeof stringvalue === "undefined") {
            return sources;
          } else {
            return {
              ...sources,
              [field.name]: {
                enumerable: true,
                value: {
                  type: "env",
                  key: field.name,
                  envKey: field.envName(),
                  stringvalue,
                },
              },
            };
          }
        }, {}),
      );
    }

    let fromCLI = getCLISources(args, this);

    unrecognized.push(...fromCLI.unrecognized);

    sources = Object.create(
      sources,
      fromCLI.sources.reduce((props, source) => {
        return {
          ...props,
          [source.key]: {
            enumerable: true,
            value: source,
          },
        };
      }, {}),
    );

    let { issues, config } = this.fields.reduce((result, field) => {
      let source = sources[field.name];
      let value = getValue(source);
      let validation = field.spec.schema["~standard"].validate(value);
      if (validation instanceof Promise) {
        throw new Error(`async validation is not supported`);
      }
      if (validation.issues) {
        let issues = validation.issues.map((i) => {
          if (source.type === "none") {
            return new Missing(field, source);
          } else if (source.type === "env") {
            return new InvalidEnv(field, source, i.message);
          } else if (source.type === "option") {
            return new InvalidOption(field, source, i.message);
          } else if (source.type === "argument") {
            return new InvalidArgument(field, source, i.message);
          } else {
            // source.type === "object"
            return new InvalidObject(field, source, i.message);
          }
        });

        return { issues: result.issues.concat(issues), config: result.config };
      } else {
        return {
          issues: result.issues,
          config: {
            ...result.config,
            [field.name]: value,
          },
        };
      }
    }, { issues: [] as Issue<S>[], config: {} as Config<S> });

    if (issues.length > 0 || unrecognized.length > 0) {
      return {
        ok: false,
        issues,
        sources,
        unrecognized,
        summary: summarizeResult(issues, unrecognized),
      };
    } else {
      return {
        ok: true,
        sources,
        config,
      };
    }
  };

  expect = (inputs: Inputs): Config<S> => {
    let result = this.parse(inputs);
    if (result.ok) {
      return result.config;
    } else {
      throw new TypeError(result.summary);
    }
  };
}

export interface ConfigInputs {
  objects?: ObjectInput[];
  env?: Record<string, string>;
  args?: string[];
}

function getValue<S extends Spec, K extends keyof S>(
  source: Source<S, K>,
): unknown {
  if (
    source.type === "object" || source.type === "option" ||
    source.type === "argument"
  ) {
    return source.value;
  } else if (source.type === "env") {
    let { stringvalue } = source;
    if (isNumber(stringvalue)) {
      return Number(stringvalue);
    } else {
      let result = parseBoolean(stringvalue);
      if (typeof result === "boolean") {
        return result;
      }
    }
    return stringvalue;
  } else {
    return undefined;
  }
}

function parseBoolean(value: string): boolean | string {
  switch (value.toLowerCase().trim()) {
    case "true":
    case "yes":
    case "1":
      return true;
    case "false":
    case "no":
    case "0":
      return false;
    default:
      return value;
  }
}

function getCLISources<S extends Spec>(
  args: string[],
  configliere: Configliere<S>,
): { sources: Source<S, keyof S>[]; unrecognized: Unrecognized[] } {
  let unrecognized: Unrecognized[] = [];

  let parseOptions = {
    alias: {} as Record<string, string>,
    boolean: [] as string[],
    collect: [] as string[],
    negatable: [] as string[],
  } satisfies ParseOptions;

  let positionals: Field<S, keyof S>[] = [];

  for (let field of configliere.fields) {
    if (typeof field.spec.cli === "string" && field.spec.cli === "positional") {
      positionals.push(field);
      continue;
    }
    if (field.spec.collection) {
      parseOptions.collect.push(field.optionName());
    }
    if (field.spec.cli?.alias) {
      parseOptions.alias[field.spec.cli.alias] = field.optionName();
    }
    if (field.spec.cli?.switch) {
      parseOptions.boolean.push(field.optionName());
      parseOptions.negatable.push(field.optionName());
    }
  }

  let options = parseArgs(args, parseOptions);

  let optionKey2Field = {} as Record<string, Field<S, keyof S>>;
  for (let field of configliere.fields) {
    optionKey2Field[field.optionName()] = field;
  }

  let optionSources: Source<S, keyof S>[] = [];

  for (
    let optionKey of Object.keys(options).filter((k) =>
      k !== "_" && !parseOptions.alias[k]
    )
  ) {
    let value = options[optionKey];
    let field = optionKey2Field[optionKey];
    if (typeof field !== "undefined") {
      optionSources.push({
        type: "option",
        key: field.name,
        optionKey,
        value,
      });
    } else {
      let optionString = `--${optionKey}`; //TODO: handle aliases
      unrecognized.push(new UnrecognizedOption(optionString, value));
    }
  }

  let positionalSources: Source<S, keyof S>[] = [];
  let rest: (string | number)[] | undefined = undefined;
  options._.forEach((value, i) => {
    let field = positionals[i];

    if (rest) {
      rest.push(value);
    } else if (typeof field !== "undefined") {
      let sourceValue: (string | number) | (string | number)[] = value;
      if (field.spec.collection) {
        sourceValue = rest = [value];
      }
      positionalSources.push({
        type: "argument",
        key: field.name,
        index: i,
        value: sourceValue,
      });
    } else {
      unrecognized.push(new UnrecognizedArgument(value, i));
    }
  });

  return {
    sources: optionSources.concat(positionalSources),
    unrecognized,
  };
}

function summarizeResult<S extends Spec>(
  issues: Issue<S>[],
  unrecognized: Unrecognized[],
): string {
  return unrecognized.map((u) => u.summary).concat(issues.map((i) => i.summary))
    .join("\n");
}
