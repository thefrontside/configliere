import { build, emptyDir } from "jsr:@deno/dnt@0.41.3";

const outDir = "./build/npm";

await emptyDir(outDir);

let [version] = Deno.args;
if (!version) {
  throw new Error("a version argument is required to build the npm package");
}

await build({
  entryPoints: ["./mod.ts"],
  outDir,
  shims: {
    deno: false,
  },
  test: false,
  typeCheck: false,
  compilerOptions: {
    lib: ["ESNext"],
    target: "ES2020",
    sourceMap: true,
  },
  package: {
    // package.json properties
    name: "configliere",
    version,
    description:
      "Smart, FP configuration parser that validates all program inputs ahead of time, including config files, environment variables, and command line options using a single schema",
    license: "MIT",
    author: "engineering@frontside.com",
    repository: {
      type: "git",
      url: "git+https://github.com/thefrontside/configliere.git",
    },
    bugs: {
      url: "https://github.com/thefrontside/configliere/issues",
    },
    engines: {
      node: ">= 16",
    },
    sideEffects: false,
  },
});

await Deno.copyFile("README.md", `${outDir}/README.md`);
