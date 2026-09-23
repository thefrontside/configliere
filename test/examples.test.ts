import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { app as ten } from "../examples/options.ts";
import { app as checkpointTen } from "../examples/checkpoint-options.ts";
import { app as routesTen } from "../examples/routes.ts";
import { app as routesCheckpointTen } from "../examples/routes-checkpoint.ts";

describe("shared type examples", () => {
  it("loads the same examples used by the Node diagnostics", () => {
    expect(ten.name).toBe("auth0");
    expect(checkpointTen.name).toBe("auth0");
    expect(routesTen.name).toBe("simulacrum");
    expect(routesCheckpointTen.name).toBe("simulacrum");
  });
});
