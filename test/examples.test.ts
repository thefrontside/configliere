import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { app as ten } from "../examples/options.ts";
import { app as checkpointTen } from "../examples/checkpoint-options.ts";
import { app as routesTen } from "../examples/routes.ts";
import { app as routesCheckpointTen } from "../examples/routes-checkpoint.ts";
import { parse } from "../mod.ts";

describe("shared type examples", () => {
  it("loads the same examples used by the Node diagnostics", () => {
    expect(ten.name).toBe("auth0");
    expect(checkpointTen.name).toBe("auth0");
    expect(routesTen.name).toBe("simulacrum");
    expect(routesCheckpointTen.name).toBe("simulacrum");
  });

  it("uses grouped roots and carries root options into child execution", () => {
    let root = parse(routesTen, { argv: [] });
    // top level route should not allow execute method directly
    expect(root).toMatchObject({
      ok: false,
      code: "method-not-allowed",
      route: "/",
      method: "execute",
    });

    // serve is a child route of the top-level route
    let result = parse(routesTen, {
      argv: [
        "--verbose",
        "serve",
        "--port",
        "4100",
        "--host",
        "localhost",
        "--protocol",
        "http",
      ],
    });
    expect(result).toMatchObject({
      ok: true,
      method: "execute",
      route: "/serve",
      model: { port: 4100, host: "localhost", protocol: "http" },
      models: { "/": { verbose: true } },
    });
  });

  it("normalizes partially specified checkout options", () => {
    let result = resume([
      "--config",
      "checkout.json",
      "--domain",
      "https://checkout.example:8443",
      "--audience",
      "checkout",
    ]);

    expect(result).toMatchObject({
      ok: true,
      model: {
        port: 8443,
        domain: "https://checkout.example:8443",
        protocol: "https",
      },
    });
  });

  it("fills missing checkout values from the supplied values", () => {
    let result = resume([
      "--config",
      "checkout.json",
      "--port",
      "8080",
      "--protocol",
      "http",
      "--audience",
      "checkout",
    ]);

    expect(result).toMatchObject({
      ok: true,
      model: {
        port: 8080,
        domain: "http://localhost:8080",
        protocol: "http",
      },
    });
  });

  it("rejects conflicting checkout values", () => {
    let result = resume([
      "--config",
      "checkout.json",
      "--domain",
      "https://checkout.example:8443",
      "--port",
      "9443",
      "--audience",
      "checkout",
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok && "issues" in result) {
      expect(result.issues[0].message).toContain("domain port 8443");
    }
  });
});

function resume(argv: string[]) {
  let result = parse(checkpointTen, { argv });
  if (!result.ok || !("resume" in result)) {
    throw new Error("expected checkpoint example to pause");
  }
  return result.resume({ ok: true, value: [] });
}
