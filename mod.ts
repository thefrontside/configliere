import { toEnvCase, toKebabCase } from "./case.ts";
import { Config, Field, Inputs, ParseResult, Sources, Spec } from "./types.ts";

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
    let { objects = [] } = inputs;
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

    return this.fields.reduce((result, field) => {
      let source = sources[field.name];
      let value = source.type === "object" ? source.value : undefined;
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
      throw new TypeError(result.issues.map(i => i.message).join("\n"));
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
