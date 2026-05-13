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
import AsyncButton from "../../../components/AsyncButton";
import { formatAgentActivity } from "../agent-activity.ts";
import { useAgentStore } from "../../../state/agent.ts";

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
        <aside
            tag="agent-panel-shell"
            className="relative h-full w-full flex flex-col bg-white text-slate-800"
        >
            <header
                tag="agent-panel-header"
                className="h-12 border-b border-slate-200 px-3 flex items-center justify-between bg-white"
            >
                <span tag="agent-panel-title" className="text-xs truncate">
                    {chatTitle}
                </span>

                <div tag="agent-panel-actions" className="flex items-center gap-2">
                    <AsyncButton
                        onClick={() => createNewConversation()}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span>{t("chat.add")}</span>
                    </AsyncButton>

                    <button
                        type="button"
                        onClick={() => setIsHistoryOpen((value) => !value)}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                    >
                        <QueueListIcon className="w-3.5 h-3.5" />
                        <span>{t("chat.history")}</span>
                    </button>
                </div>
            </header>

            {isHistoryOpen && (
                <div
                    tag="agent-history-popover"
                    className="absolute right-3 top-14 z-10 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                >
                    <div
                        tag="agent-history-label"
                        className="mb-2 px-2 text-[11px] uppercase tracking-[0.16em] text-slate-400"
                    >
                        {t("chat.history")}
                    </div>

                    {sessions.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-slate-500">{t("chat.emptyHistory")}</p>
                    ) : (
                        <div
                            tag="agent-history-list"
                            className="max-h-72 overflow-y-auto space-y-1"
                        >
                            {sessions.map((session) => (
                                <button
                                    key={session.id}
                                    type="button"
                                    onClick={() => {
                                        selectSession(session.id);
                                        setIsHistoryOpen(false);
                                    }}
                                    className={[
                                        "w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                                        session.id === activeSessionId
                                            ? "bg-slate-900 text-white"
                                            : "text-slate-700 hover:bg-slate-50",
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

            <div
                tag="agent-message-stream"
                className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-3 py-3 space-y-3"
            >
                {isLoadingSessions && (
                    <div
                        tag="agent-stream-banner"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"
                    >
                        {t("chat.loadingSessions")}
                    </div>
                )}

                {messages.length === 0 ? (
                    <div
                        tag="agent-empty-state"
                        className="h-full min-h-[160px] flex items-center justify-center"
                    >
                        <div tag="agent-empty-card" className="max-w-[360px] text-center px-6">
                            <div
                                tag="agent-empty-icon"
                                className="mx-auto mb-4 h-11 w-11 rounded-2xl bg-blue-50/70 text-blue-600 flex items-center justify-center"
                            >
                                <SparklesIcon className="w-5 h-5" />
                            </div>
                            <p className="text-sm text-slate-600 leading-7">{t("chat.greeting")}</p>
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
                                    "relative max-w-[90%] overflow-hidden rounded-2xl px-3 py-2.5 text-xs leading-6 shadow-sm",
                                    message.role === "user"
                                        ? "ml-auto bg-blue-600 text-white"
                                        : message.status === "error"
                                          ? "mr-auto border border-red-200 bg-red-50 text-red-700"
                                          : "mr-auto border border-slate-200 bg-white text-slate-800",
                                ].join(" ")}
                            >
                                {shouldShowActivityPanel ? (
                                    <div className="mb-2">
                                        {!isStreamingAssistant && hasActivities ? (
                                            <button
                                                type="button"
                                                onClick={() => toggleActivities(message.id)}
                                                className="mb-2 inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                            >
                                                {isActivityExpanded
                                                    ? t("chat.hideActivity")
                                                    : t("chat.showActivity")}
                                            </button>
                                        ) : null}

                                        {isActivityExpanded ? (
                                            <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
                                                {isStreamingAssistant ? (
                                                    <div className="rounded-lg border border-sky-100 bg-white px-2.5 py-2 text-[11px] leading-5 text-slate-600">
                                                        <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">
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
                                                            <p className="text-slate-400">
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
                                                            className="text-[11px] leading-5 text-slate-500"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className={[
                                                                        "inline-block h-1.5 w-1.5 rounded-full",
                                                                        activity.status ===
                                                                        "running"
                                                                            ? "bg-amber-400"
                                                                            : "bg-emerald-500",
                                                                    ].join(" ")}
                                                                />
                                                                <span className="text-slate-600">
                                                                    {formatted.title}
                                                                </span>
                                                            </div>
                                                            {formatted.detail ? (
                                                                <p className="mt-0.5 pl-3.5 text-slate-400 break-all">
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
                                        "mt-1 text-[11px]",
                                        message.role === "user"
                                            ? "text-blue-100"
                                            : message.status === "error"
                                              ? "text-red-400"
                                              : "text-slate-400",
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

            <div tag="agent-composer" className="border-t border-slate-200 bg-white p-3 text-xs">
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
                    className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white"
                />

                <div tag="agent-composer-controls" className="mt-2 flex items-center gap-2">
                    <select
                        value={selectedProviderId ?? ""}
                        onChange={(e) => {
                            void selectProvider(e.target.value);
                        }}
                        aria-label={t("chat.provider")}
                        className="h-8 max-w-[160px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-slate-700 outline-none"
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
                        className="h-8 max-w-[180px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-slate-700 outline-none"
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
                        className="ml-auto h-8 px-3 rounded-lg bg-blue-600 text-white flex items-center gap-1.5 justify-center hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:bg-slate-300"
                        aria-label={isResponding ? t("chat.stopResponse") : t("chat.sendMessage")}
                        title={isResponding ? t("chat.stop") : t("chat.send")}
                    >
                        {isResponding ? (
                            <StopIcon className="w-3.5 h-3.5" />
                        ) : (
                            <PaperAirplaneIcon className="w-3.5 h-3.5" />
                        )}
                        <span>{isResponding ? t("chat.stop") : t("chat.send")}</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}
