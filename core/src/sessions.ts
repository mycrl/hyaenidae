import { ModelProvider, ModelAskOptions } from "./";
import { AgentConversationContext, AgentRunStream } from "./run-stream.js";

export interface AgentSessionSummary {
    id: number;
    name: string;
}

interface AgentSessionState extends AgentSessionSummary {
    conversation: AgentConversationContext;
}

export interface AgentRunRequest extends ModelAskOptions {
    session: number;
    modelProvider: ModelProvider;
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

    constructor() {}

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

    removeSession(id: number) {
        const index = this.sessions.findIndex((item) => item.id === id);
        if (index !== -1) {
            this.sessions.splice(index, 1);
        }
    }

    ask(request: AgentRunRequest): AgentRunResult {
        const session = this.assertSession(request.session);
        const id = this.askCounter++;

        const streamPromise = request.modelProvider
            .ask({
                ...request,
                conversation: session.conversation,
            })
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
