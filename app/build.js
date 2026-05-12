const esbuild = require("esbuild");

esbuild
    .build({
        entryPoints: ["./src/browser/preload.ts"],
        bundle: true,
        platform: "node",
        outdir: "./dist",
        external: ["electron"],
        format: "cjs",
    })
    .catch(() => process.exit(1));
