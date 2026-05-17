import BrowserDemo from "./components/BrowserDemo/BrowserDemo.tsx";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { FaGithub } from "react-icons/fa6";

export default function App() {
    return (
        <div className="app">
            <header className="hero">
                <img src="/logo.svg" alt="Hyaenidae Logo" width={70} />
                <p className="hero-eyebrow">Hyaenidae</p>
                <h1 className="hero-title">
                    Reimagine your conversation with the internet.
                </h1>
                <p className="hero-subtitle">
                    An AI browser that can browse the web, use tools, and
                    complete tasks with DOM-first automation and vision
                    fallback.
                </p>
            </header>
            <div className="content">
                <BrowserDemo />
                <a
                    className="get-browse-button"
                    href="https://github.com/mycrl/hyaenidae/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <ArrowDownTrayIcon
                        className="get-browse-button-icon"
                        aria-hidden="true"
                    />
                </a>
                <footer className="site-footer" aria-label="Site footer">
                    <a
                        className="site-footer-link"
                        href="https://github.com/mycrl/hyaenidae"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FaGithub
                            className="site-footer-icon"
                            aria-hidden="true"
                        />
                        <span>GitHub</span>
                    </a>
                </footer>
            </div>
        </div>
    );
}
