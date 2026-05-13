import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import localesZhCn from "./locales/zh-CN.json";
import localesEnUs from "./locales/en-US.json";

i18n.use(initReactI18next).init({
    resources: {
        "zh-CN": {
            translation: localesZhCn,
        },
        "en-US": {
            translation: localesEnUs,
        },
    },
    lng:
        typeof navigator !== "undefined" && navigator.language.startsWith("zh") ? "zh-CN" : "en-US",
    fallbackLng: "en-US",
    initAsync: false,
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
