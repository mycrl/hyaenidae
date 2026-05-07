import esbuild from "esbuild";

esbuild
    .build({
        entryPoints: ["./src/preload.ts"],
        bundle: true,
        platform: "node",
        outdir: "./dist",
        external: ["electron"],
        format: "cjs",
    })
    .catch(() => process.exit(1));
