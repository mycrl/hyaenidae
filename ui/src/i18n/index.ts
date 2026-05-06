import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import localesZhCn from "./locales/zh-CN.json";
import localesEn from "./locales/en.json";

i18n.use(initReactI18next).init({
    resources: {
        "zh-CN": {
            translation: localesZhCn,
        },
        en: {
            translation: localesEn,
        },
    },
    lng:
        typeof navigator !== "undefined" && navigator.language.startsWith("zh")
            ? "zh-CN"
            : "en",
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
