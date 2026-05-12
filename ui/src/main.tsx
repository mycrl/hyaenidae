import "./index.css";
import "./i18n";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";

import GlobalErrorDialog from "./components/GlobalErrorDialog";
import AppPage from "./pages/App";
import SettingsPage from "./pages/Settings";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <HashRouter>
            <GlobalErrorDialog />
            <Routes>
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/" element={<AppPage />} />
            </Routes>
        </HashRouter>
    </StrictMode>,
);
