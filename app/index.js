const { app } = require("electron");

app.whenReady().then(() => {
    require("./dist/index");
});

app.on("window-all-closed", () => {
    app.quit();
});
