import type { Maybe } from "./maybe.ts";
import type { Param } from "./param.ts";
import { brand, type IdentityElement } from "./pipeline.ts";
import type { AnyRoute, RoutePath } from "./types.ts";

export interface EnvSource {
  readonly name: string;
  readonly value: Environment;
}

export type Environment = Readonly<Record<string, string | undefined>>;

export interface EnvClaim {
  readonly result: Maybe<{
    readonly source: string;
    readonly address: readonly string[];
    readonly key: string;
    readonly value: string;
  }>;
  readonly rest: Envs;
}

export interface EnvClaimOptions {
  readonly route: readonly string[];
  readonly address: readonly string[];
  readonly key?: string;
}

export function env(
  key: string,
): IdentityElement<Param<string, unknown>> {
  return brand<IdentityElement<Param<string, unknown>>>(
    (param: Param<string, unknown>) => ({ ...param, env: key }),
  );
}

export function withEnvs(
  envs: readonly EnvSource[],
): IdentityElement<AnyRoute> {
  return brand<IdentityElement<AnyRoute>>(
    (route: AnyRoute) => {
      let phases = [...route.phases];
      let phase = phases.pop()!;
      phases.push({
        ...phase,
        envs: phase.envs.concat(envs),
      });
      return {
        ...route,
        phases,
      };
    },
  );
}

export class Envs {
  mounts: Map<RoutePath, EnvSource[]>;
  claims: Set<ClaimId>;

  constructor(
    mounts: Map<RoutePath, EnvSource[]> = new Map(),
    claims: Set<ClaimId> = new Set(),
  ) {
    this.mounts = mounts;
    this.claims = claims;
  }

  mount(path: readonly string[], sources: readonly EnvSource[]): Envs {
    if (sources.length === 0) {
      return this;
    }
    let id = routeId(path);

    return new Envs(
      new Map([...this.mounts.entries(), [
        id,
        (this.mounts.get(id) ?? []).concat(sources),
      ]]),
      this.claims,
    );
  }

  claim(
    { route, address, key = envKey([...route, ...address]) }: EnvClaimOptions,
  ): EnvClaim {
    let id = claimId([...route, ...address]);
    let nope: EnvClaim = { result: { exists: false }, rest: this };
    if (this.claims.has(id)) {
      return nope;
    }

    for (let end = route.length; end >= 0; end--) {
      let mount = routeId(route.slice(0, end));
      let sources = this.mounts.get(mount) ?? [];

      for (let { name, value } of sources) {
        if (!Object.hasOwn(value, key) || typeof value[key] === "undefined") {
          continue;
        }

        let rest = new Envs(this.mounts, new Set([...this.claims, id]));
        return {
          result: {
            exists: true,
            value: {
              source: name,
              address,
              key,
              value: value[key],
            },
          },
          rest,
        };
      }
    }

    return nope;
  }
}

type ClaimId = string;

function routeId(path: readonly string[]): RoutePath {
  return `/${path.join("/")}`;
}

function claimId(address: readonly string[]): ClaimId {
  return JSON.stringify(address);
}

function envKey(address: readonly string[]): string {
  return address.map(normalize).filter(Boolean).join("_");
}

function normalize(value: string): string {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z\d]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}
