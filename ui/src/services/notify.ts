import { create } from "zustand";
import i18n from "../i18n";

export const GLOBAL_ERROR_CODE = {
    LOAD_SESSIONS_FAILED: "load_sessions_failed",
    NO_PROVIDERS_CONFIGURED: "no_providers_configured",
    LOAD_MODELS_FAILED: "load_models_failed",
    CREATE_SESSION_FAILED: "create_session_failed",
    MODEL_REQUIRED: "model_required",
    SEND_MESSAGE_FAILED: "send_message_failed",
    STOP_RESPONSE_FAILED: "stop_response_failed",
} as const;

export interface GlobalErrorState {
    title: string | null;
    message: string | null;
    code: (typeof GLOBAL_ERROR_CODE)[keyof typeof GLOBAL_ERROR_CODE] | null;
}

export type GlobalErrorCode = NonNullable<GlobalErrorState["code"]>;

export const GLOBAL_ERROR_TRANSLATION_KEYS: Record<GlobalErrorCode, string> = {
    [GLOBAL_ERROR_CODE.LOAD_SESSIONS_FAILED]: "chat.failedToLoadSessions",
    [GLOBAL_ERROR_CODE.NO_PROVIDERS_CONFIGURED]: "chat.noProvidersConfigured",
    [GLOBAL_ERROR_CODE.LOAD_MODELS_FAILED]: "chat.failedToLoadModels",
    [GLOBAL_ERROR_CODE.CREATE_SESSION_FAILED]: "chat.failedToCreateSession",
    [GLOBAL_ERROR_CODE.MODEL_REQUIRED]: "chat.modelRequired",
    [GLOBAL_ERROR_CODE.SEND_MESSAGE_FAILED]: "chat.failedToSend",
    [GLOBAL_ERROR_CODE.STOP_RESPONSE_FAILED]: "chat.failedToStop",
};

async function notifyGlobalError(title: string, message: string | null, tag: string) {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
        return;
    }

    const permission =
        Notification.permission === "default"
            ? await Notification.requestPermission()
            : Notification.permission;

    if (permission !== "granted") {
        return;
    }

    const notification = new Notification(title, {
        body: message ?? undefined,
        tag,
    });

    window.setTimeout(() => {
        notification.close();
    }, 6000);
}

function resolveGlobalErrorMessage(input: {
    message?: string | null;
    code?: GlobalErrorCode | null;
}) {
    if (input.message) {
        return input.message;
    }

    if (input.code) {
        return i18n.t(GLOBAL_ERROR_TRANSLATION_KEYS[input.code]);
    }

    return null;
}

function resolveGlobalErrorTitle(input: { title?: string | null; code?: GlobalErrorCode | null }) {
    if (input.title) {
        return input.title;
    }

    if (input.code) {
        return i18n.t(GLOBAL_ERROR_TRANSLATION_KEYS[input.code]);
    }

    return i18n.t("common.errorTitle");
}

const setGlobalError = (
    input:
        | string
        | { title?: string | null; message?: string | null; code?: GlobalErrorCode | null },
) => {
    const nextError =
        typeof input === "string"
            ? { title: null, message: input, code: null }
            : {
                  title: input.title ?? null,
                  message: input.message ?? null,
                  code: input.code ?? null,
              };
    const resolvedTitle = resolveGlobalErrorTitle(nextError);
    const resolvedMessage = resolveGlobalErrorMessage(nextError);

    useGlobalErrorStore.setState(nextError);

    void notifyGlobalError(
        resolvedTitle,
        resolvedMessage,
        `global-error-${nextError.code ?? "message"}-${Date.now()}`,
    ).finally(() => {
        clearGlobalError();
    });
};

export const useGlobalErrorStore = create<GlobalErrorState>(() => ({
    title: null,
    message: null,
    code: null,
}));

export const showGlobalError = (
    input:
        | string
        | { title?: string | null; message?: string | null; code?: GlobalErrorCode | null },
) => {
    setGlobalError(input);
};

export const showGlobalAgentError = (error: {
    code: GlobalErrorCode | null;
    message: string | null;
}) => {
    setGlobalError(
        error.message || error.code
            ? { code: error.code, message: error.message }
            : error.code
              ? { code: error.code }
              : { title: null, message: null, code: null },
    );
};

export const clearGlobalError = () => {
    useGlobalErrorStore.setState({
        title: null,
        message: null,
        code: null,
    });
};
