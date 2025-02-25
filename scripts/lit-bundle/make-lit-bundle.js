import { build } from "esbuild";

build({
  entryPoints: ["./lit-bundle-entrypoint.js"],
  bundle: true,
  format: "esm",
  outfile: "../../src/public/lib/lit.js",
  minify: true,
  treeShaking: true,
  target: ["es2020"],
});
