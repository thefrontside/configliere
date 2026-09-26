import { brand, type ModelElement, type ModelTransform } from "./pipeline.ts";
import type { AnyRoute, Schema } from "./types.ts";

export function transform<
  Input extends object,
  Output extends object,
>(
  schema: Schema<Input, Output>,
): ModelElement<SchemaTransform<Input, Output>> {
  return brand(
    (route: AnyRoute) => {
      let phases = [...route.phases];
      let phase = phases.pop()!;
      phases.push({
        ...phase,
        model: {
          params: phase.model.params,
          steps: phase.model.steps.concat((current) => {
            let result = schema["~standard"].validate(current);
            if (result instanceof Promise) {
              return {
                ok: false,
                issues: [{
                  message: `async validation not currently supported`,
                }],
              };
            } else if (result.issues) {
              return { ok: false, issues: result.issues };
            } else {
              return { ok: true, value: result.value };
            }
          }),
        },
      });
      return {
        ...route,
        phases,
      };
    },
  );
}

interface SchemaTransform<
  Input extends object,
  Output extends object,
> extends ModelTransform {
  readonly input: Input;
  readonly output: Output;
}
