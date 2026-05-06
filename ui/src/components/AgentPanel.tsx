import {
    PaperAirplaneIcon,
    PlusIcon,
    QueueListIcon,
    SparklesIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ChatMessage {
    id: number;
    role: "agent" | "user";
    content: string;
    timestamp: string;
}

export default function AgentPanel() {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState("");
    const [mode, setMode] = useState<"agent" | "chat">("agent");
    const [model, setModel] = useState("gpt-4.1-mini");
    const [chatTitle, setChatTitle] = useState(t("chat.newConversation"));
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const buildChatTitle = (text: string) => {
        const compact = text.replace(/\s+/g, " ").trim();
        if (compact.length <= 20) {
            return compact;
        }

        return `${compact.slice(0, 20)}...`;
    };

    const createNewConversation = () => {
        setMessages([]);
        setChatTitle(t("chat.newConversation"));
        setInputValue("");
    };

    const sendMessage = () => {
        const trimmed = inputValue.trim();
        if (!trimmed) {
            return;
        }

        const hasUserMessage =
            messages.length > 0 &&
            messages.some((message) => message.role === "user");

        if (!hasUserMessage) {
            setChatTitle(buildChatTitle(trimmed));
        }

        setMessages((prev) => [
            ...prev,
            {
                id: prev.length + 1,
                role: "user",
                content: trimmed,
                timestamp: t("common.now"),
            },
        ]);
        setInputValue("");
    };

    return (
        <aside className="h-full w-full flex flex-col bg-white text-slate-800">
            <header className="h-12 border-b border-slate-200 px-3 flex items-center justify-between bg-white">
                <span className="text-xs truncate">{chatTitle}</span>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={createNewConversation}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span>{t("chat.add")}</span>
                    </button>

                    <button
                        type="button"
                        className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                    >
                        <QueueListIcon className="w-3.5 h-3.5" />
                        <span>{t("chat.history")}</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-3 py-3 space-y-3">
                {messages.length === 0 ? (
                    <div className="h-full min-h-[160px] flex items-center justify-center">
                        <div className="max-w-[360px] text-center px-6">
                            <div className="mx-auto mb-4 h-11 w-11 rounded-2xl bg-blue-50/70 text-blue-600 flex items-center justify-center">
                                <SparklesIcon className="w-5 h-5" />
                            </div>
                            <p className="text-sm text-slate-600 leading-7">
                                {t("chat.greeting")}
                            </p>
                        </div>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={[
                                "max-w-[90%] rounded-2xl px-3 py-2.5 text-xs leading-6 shadow-sm",
                                message.role === "user"
                                    ? "ml-auto bg-blue-600 text-white"
                                    : "mr-auto border border-slate-200 bg-white text-slate-800",
                            ].join(" ")}
                        >
                            <p>{message.content}</p>
                            <p
                                className={[
                                    "mt-1 text-[11px]",
                                    message.role === "user"
                                        ? "text-blue-100"
                                        : "text-slate-400",
                                ].join(" ")}
                            >
                                {message.timestamp}
                            </p>
                        </div>
                    ))
                )}
            </div>

            <div className="border-t border-slate-200 bg-white p-3 text-xs">
                <textarea
                    rows={5}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                    placeholder={t("chat.prompt")}
                    className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white"
                />

                <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                        <button
                            type="button"
                            onClick={() => setMode("agent")}
                            className={[
                                "h-7 px-2.5 rounded-md transition-colors",
                                mode === "agent"
                                    ? "bg-white text-slate-800 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700",
                            ].join(" ")}
                        >
                            {t("chat.mode.agent")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("chat")}
                            className={[
                                "h-7 px-2.5 rounded-md transition-colors",
                                mode === "chat"
                                    ? "bg-white text-slate-800 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700",
                            ].join(" ")}
                        >
                            {t("chat.mode.chat")}
                        </button>
                    </div>

                    <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        aria-label={t("chat.model")}
                        className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-slate-700 outline-none"
                    >
                        <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                        <option value="gpt-4.1">GPT-4.1</option>
                        <option value="local-default">Local Default</option>
                    </select>

                    <button
                        type="button"
                        onClick={sendMessage}
                        className="ml-auto h-8 px-3 rounded-lg bg-blue-600 text-white flex items-center gap-1.5 justify-center hover:bg-blue-700 transition-colors"
                        aria-label={t("chat.sendMessage")}
                        title={t("chat.send")}
                    >
                        <PaperAirplaneIcon className="w-3.5 h-3.5" />
                        <span>{t("chat.send")}</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}
