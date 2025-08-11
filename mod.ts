import { parseArgs } from "@std/cli/parse-args+patch";
import { toEnvCase, toKebabCase } from "./case.ts";
import {
  Config,
  Field,
  Inputs,
  ParseResult,
  Source,
  Sources,
  Spec,
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
    let { objects = [], env, args = [] } = inputs;
    let sources = objects.reduce((sources, input) => {
      return Object.create(
        sources,
        Object.entries(input.value).reduce((props, [key, value]) => {
          if (typeof this.spec[key] == "undefined") {
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

    let options = getArgsSources(args, this);

    sources = Object.create(
      sources,
      options.reduce((props, source) => {
        if (source.type === "args") {
          return {
            ...props,
            [source.key]: {
              enumerable: true,
              value: source,
            },
          };
        } else {
          return props;
        }
      }, {}),
    );

    return this.fields.reduce((result, field) => {
      let source = sources[field.name];
      let value = getValue(source, field);
      let validation = field.spec.schema["~standard"].validate(value);
      if (validation instanceof Promise) {
        throw new Error(`async validation is not supported`);
      }
      if (validation.issues) {
        let issues = validation.issues.map((i) => ({
          field,
          message: i.message,
          source,
        }));
        if (result.ok) {
          return {
            ok: false,
            sources,
            issues,
          };
        } else {
          return {
            ...result,
            issues: result.issues.concat(...issues),
          };
        }
      } else if (result.ok) {
        return {
          ...result,
          config: {
            ...result.config,
            [field.name]: validation.value,
          },
        };
      } else {
        return result;
      }
    }, {
      ok: true,
      config: {},
      sources,
    } as ParseResult<S>);
  };

  expect = (inputs: Inputs): Config<S> => {
    let result = this.parse(inputs);
    if (result.ok) {
      return result.config;
    } else {
      throw new TypeError(result.issues.map((i) => i.message).join("\n"));
    }
  };
}

interface ObjectInput {
  source: string;
  value: Record<string, unknown>;
}

export interface ConfigInputs {
  objects?: ObjectInput[];
  env?: Record<string, string>;
  args?: string[];
}

function getValue<S extends Spec, K extends keyof S>(
  source: Source<S, K>,
  field: Field<S, K>,
): unknown {
  if (source.type === "object" || source.type == "args") {
    return source.value;
  } else if (source.type === "env") {
    let { stringvalue } = source;
    let { schema } = field.spec;
    if (schema.extends("string")) {
      return stringvalue;
    } else if (schema.extends("number")) {
      return Number(stringvalue);
    } else if (schema.extends("boolean")) {
      switch (stringvalue.toLowerCase().trim()) {
        case "true":
        case "yes":
        case "1":
          return true;
        case "false":
        case "no":
        case "0":
          return false;
        default:
          return stringvalue;
      }
    } else {
      console.warn(
        "unknown conversion from ",
        stringvalue,
        "to",
        schema.description,
      );
    }
  } else {
    return undefined;
  }
}

function getArgsSources<S extends Spec>(
  args: string[],
  configliere: Configliere<S>,
): Extract<Source<S, keyof S>, { type: "args" | "unrecognized" }>[] {
  let parseOptions = { boolean: [] as string[], collect: [] as string[], negatable: [] as string[] };

  for (let field of configliere.fields) {
    if (field.spec.schema.extends("boolean")) {
      parseOptions.boolean.push(field.optionName());
      parseOptions.negatable.push(field.optionName());
    }
  }

  let options = parseArgs(args, parseOptions);

  let optionKey2Field = {} as Record<string, Field<S, keyof S>>;
  for (let field of configliere.fields) {
    optionKey2Field[field.optionName()] = field;
  }

  return Object.keys(options).filter((k) => k !== "_").map((optionKey) => {
    let value = options[optionKey];
    let field = optionKey2Field[optionKey];
    if (typeof field !== "undefined") {
      return {
        type: "args",
        key: field.name,
        optionKey,
        value,
      };
    } else {
      return {
        type: "unrecognized",
        source: "args",
        sourceName: optionKey,
        value,
      };
    }
  });
}
