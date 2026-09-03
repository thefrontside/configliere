import { dynamic, type Seed } from "./dynamic.ts";
import type { AnyRoute } from "./types.ts";
import { type ValueSource, withValues } from "./values.ts";

export function checkpoint(): <Before extends AnyRoute>(
  route: Before,
) => ReturnType<
  ReturnType<typeof dynamic<Before, ValueSource[], Seed<Before>>>
> {
  return <Before extends AnyRoute>(route: Before) =>
    dynamic<Before, ValueSource[], Seed<Before>>(
      (values) => withValues(values),
    )(route);
}
