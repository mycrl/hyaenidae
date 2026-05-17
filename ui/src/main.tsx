import "./styles/index.css";
import "./i18n";

import { lazy, Suspense, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";

const initialApplicationRoute = () => {
    if (location.href.includes("shell")) {
        return ["/"];
    }

    if (location.href.includes("://settings")) {
        return ["/settings"];
    }

    if (location.href.includes("://downloads")) {
        return ["/downloads"];
    }

    return ["/404"];
};

const BaseRoutes = () => {
    const ShellPage = lazy(() => import("./pages/shell"));
    const SettingsPage = lazy(() => import("./pages/settings"));
    const DownloadsPage = lazy(() => import("./pages/downloads"));

    return (
        <Suspense>
            <Routes>
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/downloads" element={<DownloadsPage />} />
                <Route path="/" element={<ShellPage />} />
            </Routes>
        </Suspense>
    );
};

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        {import.meta.env.DEV ? (
            <BrowserRouter>
                <BaseRoutes />
            </BrowserRouter>
        ) : (
            <MemoryRouter initialEntries={initialApplicationRoute()}>
                <BaseRoutes />
            </MemoryRouter>
        )}
    </StrictMode>,
);
