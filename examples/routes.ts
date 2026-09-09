import {
  command,
  description,
  name,
  option,
  route,
  routes,
  schema,
  toggle,
  version,
} from "../mod.ts";
import type { ChildrenOf, ModelOf } from "../lib/types.ts";
import { z } from "zod";

export const app = command(
  name("simulacrum"),
  description("Run and manage local service simulators."),
  version("1.0.0"),
  toggle(name("verbose")),
  routes(
    command(
      name("serve"),
      option(name("port"), description("server port"), schema(z.number())),
      option(name("host"), description("server host"), schema(z.string())),
      option(
        name("protocol"),
        description("server protocol"),
        schema(z.enum(["http", "https"])),
      ),
    ),
    route(
      name("database"),
      routes(
        command(
          name("clean"),
          toggle(name("dryRun")),
          option(
            name("output"),
            description("output path"),
            schema(z.string()),
          ),
        ),
      ),
    ),
  ),
);

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true
  : false
  : false;
type Assert<T extends true> = T;
type RootModelIsExact = Assert<
  Equal<ModelOf<typeof app>, { verbose: boolean }>
>;
type ServeModelIsExact = Assert<
  Equal<ModelOf<ChildrenOf<typeof app>[0]>, {
    port: number;
    host: string;
    protocol: "http" | "https";
  }>
>;
type CleanModelIsExact = Assert<
  Equal<ModelOf<ChildrenOf<ChildrenOf<typeof app>[1]>[0]>, {
    dryRun: boolean;
    output: string;
  }>
>;
