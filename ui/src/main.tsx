import "./index.css";
import "./i18n";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";

import AppPage from "./pages/App.tsx";
import SettingsPage from "./pages/Settings.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <HashRouter>
            <Routes>
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/" element={<AppPage />} />
            </Routes>
        </HashRouter>
    </StrictMode>,
);
