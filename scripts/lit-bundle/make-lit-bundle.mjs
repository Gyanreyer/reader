import { build } from "esbuild";

build({
  entryPoints: ["./lit-bundle-entrypoint.js"],
  bundle: true,
  format: "esm",
  outfile: "../../src/public/lib/lit.mjs",
  minify: true,
  treeShaking: true,
  target: ["es2020"],
});
