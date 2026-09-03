import type { Issue } from "./types.ts";

export type Result<T> = {
  ok: true;
  value: T;
  issues?: readonly Issue[];
} | {
  ok: false;
  issues: readonly Issue[];
};
