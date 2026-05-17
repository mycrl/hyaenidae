const { app, protocol } = require("electron");

protocol.registerSchemesAsPrivileged([
    {
        scheme: "hyaenidae",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            allowServiceWorkers: true,
        },
    },
]);

app.whenReady().then(() => {
    console.info("Application is ready, loading main module...");

    require("./dist/index");
});

app.on("window-all-closed", () => {
    app.quit();
});
