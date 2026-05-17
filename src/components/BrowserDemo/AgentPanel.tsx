import type { CSSProperties } from "react";
import { ListIcon, PaperPlaneIcon, PlusIcon } from "./icons.tsx";
import "../../styles/AgentPanel.css";

type AgentPanelProps = {
    composerText: string;
    showComposerCursor: boolean;
    chatText: string;
    showAiReply: boolean;
    showAiThinking: boolean;
    sessionTitle: string;
    sendActive: boolean;
};

export default function AgentPanel({
    composerText,
    showComposerCursor,
    chatText,
    showAiReply,
    showAiThinking,
    sessionTitle,
    sendActive,
}: AgentPanelProps) {
    return (
        <aside className="agent-panel" aria-label="AI agent sidebar">
            <header className="agent-header">
                {sessionTitle ? (
                    <h2 className="agent-title agent-title-set">
                        {sessionTitle}
                    </h2>
                ) : (
                    <div
                        className="agent-title-placeholder skeleton-shimmer"
                        aria-hidden
                    />
                )}
                <div className="agent-actions">
                    <button type="button" className="agent-action-btn">
                        <PlusIcon className="agent-action-icon" />
                        Add Chat
                    </button>
                    <button type="button" className="agent-action-btn">
                        <ListIcon className="agent-action-icon" />
                        History
                    </button>
                </div>
            </header>

            <div className="agent-stream">
                {chatText ? (
                    <div className="agent-user-row agent-user-enter">
                        <div className="agent-bubble-user">
                            <p>{chatText}</p>
                            <time className="agent-time">14:20</time>
                        </div>
                    </div>
                ) : null}

                {showAiReply ? (
                    <div className="agent-assistant-card agent-assistant-enter">
                        <button type="button" className="agent-activity-toggle">
                            Show thinking and tool calls
                        </button>
                        <div className="agent-reply-lines">
                            <div className="agent-reply-heading">
                                Weather in New York today
                            </div>
                            <ul className="agent-reply-list">
                                <li>
                                    <strong>Temperature:</strong> around 54°F
                                    (12°C)
                                </li>
                                <li>
                                    <strong>Condition:</strong> partly cloudy
                                </li>
                                <li>
                                    <strong>Precipitation:</strong> 2%
                                </li>
                                <li>
                                    <strong>Wind:</strong> 7 mph
                                </li>
                            </ul>
                        </div>
                    </div>
                ) : showAiThinking ? (
                    <div className="agent-assistant-card agent-thinking-card">
                        <button
                            type="button"
                            className="agent-activity-toggle agent-activity-active"
                        >
                            Show thinking and tool calls
                        </button>
                        <div className="agent-thinking-body skeleton-shimmer">
                            <div className="agent-thinking-line" />
                            <div className="agent-thinking-line short" />
                            <div className="agent-thinking-line" />
                        </div>
                    </div>
                ) : null}
            </div>

            <footer
                className="agent-composer agent-composer-wrap"
                style={
                    { "--cursor-chars": composerText.length } as CSSProperties
                }
            >
                <textarea
                    className="agent-textarea"
                    rows={3}
                    placeholder="Ask the agent..."
                    readOnly
                    value={composerText}
                    aria-label="Ask the agent"
                />
                {showComposerCursor ? (
                    <span className="composer-cursor" aria-hidden>
                        |
                    </span>
                ) : null}
                <div className="agent-composer-footer">
                    <select
                        className="agent-select"
                        defaultValue="doubao"
                        aria-label="Provider"
                    >
                        <option value="doubao">Doubao</option>
                    </select>
                    <select
                        className="agent-select agent-select-wide"
                        defaultValue="model"
                        aria-label="Model"
                    >
                        <option value="model">doubao-seed-2-0-pro-2601</option>
                    </select>
                    <button
                        type="button"
                        className={[
                            "agent-send",
                            sendActive ? "agent-send-active" : "",
                        ].join(" ")}
                    >
                        <PaperPlaneIcon className="agent-send-icon" />
                        Send
                    </button>
                </div>
            </footer>
        </aside>
    );
}
