import "../../styles/pages.settings.browser-section.css";

import { useEffect, useState } from "react";
import type { AppSettings, Optional } from "@hyaenidae/bridge";
import { useTranslation } from "react-i18next";
import Card from "./components/card";
import FieldLabel from "./components/field-label";

type HomepageMode = "new-tab" | "custom-url";
type FontFamilyKey = keyof AppSettings["defaultFontFamily"];
type FontSizeOption = "x-small" | "small" | "medium" | "large" | "x-large";

const fontSizeValueMap: Record<FontSizeOption, number | null> = {
    "x-small": 12,
    small: 14,
    medium: null,
    large: 18,
    "x-large": 20,
};

const getFontSizeOption = (fontSize: Optional<number>): FontSizeOption => {
    switch (fontSize) {
        case 12:
            return "x-small";
        case 14:
            return "small";
        case 18:
            return "large";
        case 20:
            return "x-large";
        default:
            return "medium";
    }
};

const fontFamilyFields: Array<{ key: FontFamilyKey; labelKey: string }> = [
    {
        key: "standard",
        labelKey: "settings.browser.fonts.standardFontLabel",
    },
    {
        key: "serif",
        labelKey: "settings.browser.fonts.serifFontLabel",
    },
    {
        key: "sansSerif",
        labelKey: "settings.browser.fonts.sansSerifFontLabel",
    },
    {
        key: "monospace",
        labelKey: "settings.browser.fonts.monospaceFontLabel",
    },
];

const toNullableInputValue = (value: string): Optional<string> => {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
};

export default function BrowserSection({
    settings,
    onSettingsChange,
}: {
    settings: AppSettings;
    onSettingsChange: (patch: Partial<AppSettings>) => void;
}) {
    const { t } = useTranslation();
    const [fonts, setFonts] = useState<FontData[]>([]);
    const [homepageMode, setHomepageMode] = useState<HomepageMode>(
        settings.homeUrl ? "custom-url" : "new-tab",
    );
    const selectedFontSize = getFontSizeOption(settings.defaultFontSize);

    useEffect(() => {
        window
            .queryLocalFonts()
            .then((items) => {
                setFonts(items);
            })
            .catch(() => {
                setFonts([]);
            });
    }, []);

    useEffect(() => {
        setHomepageMode(settings.homeUrl ? "custom-url" : "new-tab");
    }, [settings.homeUrl]);

    return (
        <Card
            title={t("settings.sections.browser.title")}
            description={t("settings.sections.browser.description")}
        >
            <div className="browser-settings-stack">
                <section className="browser-settings-group">
                    <div className="browser-settings-group-header">
                        <h3 className="browser-settings-group-title">
                            {t("settings.browser.homepage.title")}
                        </h3>
                        <p className="browser-settings-group-description">
                            {t("settings.browser.homepage.description")}
                        </p>
                    </div>

                    <div className="browser-settings-homepage-options">
                        <select
                            value={homepageMode}
                            onChange={(event) => {
                                const nextMode = event.target
                                    .value as HomepageMode;

                                setHomepageMode(nextMode);

                                if (nextMode === "new-tab") {
                                    onSettingsChange({ homeUrl: null });
                                }
                            }}
                            className="browser-settings-select-control"
                        >
                            <option value="new-tab">
                                {t("settings.browser.homepage.openNewTab")}
                            </option>
                            <option value="custom-url">
                                {t("settings.browser.homepage.customUrl")}
                            </option>
                        </select>

                        {homepageMode === "custom-url" ? (
                            <input
                                type="text"
                                value={settings.homeUrl ?? ""}
                                onChange={(event) =>
                                    onSettingsChange({
                                        homeUrl: toNullableInputValue(
                                            event.target.value,
                                        ),
                                    })
                                }
                                placeholder={t(
                                    "settings.browser.homepage.customUrlPlaceholder",
                                )}
                                className="browser-settings-text-control"
                            />
                        ) : null}
                    </div>
                </section>

                <section className="browser-settings-group">
                    <div className="browser-settings-group-header">
                        <h3 className="browser-settings-group-title">
                            {t("settings.browser.fontSize.title")}
                        </h3>
                        <p className="browser-settings-group-description">
                            {t("settings.browser.fontSize.description")}
                        </p>
                    </div>

                    <div className="browser-settings-compact-field">
                        <select
                            value={selectedFontSize}
                            onChange={(event) => {
                                const option = event.target
                                    .value as FontSizeOption;

                                onSettingsChange({
                                    defaultFontSize: fontSizeValueMap[option],
                                });
                            }}
                            className="browser-settings-select-control"
                        >
                            <option value="x-small">
                                {t("settings.browser.fontSize.options.xSmall")}
                            </option>
                            <option value="small">
                                {t("settings.browser.fontSize.options.small")}
                            </option>
                            <option value="medium">
                                {t("settings.browser.fontSize.options.medium")}
                            </option>
                            <option value="large">
                                {t("settings.browser.fontSize.options.large")}
                            </option>
                            <option value="x-large">
                                {t("settings.browser.fontSize.options.xLarge")}
                            </option>
                        </select>
                    </div>
                </section>

                <section className="browser-settings-group">
                    <div className="browser-settings-group-header">
                        <h3 className="browser-settings-group-title">
                            {t("settings.browser.fonts.title")}
                        </h3>
                        <p className="browser-settings-group-description">
                            {t("settings.browser.fonts.description")}
                        </p>
                    </div>

                    <div className="browser-settings-font-grid">
                        {fontFamilyFields.map((item) => (
                            <FieldLabel
                                key={item.key}
                                label={t(item.labelKey)}
                                className="mb-[10px]"
                            >
                                <select
                                    value={
                                        settings.defaultFontFamily[item.key] ??
                                        "system"
                                    }
                                    onChange={(event) =>
                                        onSettingsChange({
                                            defaultFontFamily: {
                                                ...settings.defaultFontFamily,
                                                [item.key]:
                                                    event.target.value ===
                                                    "system"
                                                        ? null
                                                        : event.target.value,
                                            },
                                        })
                                    }
                                    className="browser-settings-select-control"
                                >
                                    <option value="system">
                                        {t(
                                            "settings.browser.fonts.options.system",
                                        )}
                                    </option>
                                    {fonts.map((font) => (
                                        <option
                                            key={font.fullName}
                                            value={font.fullName}
                                        >
                                            {font.fullName}
                                        </option>
                                    ))}
                                </select>
                                <p
                                    className="text-sample"
                                    style={{
                                        fontFamily:
                                            settings.defaultFontFamily[
                                                item.key
                                            ] ?? "system",
                                        fontSize: settings.defaultFontSize
                                            ? `${settings.defaultFontSize}px`
                                            : undefined,
                                    }}
                                >
                                    {settings.defaultFontSize || "default"}: The
                                    quick brown fox jumps over the lazy dog
                                </p>
                            </FieldLabel>
                        ))}
                    </div>
                </section>
            </div>
        </Card>
    );
}
