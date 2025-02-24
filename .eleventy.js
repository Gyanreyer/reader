// 11ty plugins
import pluginWebc from "@11ty/eleventy-plugin-webc";
// import bundlerPlugin from "@11ty/eleventy-plugin-bundle";

// Minification/asset processing libs
// import esbuild from "esbuild";
// import { minify as minifyCSS } from "csso";
// import { minify as minifyHTML } from "html-minifier-terser";

// const IS_PRODUCTION = process.env.NODE_ENV === "prod";

/**
 * @param {import("@11ty/eleventy").UserConfig} eleventyConfig
 */
export default function (eleventyConfig) {
  // Set up webc plugin to process all webc files
  eleventyConfig.addPlugin(pluginWebc, {
    components: ["src/_components/**/*.webc"],
  });

  // Trigger a hot reload when a JS/CSS file changes
  eleventyConfig.addWatchTarget("src/**/*.{js,mjs,css}");

  eleventyConfig.addPassthroughCopy({
    "src/public": "/",
  });

  // Apply custom transforms to bundled JS and CSS
  // eleventyConfig.addPlugin(bundlerPlugin, {
  //   transforms: [
  //     async function (content) {
  //       switch (this.type) {
  //         case "js":
  //           try {
  //             // Minify the JS bundle for production builds
  //             return (
  //               await esbuild.transform(content, {
  //                 minify: IS_PRODUCTION,
  //                 target: "es2020",
  //               })
  //             ).code;
  //           } catch (e) {
  //             console.error("Error while minifying JS bundle:", e);
  //           }
  //           break;
  //         case "css":
  //           try {
  //             // Minify the CSS bundle
  //             return minifyCSS(content).css;
  //           } catch (e) {
  //             console.error("Error while minifying CSS bundle:", e);
  //           }
  //           break;
  //         default:
  //       }

  //       return content;
  //     },
  //   ],
  // });

  // Minify the HTML output
  // eleventyConfig.addTransform("htmlmin", async function (content) {
  //   if (
  //     IS_PRODUCTION &&
  //     this.page.outputPath &&
  //     this.page.outputPath.endsWith(".html")
  //   ) {
  //     try {
  //       return await minifyHTML(content, {
  //         useShortDoctype: true,
  //         removeComments: true,
  //         collapseWhitespace: true,
  //       });
  //     } catch (e) {
  //       console.error("HTML minification error: ", e);
  //       return content;
  //     }
  //   }

  //   return content;
  // });

  return {
    dir: {
      input: "src",
    },
  };
}
