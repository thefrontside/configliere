import { dynamic } from "./dynamic.ts";
import type { DynamicElement } from "./pipeline.ts";
import { type ValueSource, withValues } from "./values.ts";

export function checkpoint(): DynamicElement<
  ValueSource[],
  ReturnType<typeof withValues>
> {
  return dynamic((values: ValueSource[]) => withValues(values));
}
