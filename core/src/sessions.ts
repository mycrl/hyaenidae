import type { BrowserRuntime } from "./browser";
import type { ModelService } from "./agent";
import type { AgentConversationContext, AgentRunStream } from "./run-stream.js";

export interface AgentSessionSummary {
    id: number;
    name: string;
}

interface AgentSessionState extends AgentSessionSummary {
    conversation: AgentConversationContext;
}

export interface AgentRunRequest {
    session: number;
    model: string;
    message: string;
    locale: string;
    browser?: BrowserRuntime;
}

export interface AgentRunResult {
    id: number;
    streamPromise: Promise<AgentRunStream>;
}

export interface AgentRunStreamResult {
    id: number;
    stream: AgentRunStream;
}

export class AgentSessionController {
    private askCounter = 0;
    private readonly sessions: AgentSessionState[] = [];

    constructor(private readonly modelService: ModelService) {}

    listSessions() {
        return this.sessions.map(({ id, name }) => ({ id, name }));
    }

    createSession(name?: string) {
        const id = this.sessions.length;
        const session = {
            id,
            name: name?.trim() || `Session ${id + 1}`,
            conversation: {},
        };

        this.sessions.push(session);

        return session;
    }

    ask(request: AgentRunRequest): AgentRunResult {
        const session = this.assertSession(request.session);
        const id = this.askCounter++;

        const streamPromise = this.modelService
            .ask(
                request.browser === undefined
                    ? {
                          model: request.model,
                          message: request.message,
                          locale: request.locale,
                          conversation: session.conversation,
                      }
                    : {
                          model: request.model,
                          message: request.message,
                          locale: request.locale,
                          conversation: session.conversation,
                          browser: request.browser,
                      },
            )
            .then((stream) => {
                stream.on("end", () => {
                    const latestConversation = stream.getConversationContext();
                    const activeSession = this.sessions.find((item) => item.id === request.session);
                    if (!activeSession) {
                        return;
                    }

                    activeSession.conversation = latestConversation;
                });

                return stream;
            });

        return {
            id,
            streamPromise,
        };
    }

    private assertSession(id: number) {
        const session = this.sessions.find((item) => item.id === id);
        if (!session) {
            throw new Error(`Unknown agent session: ${id}`);
        }

        return session;
    }
}
