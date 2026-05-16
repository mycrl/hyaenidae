import { CONFIG } from "../config";
import { URL } from "node:url";

export class UriProcessor {
    /**
     * Checks if the given URL is a registered download URL.
     */
    static isDownloadRegisteredUrl(url: string) {
        return url == CONFIG.downloadsUrl;
    }

    /**
     * Checks if the given URL is a registered shell URL.
     */
    static isShellRegisteredUrl(url: string) {
        return url == CONFIG.shellUrl;
    }

    /**
     * Checks if the given URL is a registered settings URL.
     */
    static isSettingsRegisteredUrl(url: string) {
        return url == CONFIG.settingsUrl;
    }

    /**
     * Checks if the given URL is a registered application URL.
     */
    static isApplicationRegisteredUrl(url: string) {
        return (
            UriProcessor.isShellRegisteredUrl(url) ||
            UriProcessor.isSettingsRegisteredUrl(url) ||
            UriProcessor.isDownloadRegisteredUrl(url)
        );
    }

    /**
     * Smart URL parser that mimics browser address bar behavior with the
     * following rules:
     *
     * 1. If the input contains spaces, treat it as a search query and use the
     *    default search engine.
     * 2. If the input already starts with a protocol (such as http://, https://,
     *    or ftp://), treat it as a URL.
     * 3. If the input matches common website patterns (such as example.com or
     *    www.example.com), automatically prepend https://.
     * 4. Treat all other inputs as search queries and use the default search
     *    engine.
     */
    static parseInput(
        uri: string,
        searchEngine: string = "https://www.google.com/search?q=",
    ) {
        if (
            UriProcessor.isApplicationRegisteredUrl(uri) ||
            uri == "about:blank"
        ) {
            return uri;
        }

        const source = uri.trim();

        // 1. If the input is a valid URL, return it as is.
        if (URL.canParse(source)) {
            return source;
        }

        // 2. Treat inputs containing spaces as search queries.
        if (source.includes(" ")) {
            return searchEngine + encodeURIComponent(source);
        }

        // 3. Check whether the input already includes a protocol.
        if (/^[a-z0-9]+:\/\//i.test(source)) {
            return source;
        }

        // 4. Detect common website-style hostnames.
        // Pattern: starts with letters or digits, contains dots, and ends with
        // a top-level domain of at least two characters (for example .com or .cn).
        if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(source)) {
            // Prepend http:// when the protocol is omitted.
            return `http://${source}`;
        }

        // 5. Fall back to the default search engine.
        return searchEngine + encodeURIComponent(source);
    }
}
