import type { StandardSchemaV1 } from "@standard-schema/spec";
import { sprintf } from "sprintf-js";
import {
  isNumber,
  parseArgs,
  type ParseOptions,
} from "../vendor/parse_args.ts";
import { toEnvCase, toKebabCase } from "./case.ts";
import {
  InvalidArgument,
  InvalidDefault,
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
  FieldOutput,
  Inputs,
  Issue,
  ObjectInput,
  ParseResult,
  Source,
  Sources,
  Spec,
  Unrecognized,
} from "./types.ts";
import { assert } from "@std/assert";

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
      [field.name]: typeof field.spec.default === "undefined"
        ? { type: "none", key: field.name }
        : { type: "default", key: field.name, value: field.spec.default },
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
      let validation = validate(field, value);
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
          } else if (source.type === "default") {
            return new InvalidDefault(field, source, i.message);
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
        summary: getResultSummary(issues, unrecognized),
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

  describeCLI = (inputs: ConfigInputs, progname: string): string => {
    let { sources } = this.parse(inputs);
    let args = this.fields.filter((f) => f.spec.cli === "positional");
    let options = this.fields.flatMap((f) =>
      f.spec.cli === "positional" ? [] : [f]
    );

    let positionals = args.map((field) => getCLIArgName(field));

    let withOpts =
      this.fields.filter((f) => f.spec.cli !== "positional").length > 0
        ? ["[OPTIONS]"]
        : [];

    let Usage = [["Usage:", progname, ...withOpts, ...positionals].join(" ")];

    let Arguments = args.length
      ? [[
        "Arguments:",
        ...args.map((field) => {
          let p = getCLIArgName(field);
          let desc = field.spec.description ?? "";
          let source = sources[field.name];
          let sourceValue = getCLIHelpSourceValue(source, field);
          let sourceString = source.type !== "none" ? `[${sourceValue}]` : "";
          return sprintf(`   %-25s %s %s`, p, desc, sourceString) as string;
        }),
      ].join("\n")]
      : [] as string[];

    let Options = options.length
      ? [[
        "Options:",
        ...options.map((field) => {
          let cli = field.spec.cli ?? {};
          assert(cli !== "positional", "PANIC: bad mapping of cli args");
          let desc = field.spec.description ?? "";
          let source = sources[field.name];
          let alias = cli.alias ? ["-" + cli.alias] : [];
          let optionNames = [...alias, `--${field.optionName()}`].join(", ");
          let optionValue = cli.switch
            ? []
            : [getCLIOptionName(field)];
          let optionString = [optionNames, ...optionValue].join(" ");

          let sourceValue = getCLIHelpSourceValue(source, field);
          let sourceString = source.type !== "none" ? `[${sourceValue}]` : "";

          return sprintf(`   %-25s %s %s`, optionString, desc, sourceString);
        }),
      ].join("\n")]
      : [] as string[];

    return [...Usage, ...Arguments, ...Options].join("\n\n");
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
    source.type === "argument" || source.type === "default"
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

function isOptional<S extends Spec, K extends keyof S>(
  field: Field<S, K>,
): boolean {
  let validation = validate(field, undefined);
  return !validation.issues;
}

function validate<S extends Spec, K extends keyof S>(
  field: Field<S, K>,
  value: unknown,
): StandardSchemaV1.Result<FieldOutput<S, K>> {
  let validation = field.spec.schema["~standard"].validate(value);
  if (validation instanceof Promise) {
    throw new Error(`async validation is not supported`);
  }
  return validation;
}

function getCLIHelpSourceValue<S extends Spec, K extends keyof S>(
  source: Source<S, K>,
  field: Field<S, K>,
): string {
  if (source.type === "default") {
    return `default: ${source.value}`;
  } else if (source.type === "object") {
    return `${source.name}: ${field.name}=${source.value}`;
  } else if (source.type === "env") {
    return `env: ${field.envName()}=${source.stringvalue}`;
  } else if (source.type === "option") {
    return `--${source.optionKey} ${source.value}`;
  } else if (source.type === "argument") {
    return `argument ${source.index}: ${source.value}`;
  } else {
    return "";
  }
}

function getResultSummary<S extends Spec>(
  issues: Issue<S, keyof S>[],
  unrecognized: Unrecognized[],
): string {
  let missing = issues.flatMap((issue) => issue.missing ? [issue] : []);
  let invalid = issues.flatMap((issue) => !issue.missing ? [issue] : []);

  let section = {
    missing: missing.length
      ? [[
        "missing:",
        ...missing.map((issue) => {
          let field = issue.field;
          let cliUsage = field.spec.cli === "positional"
            ? `[argument]: ${getCLIArgName(field)}`
            : `[option]: ${getCLIOptionKeys(field)}`;
          return [
            `  - ${issue.field.spec.description ?? field.name}`,
            `    use:`,
            `      ${cliUsage}`,
            `      [env]: ${field.envName()}`,
          ].join("\n");
        }),
      ].join("\n")]
      : [],
    invalid: invalid.length
      ? [[
        "invalid:",
        ...invalid.map((issue) => `  ${issue.summary}`),
      ].join("\n")]
      : [],
    unrecognized: unrecognized.length
      ? [[
        "unrecognized:",
        ...unrecognized.map((u) => {
          if (u.sourceType === "option") {
            let value = typeof u.optionValue === "boolean"
              ? [u.optionString]
              : [u.optionString, u.optionValue];
            return `  [option]: ${value.join(" ")}`;
          } else if (u.sourceType === "argument") {
            return `  [argument]: ${u.index} ${u.value}`;
          } else {
            return `  [${u.sourceName}]: ${u.sourceKey}=${u.sourceValue}`;
          }
        }),
      ].join("\n")]
      : [],
  };
  return [...section.missing, ...section.invalid, ...section.unrecognized].join(
    "\n\n",
  );
}

function getCLIName<S extends Spec, K extends keyof S>(
  field: Field<S, K>,
): (name: string) => string {
  let ellipsis = field.spec.collection ? "..." : "";

  return isOptional(field) ? (s) => `[${s}]` : (s) => `<${s}>` + ellipsis;
}

function getCLIArgName<S extends Spec, K extends keyof S>(
  field: Field<S, K>,
): string {
  return getCLIName(field)(field.optionName());
}

function getCLIOptionName<S extends Spec, K extends keyof S>(
  field: Field<S, K>,
): string {
  return getCLIName(field)(field.optionName().toUpperCase());
}

function getCLIOptionKeys<S extends Spec, K extends keyof S>(
  field: Field<S, K>,
): string {
  let { cli } = field.spec;
  let alias = typeof cli === "object" && cli.alias ? ["-" + cli.alias] : [];
  let varName: string[] = typeof cli === "object" && cli.switch
    ? []
    : [getCLIOptionName(field)];
  return [[...alias, `--${field.optionName()}`].join(", "), ...varName].join(
    " ",
  );
}
