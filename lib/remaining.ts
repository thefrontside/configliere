import type { Input } from "./types.ts";

export function remaining(input?: Input): Input | undefined {
  let remainder = {
    ...input,
  };

  if (remainder.objects && remainder.objects.length === 0) {
    delete remainder.objects;
  }

  if (remainder.args && remainder.args.length === 0) {
    delete remainder.args;
  }

  if (remainder.envs && remainder.envs.length === 0) {
    delete remainder.envs;
  }

  return Object.keys(remainder).length === 0 ? void 0 : remainder;
}
