import "./styles/index.css";
import "./i18n";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";

import ShellPage from "./pages/shell";
import SettingsPage from "./pages/settings";
import DownloadsPage from "./pages/downloads";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <HashRouter>
            <Routes>
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/downloads" element={<DownloadsPage />} />
                <Route path="/" element={<ShellPage />} />
            </Routes>
        </HashRouter>
    </StrictMode>,
);
