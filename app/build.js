require("esbuild")
    .build({
        entryPoints: ["./src/browser/inject.ts"],
        bundle: true,
        platform: "node",
        outfile: "./dist/preload.js",
        external: ["electron"],
        format: "cjs",
    })
    .catch(() => process.exit(1));
