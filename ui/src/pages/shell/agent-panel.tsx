import "../../styles/pages.shell.agent-panel.css";

import {
    PaperAirplaneIcon,
    PlusIcon,
    QueueListIcon,
    SparklesIcon,
    StopIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import MarkdownIt from "markdown-it";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import AsyncButton from "../../components/async-button.tsx";
import {
    AGENT_ERROR_CODE,
    type ComposerInsertionItem,
    type AgentErrorCode,
    type AgentErrorState,
    type AgentMessage,
    type AgentSessionItem,
} from "../../services/agent.state";
import { useAgentStore } from "../../services/agent.state";
import { formatAgentActivity } from "./agent-activity";

const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
});

const renderMarkdown = (content: string) => ({
    __html: markdown.render(content),
});

const toggleExpandedId = (ids: number[], id: number) =>
    ids.includes(id)
        ? ids.filter((currentId) => currentId !== id)
        : [...ids, id];

const getAgentErrorTranslationKey = (
    code: AgentErrorCode | null | undefined,
) => (code ? AGENT_ERROR_TRANSLATION_KEYS[code] : null);

const getAgentErrorTitle = (
    message: AgentMessage,
    t: ReturnType<typeof useTranslation>["t"],
) => {
    if (message.errorCode) {
        return t(
            getAgentErrorTranslationKey(message.errorCode) ??
                "common.errorTitle",
        );
    }

    return t("common.errorTitle");
};

const getAgentErrorDetail = (message: AgentMessage) =>
    message.error || message.content || "";

const getReasoningText = (activities: AgentMessage["activities"]) => {
    let text = "";

    for (const activity of activities ?? []) {
        if (activity.kind !== "reasoning") {
            continue;
        }

        if (
            typeof activity.data === "object" &&
            activity.data !== null &&
            "text" in activity.data &&
            typeof activity.data.text === "string"
        ) {
            text += activity.data.text;
        }
    }

    return text;
};

const getAssistantContent = (
    message: AgentMessage,
    t: ReturnType<typeof useTranslation>["t"],
) => {
    if (message.role !== "assistant") {
        return message.content;
    }

    if (message.status === "error") {
        return "";
    }

    if (message.status === "streaming") {
        const reasoning = getReasoningText(message.activities).trim();
        const reply = message.content.trim();

        return [reasoning, reply].filter(Boolean).join("\n\n");
    }

    return (
        message.content ||
        (message.errorCode
            ? t(
                  getAgentErrorTranslationKey(message.errorCode) ??
                      "common.errorTitle",
              )
            : "") ||
        message.error ||
        ""
    );
};

const getMessageClassName = (message: AgentMessage) =>
    [
        "agent-message",
        message.role === "user"
            ? "agent-message-user"
            : message.status === "error"
              ? "agent-message-error"
              : "agent-message-assistant",
    ].join(" ");

const getTimestampClassName = (message: AgentMessage) =>
    [
        "agent-message-timestamp",
        message.role === "user"
            ? "agent-message-timestamp-user"
            : message.status === "error"
              ? "agent-message-timestamp-error"
              : "agent-message-timestamp-default",
    ].join(" ");

const AGENT_ERROR_TRANSLATION_KEYS: Record<
    NonNullable<AgentErrorState["code"]>,
    string
> = {
    [AGENT_ERROR_CODE.FAILED_TO_LOAD_SESSIONS]: "chat.failedToLoadSessions",
    [AGENT_ERROR_CODE.FAILED_TO_LOAD_SESSION]: "chat.failedToLoadSession",
    [AGENT_ERROR_CODE.FAILED_TO_CREATE_SESSION]: "chat.failedToCreateSession",
    [AGENT_ERROR_CODE.FAILED_TO_LOAD_MODELS]: "chat.failedToLoadModels",
    [AGENT_ERROR_CODE.FAILED_TO_SEND]: "chat.failedToSend",
    [AGENT_ERROR_CODE.FAILED_TO_STOP]: "chat.failedToStop",
};

export default function AgentPanel() {
    const { t, i18n } = useTranslation();
    const [inputValue, setInputValue] = useState("");
    const [composerContextItems, setComposerContextItems] = useState<
        ComposerInsertionItem[]
    >([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [expandedActivityMessageIds, setExpandedActivityMessageIds] =
        useState<number[]>([]);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const composerRef = useRef<HTMLTextAreaElement | null>(null);
    const sessions = useAgentStore((state) => state.sessions);
    const conversations = useAgentStore((state) => state.conversations);
    const initialized = useAgentStore((state) => state.initialized);
    const activeSessionId = useAgentStore((state) => state.activeSessionId);
    const isLoadingSessions = useAgentStore((state) => state.isLoadingSessions);
    const isLoadingConversation = useAgentStore(
        (state) => state.isLoadingConversation,
    );
    const isLoadingChat = isLoadingSessions || isLoadingConversation;
    const createSession = useAgentStore((state) => state.createSession);
    const ensureActiveSession = useAgentStore(
        (state) => state.ensureActiveSession,
    );
    const selectSession = useAgentStore((state) => state.selectSession);
    const composerInsertion = useAgentStore((state) => state.composerInsertion);
    const clearComposerInsertion = useAgentStore(
        (state) => state.clearComposerInsertion,
    );
    const error = useAgentStore((state) => state.error);
    const clearError = useAgentStore((state) => state.clearError);
    const sendAgentMessage = useAgentStore((state) => state.sendMessage);
    const stopActiveResponse = useAgentStore(
        (state) => state.stopActiveResponse,
    );
    const providers = useAgentStore((state) => state.providers);
    const selectedProviderId = useAgentStore(
        (state) => state.selectedProviderId,
    );
    const selectProvider = useAgentStore((state) => state.selectProvider);
    const models = useAgentStore((state) => state.models);
    const selectedModel = useAgentStore((state) => state.selectedModel);
    const setSelectedModel = useAgentStore((state) => state.setSelectedModel);

    const activeConversation =
        activeSessionId !== null ? conversations[activeSessionId] : undefined;
    const messages = activeConversation?.messages ?? [];
    const isResponding = activeConversation?.isResponding ?? false;
    const fallbackConversationTitle = t("chat.newConversation");

    const chatTitle = useMemo(() => {
        if (activeSessionId === null) {
            return fallbackConversationTitle;
        }

        const title =
            activeConversation?.title ||
            sessions.find((session) => session.id === activeSessionId)?.name;

        return title?.trim() || fallbackConversationTitle;
    }, [
        activeConversation?.title,
        activeSessionId,
        fallbackConversationTitle,
        sessions,
    ]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (!initialized || isLoadingChat) {
            return;
        }

        if (sessions.length > 0 && activeSessionId !== null) {
            return;
        }

        void ensureActiveSession();
    }, [
        activeSessionId,
        ensureActiveSession,
        initialized,
        isLoadingChat,
        sessions.length,
    ]);

    useEffect(() => {
        if (!composerInsertion) {
            return;
        }

        setComposerContextItems((current) => {
            if (
                current.some(
                    (item) => item.dedupeKey === composerInsertion.dedupeKey,
                )
            ) {
                return current;
            }

            return [...current, composerInsertion];
        });
        clearComposerInsertion();

        requestAnimationFrame(() => {
            composerRef.current?.focus();
            const length = composerRef.current?.value.length ?? 0;
            composerRef.current?.setSelectionRange(length, length);
        });
    }, [clearComposerInsertion, composerInsertion]);

    const createNewConversation = async () => {
        const id = await createSession();
        if (id !== null) {
            setInputValue("");
            setComposerContextItems([]);
            setIsHistoryOpen(false);
        }
    };

    const removeComposerContextItem = (id: number) => {
        setComposerContextItems((current) =>
            current.filter((item) => item.id !== id),
        );
    };

    const sendMessage = async () => {
        const trimmed = inputValue.trim();
        const contexts = composerContextItems.map((item) => item.context);

        if (
            (!trimmed && contexts.length === 0) ||
            isResponding ||
            selectedProviderId == null ||
            !selectedModel
        ) {
            return;
        }

        setInputValue("");
        setComposerContextItems([]);
        await sendAgentMessage({
            message: trimmed,
            provider: selectedProviderId,
            model: selectedModel,
            language: i18n.resolvedLanguage ?? i18n.language,
            ...(contexts.length > 0 ? { contexts } : {}),
        });
    };

    const toggleActivities = (messageId: number) => {
        setExpandedActivityMessageIds((current) =>
            toggleExpandedId(current, messageId),
        );
    };

    const submitComposer = () => {
        if (isResponding) {
            stopActiveResponse();

            return;
        }

        sendMessage();
    };

    const isComposerDisabled =
        isLoadingChat || providers.length === 0 || !selectedModel;
    const agentErrorTitle = error?.code
        ? t(AGENT_ERROR_TRANSLATION_KEYS[error.code])
        : null;

    return (
        <aside tag="agent-panel-shell" className="agent-panel-shell">
            <header tag="agent-panel-header" className="agent-panel-header">
                <span tag="agent-panel-title" className="agent-panel-title">
                    {chatTitle}
                </span>

                <div tag="agent-panel-actions" className="agent-panel-actions">
                    <AsyncButton
                        onClick={() => createNewConversation()}
                        icon={<PlusIcon className="agent-panel-action-icon" />}
                        className="agent-panel-action-button"
                    >
                        {t("chat.add")}
                    </AsyncButton>

                    <button
                        type="button"
                        onClick={() => setIsHistoryOpen((value) => !value)}
                        className="agent-panel-action-button"
                    >
                        <QueueListIcon className="agent-panel-action-icon" />
                        <span>{t("chat.history")}</span>
                    </button>
                </div>
            </header>

            {isHistoryOpen && (
                <div
                    tag="agent-history-popover"
                    className="agent-history-popover"
                >
                    <div
                        tag="agent-history-label"
                        className="agent-history-label"
                    >
                        {t("chat.history")}
                    </div>

                    <SessionHistory
                        sessions={sessions}
                        conversations={conversations}
                        activeSessionId={activeSessionId}
                        fallbackConversationTitle={fallbackConversationTitle}
                        onSelectSession={(sessionId) => {
                            void selectSession(sessionId);
                            setIsHistoryOpen(false);
                        }}
                        emptyText={t("chat.emptyHistory")}
                    />
                </div>
            )}

            <div tag="agent-message-stream" className="agent-message-stream">
                {error ? (
                    <div className="agent-error-banner" role="alert">
                        <div className="agent-error-copy">
                            <div className="agent-error-title">
                                {agentErrorTitle ?? t("common.errorTitle")}
                            </div>
                            {error.message ? (
                                <div className="agent-error-message">
                                    {error.message}
                                </div>
                            ) : null}
                        </div>

                        <button
                            type="button"
                            onClick={clearError}
                            aria-label={t("common.dismiss")}
                            className="agent-error-dismiss"
                        >
                            <XMarkIcon className="agent-error-dismiss-icon" />
                        </button>
                    </div>
                ) : null}

                {isLoadingChat && (
                    <div
                        tag="agent-stream-banner"
                        className="agent-stream-banner"
                    >
                        {t("chat.loadingSessions")}
                    </div>
                )}

                {messages.length === 0 ? (
                    <div tag="agent-empty-state" className="agent-empty-state">
                        <div
                            tag="agent-empty-card"
                            className="agent-empty-card"
                        >
                            <div
                                tag="agent-empty-icon"
                                className="agent-empty-icon"
                            >
                                <SparklesIcon className="agent-empty-icon-svg" />
                            </div>
                            <p className="agent-empty-greeting">
                                {t("chat.greeting")}
                            </p>
                        </div>
                    </div>
                ) : (
                    messages.map((message) => (
                        <MessageItem
                            key={message.id}
                            message={message}
                            isActivityExpanded={expandedActivityMessageIds.includes(
                                message.id,
                            )}
                            onToggleActivities={() =>
                                toggleActivities(message.id)
                            }
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div tag="agent-composer" className="agent-composer">
                {composerContextItems.length > 0 ? (
                    <div className="agent-composer-context-list">
                        {composerContextItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                    removeComposerContextItem(item.id)
                                }
                                className="agent-composer-context-chip"
                                title={item.label}
                            >
                                <span className="agent-composer-context-chip-label">
                                    {item.label}
                                </span>
                                <XMarkIcon className="agent-composer-context-chip-icon" />
                            </button>
                        ))}
                    </div>
                ) : null}

                <textarea
                    ref={composerRef}
                    rows={5}
                    value={inputValue}
                    disabled={isLoadingChat}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                        }
                    }}
                    placeholder={t("chat.prompt")}
                    className="agent-composer-textarea"
                />

                <div
                    tag="agent-composer-controls"
                    className="agent-composer-controls"
                >
                    <select
                        value={selectedProviderId ?? ""}
                        onChange={(e) => {
                            selectProvider(e.target.value);
                        }}
                        aria-label={t("chat.provider")}
                        className="agent-composer-select agent-composer-provider-select"
                    >
                        {providers.length === 0 ? (
                            <option value="">{t("chat.noProviders")}</option>
                        ) : null}
                        {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                                {provider.name?.trim() ||
                                    t(
                                        `settings.providerTypes.${provider.type}`,
                                    )}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedModel ?? ""}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        aria-label={t("chat.model")}
                        className="agent-composer-select agent-composer-model-select"
                    >
                        <option value="">{t("chat.selectModel")}</option>
                        {models.map((model) => (
                            <option key={model} value={model}>
                                {model}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={submitComposer}
                        disabled={isComposerDisabled}
                        className="agent-composer-submit"
                        aria-label={
                            isResponding
                                ? t("chat.stopResponse")
                                : t("chat.sendMessage")
                        }
                        title={isResponding ? t("chat.stop") : t("chat.send")}
                    >
                        {isResponding ? (
                            <StopIcon className="agent-composer-submit-icon" />
                        ) : (
                            <PaperAirplaneIcon className="agent-composer-submit-icon" />
                        )}
                        <span>
                            {isResponding ? t("chat.stop") : t("chat.send")}
                        </span>
                    </button>
                </div>
            </div>
        </aside>
    );
}

function SessionHistory({
    sessions,
    conversations,
    activeSessionId,
    fallbackConversationTitle,
    onSelectSession,
    emptyText,
}: {
    sessions: AgentSessionItem[];
    conversations: Record<number, { title?: string }>;
    activeSessionId: number | null;
    fallbackConversationTitle: string;
    onSelectSession: (sessionId: number) => void;
    emptyText: string;
}) {
    if (sessions.length === 0) {
        return <p className="agent-history-empty">{emptyText}</p>;
    }

    return (
        <div tag="agent-history-list" className="agent-history-list">
            {sessions.map((session) => (
                <button
                    key={session.id}
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                    className={[
                        "agent-history-item",
                        session.id === activeSessionId
                            ? "agent-history-item-active"
                            : "agent-history-item-inactive",
                    ].join(" ")}
                >
                    {conversations[session.id]?.title?.trim() ||
                        session.name?.trim() ||
                        fallbackConversationTitle}
                </button>
            ))}
        </div>
    );
}

function MessageItem({
    message,
    isActivityExpanded,
    onToggleActivities,
}: {
    message: AgentMessage;
    isActivityExpanded: boolean;
    onToggleActivities: () => void;
}) {
    const { t } = useTranslation();
    const hasActivities = Boolean(message.activities?.length);
    const hasOperationalActivities = Boolean(
        message.activities?.some((activity) => activity.kind !== "reasoning"),
    );
    const isStreamingAssistant =
        message.role === "assistant" && message.status === "streaming";
    const isErrorAssistant =
        message.role === "assistant" && message.status === "error";
    const shouldShowActivityPanel =
        message.role === "assistant" &&
        (hasOperationalActivities ||
            (!isStreamingAssistant && hasActivities));
    const isPanelExpanded = isStreamingAssistant
        ? hasOperationalActivities
        : isActivityExpanded;
    const messageContent = getAssistantContent(message, t);
    const errorDetail = isErrorAssistant ? getAgentErrorDetail(message) : "";
    const shouldRenderMessageBody =
        isErrorAssistant ||
        message.role === "user" ||
        Boolean(messageContent) ||
        isStreamingAssistant;

    return (
        <div className={getMessageClassName(message)}>
            {shouldShowActivityPanel ? (
                <ActivityPanel
                    message={message}
                    isStreamingAssistant={isStreamingAssistant}
                    hasActivities={hasActivities}
                    isExpanded={isPanelExpanded}
                    onToggle={onToggleActivities}
                    showActivityLabel={t("chat.showActivity")}
                    hideActivityLabel={t("chat.hideActivity")}
                />
            ) : null}

            {isErrorAssistant ? (
                <div className="agent-message-error-content">
                    <div className="agent-message-error-title">
                        {getAgentErrorTitle(message, t)}
                    </div>
                    {errorDetail ? (
                        <pre className="agent-message-error-detail">
                            {errorDetail}
                        </pre>
                    ) : null}
                </div>
            ) : shouldRenderMessageBody ? (
                messageContent ? (
                    <div
                        className="agent-markdown"
                        dangerouslySetInnerHTML={renderMarkdown(
                            message.role === "assistant"
                                ? messageContent
                                : message.content,
                        )}
                    />
                ) : isStreamingAssistant ? (
                    <p className="agent-streaming-placeholder">
                        {t("chat.thinking")}
                    </p>
                ) : null
            ) : null}

            <p className={getTimestampClassName(message)}>
                {message.timestamp}
            </p>

            {isStreamingAssistant ? (
                <div className="task-progress-bar" aria-hidden="true" />
            ) : null}
        </div>
    );
}

function ActivityPanel({
    message,
    isStreamingAssistant,
    hasActivities,
    isExpanded,
    onToggle,
    showActivityLabel,
    hideActivityLabel,
}: {
    message: AgentMessage;
    isStreamingAssistant: boolean;
    hasActivities: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    showActivityLabel: string;
    hideActivityLabel: string;
}) {
    const { t } = useTranslation();

    return (
        <div className="agent-message-activities">
            {!isStreamingAssistant && hasActivities ? (
                <button
                    type="button"
                    onClick={onToggle}
                    className="agent-activity-toggle"
                >
                    {isExpanded ? hideActivityLabel : showActivityLabel}
                </button>
            ) : null}

            {isExpanded ? (
                <div className="agent-activity-panel">
                    {message.activities?.map((activity) => {
                        if (activity.kind === "reasoning") {
                            return null;
                        }
                        const formatted = formatAgentActivity(activity, t);

                        return (
                            <div
                                key={activity.key}
                                className="agent-activity-item"
                            >
                                <div className="agent-activity-item-header">
                                    <span
                                        className={[
                                            "agent-activity-status-dot",
                                            activity.status === "running"
                                                ? "agent-activity-status-dot-running"
                                                : "agent-activity-status-dot-completed",
                                        ].join(" ")}
                                    />
                                    <span className="agent-activity-title">
                                        {formatted.title}
                                    </span>
                                </div>
                                {formatted.detail ? (
                                    <p className="agent-activity-detail">
                                        {formatted.detail}
                                    </p>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
