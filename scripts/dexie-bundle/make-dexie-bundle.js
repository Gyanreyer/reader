import { build } from "esbuild";

build({
  entryPoints: ["./dexie-bundle-entrypoint.js"],
  bundle: true,
  format: "esm",
  outfile: "../../src/public/lib/dexie.js",
  minify: true,
  treeShaking: true,
  target: ["es2020"],
});
