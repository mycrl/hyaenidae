const esbuild = require("esbuild");

esbuild
    .build({
        entryPoints: ["./src/preload.js"],
        bundle: true,
        platform: "node",
        outdir: "./dist",
        external: ["electron"],
        format: "cjs",
    })
    .catch(() => process.exit(1));
