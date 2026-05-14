import "../../styles/pages.shell.agent-panel.css";

import {
    PaperAirplaneIcon,
    PlusIcon,
    QueueListIcon,
    SparklesIcon,
    StopIcon,
} from "@heroicons/react/24/outline";
import MarkdownIt from "markdown-it";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import AsyncButton from "../../components/async-button.tsx";
import { formatAgentActivity } from "../../services/agent-activity.ts";
import { useAgentStore } from "../../services/agent.ts";

const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
});

export default function AgentPanel() {
    const { t, i18n } = useTranslation();
    const [inputValue, setInputValue] = useState("");
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [expandedActivityMessageIds, setExpandedActivityMessageIds] = useState<number[]>([]);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const sessions = useAgentStore((state) => state.sessions);
    const conversations = useAgentStore((state) => state.conversations);
    const activeSessionId = useAgentStore((state) => state.activeSessionId);
    const isLoadingSessions = useAgentStore((state) => state.isLoadingSessions);
    const createSession = useAgentStore((state) => state.createSession);
    const selectSession = useAgentStore((state) => state.selectSession);
    const sendAgentMessage = useAgentStore((state) => state.sendMessage);
    const stopActiveResponse = useAgentStore((state) => state.stopActiveResponse);
    const providers = useAgentStore((state) => state.providers);
    const selectedProviderId = useAgentStore((state) => state.selectedProviderId);
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
    }, [activeConversation?.title, activeSessionId, fallbackConversationTitle, sessions]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const createNewConversation = async () => {
        const id = await createSession();
        if (id !== null) {
            setInputValue("");
            setIsHistoryOpen(false);
        }
    };

    const sendMessage = async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || isResponding || selectedProviderId === null || !selectedModel) {
            return;
        }

        setInputValue("");
        await sendAgentMessage({
            message: trimmed,
            provider: selectedProviderId,
            model: selectedModel,
            locale: i18n.resolvedLanguage ?? i18n.language,
        });
    };

    const renderAssistantMarkdown = (content: string) => ({
        __html: markdown.render(content),
    });

    const toggleActivities = (messageId: number) => {
        setExpandedActivityMessageIds((current) =>
            current.includes(messageId)
                ? current.filter((id) => id !== messageId)
                : [...current, messageId],
        );
    };

    return (
        <aside tag="agent-panel-shell" className="agent-panel-shell">
            <header tag="agent-panel-header" className="agent-panel-header">
                <span tag="agent-panel-title" className="agent-panel-title">
                    {chatTitle}
                </span>

                <div tag="agent-panel-actions" className="agent-panel-actions">
                    <AsyncButton
                        onClick={() => createNewConversation()}
                        className="agent-panel-action-button"
                    >
                        <PlusIcon className="agent-panel-action-icon" />
                        <span>{t("chat.add")}</span>
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
                <div tag="agent-history-popover" className="agent-history-popover">
                    <div tag="agent-history-label" className="agent-history-label">
                        {t("chat.history")}
                    </div>

                    {sessions.length === 0 ? (
                        <p className="agent-history-empty">{t("chat.emptyHistory")}</p>
                    ) : (
                        <div tag="agent-history-list" className="agent-history-list">
                            {sessions.map((session) => (
                                <button
                                    key={session.id}
                                    type="button"
                                    onClick={() => {
                                        selectSession(session.id);
                                        setIsHistoryOpen(false);
                                    }}
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
                    )}
                </div>
            )}

            <div tag="agent-message-stream" className="agent-message-stream">
                {isLoadingSessions && (
                    <div tag="agent-stream-banner" className="agent-stream-banner">
                        {t("chat.loadingSessions")}
                    </div>
                )}

                {messages.length === 0 ? (
                    <div tag="agent-empty-state" className="agent-empty-state">
                        <div tag="agent-empty-card" className="agent-empty-card">
                            <div tag="agent-empty-icon" className="agent-empty-icon">
                                <SparklesIcon className="agent-empty-icon-svg" />
                            </div>
                            <p className="agent-empty-greeting">{t("chat.greeting")}</p>
                        </div>
                    </div>
                ) : (
                    messages.map((message) => {
                        const hasActivities = Boolean(message.activities?.length);
                        const isStreamingAssistant =
                            message.role === "assistant" && message.status === "streaming";
                        const isActivityExpanded =
                            isStreamingAssistant || expandedActivityMessageIds.includes(message.id);
                        const shouldShowActivityPanel =
                            message.role === "assistant" && (hasActivities || isStreamingAssistant);
                        const assistantErrorText = message.error || "";
                        const assistantContent =
                            message.role === "assistant"
                                ? message.status === "streaming"
                                    ? ""
                                    : message.content || assistantErrorText
                                : message.content;

                        return (
                            <div
                                key={message.id}
                                className={[
                                    "agent-message",
                                    message.role === "user"
                                        ? "agent-message-user"
                                        : message.status === "error"
                                          ? "agent-message-error"
                                          : "agent-message-assistant",
                                ].join(" ")}
                            >
                                {shouldShowActivityPanel ? (
                                    <div className="agent-message-activities">
                                        {!isStreamingAssistant && hasActivities ? (
                                            <button
                                                type="button"
                                                onClick={() => toggleActivities(message.id)}
                                                className="agent-activity-toggle"
                                            >
                                                {isActivityExpanded
                                                    ? t("chat.hideActivity")
                                                    : t("chat.showActivity")}
                                            </button>
                                        ) : null}

                                        {isActivityExpanded ? (
                                            <div className="agent-activity-panel">
                                                {isStreamingAssistant ? (
                                                    <div className="agent-streaming-activity">
                                                        <div className="agent-streaming-activity-label">
                                                            {t("chat.activity")}
                                                        </div>
                                                        {message.content ? (
                                                            <div
                                                                className="agent-markdown agent-markdown-activity"
                                                                dangerouslySetInnerHTML={renderAssistantMarkdown(
                                                                    message.content,
                                                                )}
                                                            />
                                                        ) : (
                                                            <p className="agent-streaming-activity-placeholder">
                                                                {t("chat.thinking")}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : null}
                                                {message.activities?.map((activity) => {
                                                    const formatted = formatAgentActivity(
                                                        activity,
                                                        t,
                                                    );

                                                    return (
                                                        <div
                                                            key={activity.key}
                                                            className="agent-activity-item"
                                                        >
                                                            <div className="agent-activity-item-header">
                                                                <span
                                                                    className={[
                                                                        "agent-activity-status-dot",
                                                                        activity.status ===
                                                                        "running"
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
                                ) : null}

                                {message.role === "assistant" && assistantContent ? (
                                    <div
                                        className="agent-markdown"
                                        dangerouslySetInnerHTML={renderAssistantMarkdown(
                                            assistantContent,
                                        )}
                                    />
                                ) : message.role === "user" ? (
                                    <div
                                        className="agent-markdown"
                                        dangerouslySetInnerHTML={renderAssistantMarkdown(
                                            message.content,
                                        )}
                                    />
                                ) : null}
                                <p
                                    className={[
                                        "agent-message-timestamp",
                                        message.role === "user"
                                            ? "agent-message-timestamp-user"
                                            : message.status === "error"
                                              ? "agent-message-timestamp-error"
                                              : "agent-message-timestamp-default",
                                    ].join(" ")}
                                >
                                    {message.timestamp}
                                </p>
                                {isStreamingAssistant ? (
                                    <div className="task-progress-bar" aria-hidden="true" />
                                ) : null}
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <div tag="agent-composer" className="agent-composer">
                <textarea
                    rows={5}
                    value={inputValue}
                    disabled={isLoadingSessions}
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

                <div tag="agent-composer-controls" className="agent-composer-controls">
                    <select
                        value={selectedProviderId ?? ""}
                        onChange={(e) => {
                            void selectProvider(e.target.value);
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
                                    t(`settings.providerTypes.${provider.type}`)}
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
                        onClick={() => {
                            if (isResponding) {
                                void stopActiveResponse();

                                return;
                            }

                            void sendMessage();
                        }}
                        disabled={isLoadingSessions || providers.length === 0 || !selectedModel}
                        className="agent-composer-submit"
                        aria-label={isResponding ? t("chat.stopResponse") : t("chat.sendMessage")}
                        title={isResponding ? t("chat.stop") : t("chat.send")}
                    >
                        {isResponding ? (
                            <StopIcon className="agent-composer-submit-icon" />
                        ) : (
                            <PaperAirplaneIcon className="agent-composer-submit-icon" />
                        )}
                        <span>{isResponding ? t("chat.stop") : t("chat.send")}</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}
