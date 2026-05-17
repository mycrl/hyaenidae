import "../../styles/PageContent.css";

type PageContentProps = {
    visible: boolean;
    loading: boolean;
};

const SEARCH_RESULTS = [
    {
        site: "**************.com",
        title: "New York, NY Weather Forecast",
        snippet:
            "Hourly and daily forecast for Manhattan. Partly cloudy today with highs near 58°F.",
    },
    {
        site: "**************.com",
        title: "New York City, NY — 10-Day Weather",
        snippet:
            "See temperature, rain chance, and wind for the next 10 days in NYC.",
    },
    {
        site: "**************.com",
        title: "Weather for New York — Today",
        snippet: "Current conditions, sunrise at 6:42 AM, sunset at 7:18 PM.",
    },
] as const;

const FORECAST = [
    { day: "Fri", hi: 58, lo: 44, icon: "partly" },
    { day: "Sat", hi: 55, lo: 42, icon: "cloud" },
    { day: "Sun", hi: 52, lo: 40, icon: "rain" },
    { day: "Mon", hi: 49, lo: 38, icon: "cloud" },
    { day: "Tue", hi: 51, lo: 39, icon: "sun" },
    { day: "Wed", hi: 54, lo: 41, icon: "partly" },
    { day: "Thu", hi: 56, lo: 43, icon: "sun" },
] as const;

/** Simplified dark-mode search page (weather + results). */
export default function PageContent({ visible, loading }: PageContentProps) {
    return (
        <div
            className={[
                "page-content",
                visible ? "page-content-visible" : "",
                loading ? "page-content-loading" : "",
            ].join(" ")}
            aria-hidden={!visible}
        >
            <header className="page-header">
                <span className="page-logo-text">G</span>
                <div className="page-search">
                    <span className="page-search-query">
                        New York weather today
                    </span>
                    <div className="page-search-tools" aria-hidden>
                        <span className="page-search-tool" />
                        <span className="page-search-tool" />
                    </div>
                </div>
                <span className="page-signin">Sign in</span>
            </header>

            <nav className="page-tabs" aria-label="Search filters">
                {["All", "Images", "News", "Videos", "Maps"].map((label, i) => (
                    <button
                        key={label}
                        type="button"
                        className={[
                            "page-tab",
                            i === 0 ? "page-tab-active" : "",
                        ].join(" ")}
                    >
                        {label}
                    </button>
                ))}
            </nav>

            <section
                className={[
                    "page-weather",
                    loading ? "page-block-loading" : "",
                ].join(" ")}
                aria-label="Weather"
            >
                <div className="weather-main">
                    <div className="weather-current">
                        <span className="weather-temp">54</span>
                        <span className="weather-unit">°F</span>
                        <WeatherIcon
                            type="partly"
                            className="weather-icon-lg"
                        />
                    </div>
                    <div className="weather-details">
                        <p className="weather-condition">Partly cloudy</p>
                        <p className="weather-stats">
                            Precip 2% · Humidity 65% · Wind 7 mph
                        </p>
                    </div>
                </div>

                <div className="weather-chart" aria-hidden>
                    <svg viewBox="0 0 320 48" preserveAspectRatio="none">
                        <polyline
                            points="0,32 40,28 80,22 120,18 160,24 200,20 240,26 280,22 320,28"
                            fill="none"
                            stroke="#fbbc04"
                            strokeWidth="2"
                        />
                    </svg>
                </div>

                <ul className="weather-forecast">
                    {FORECAST.map((day) => (
                        <li key={day.day} className="forecast-item">
                            <span className="forecast-day">{day.day}</span>
                            <WeatherIcon
                                type={day.icon}
                                className="forecast-icon"
                            />
                            <span className="forecast-temps">
                                {day.hi}°{" "}
                                <span className="forecast-lo">{day.lo}°</span>
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="page-results" aria-label="Search results">
                {SEARCH_RESULTS.map((result) => (
                    <article
                        key={result.title}
                        className={[
                            "result-item",
                            loading ? "page-block-loading" : "",
                        ].join(" ")}
                    >
                        <div className="result-site-row">
                            <span className="result-favicon" aria-hidden />
                            <span className="result-site">{result.site}</span>
                        </div>
                        <h3 className="result-title">{result.title}</h3>
                        <p className="result-snippet">{result.snippet}</p>
                    </article>
                ))}
            </section>
        </div>
    );
}

function WeatherIcon({
    type,
    className,
}: {
    type: "sun" | "partly" | "cloud" | "rain";
    className?: string;
}) {
    return (
        <span
            className={["weather-icon", `weather-icon-${type}`, className].join(
                " ",
            )}
            aria-hidden
        />
    );
}
