import type { Maybe } from "./maybe.ts";
import type { AnyRoute, RoutePath } from "./types.ts";

export type ValueSource = {
  name: string;
  value: unknown;
};

export function withValues(
  values: ValueSource[],
): <R extends AnyRoute>(route: R) => R {
  return (route) => {
    let phases = [...route.phases];
    let phase = phases.pop()!;
    phases.push({
      ...phase,
      values: phase.values.concat(values),
    })
    return {
      ...route,
      phases,
    };
  };
}

export type ValueClaim = {
  result: Maybe<{
    source: string;
    address: string[];
    value: unknown;
  }>;
  rest: Values;
};

export class Values {
  mounts: Map<RoutePath, ValueSource[]>;
  claims: Set<ClaimId>;

  constructor(mounts: Map<RoutePath, ValueSource[]> = new Map(), claims: Set<ClaimId> = new Set()) {
    this.mounts = mounts;
    this.claims = claims;
  }

  mount(path: string[], sources: ValueSource[]): Values {
    if (sources.length === 0) {
      return this;
    }
    const id = routeId(path);

    return new Values(
      new Map([...this.mounts.entries(), [
        id,
        (this.mounts.get(id) ?? []).concat(sources),
      ]]),
      this.claims,
    );
  }

  claim({ route, address }: ClaimOptions): ValueClaim {
    let id = claimId([...route, ...address]);
    const nope: ValueClaim = { result: { exists: false }, rest: this };
    if (this.claims.has(id)) {
      return nope;
    }

    for (let end = route.length; end >= 0; end--) {
      let mountId = routeId(route.slice(0, end));
      let sources = this.mounts.get(mountId) ?? [];
      for (let { name, value } of sources) {
        let result = find(value, [...route.slice(end), ...address]);
        if (result.exists) {
          let rest = new Values(this.mounts, new Set([...this.claims, id]));
          return {
            result: {
              exists: true,
              value: {
                source: name,
                address,
                value: result.value,
              },
            },
            rest,
          };
        }
      }
    }
    return nope;
  }
}

export interface ClaimOptions {
  route: string[];
  address: string[];
}

type ClaimId = string;

function routeId(address: string[]): RoutePath {
  return `/${address.join("/")}`;
}

function claimId(address: string[]): ClaimId {
  return JSON.stringify(address);
}

function find(value: unknown, path: string[]): Maybe<unknown> {
  let current: unknown = value;

  for (let key of path) {
    if (
      current === null ||
      (typeof current !== "object" && typeof current !== "function") ||
      !Object.hasOwn(current, key)
    ) {
      return { exists: false };
    }

    current = (current as Record<string, unknown>)[key];
  }

  return {
    exists: true,
    value: current,
  };
}
