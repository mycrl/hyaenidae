const esbuild = require("esbuild");

esbuild
    .build({
        entryPoints: ["./src/preload/shell.js", "./src/preload/renderer.js"],
        bundle: true,
        platform: "node",
        outdir: "./dist/preload",
        external: ["electron"],
        format: "cjs",
    })
    .catch(() => process.exit(1));
