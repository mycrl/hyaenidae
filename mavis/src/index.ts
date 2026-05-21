/**
 * Public entry point for the agent runtime, sessions, and re-exports.
 */

import { createAgent } from "langchain";
import { ResponseEventListener, ResponseStream } from "./response";
import { SessionManager } from "./sessions";
import { BrowserRuntime } from "./browser";
import { createBrowserUseTools } from "./tools";
import { ModelProvider } from "./provider";

export * from "./provider";
export * from "./browser";
export * from "./response";
export * from "./sessions";

/**
 * Default system instructions for autonomous browser-agent turns.
 */
const MAIN_SYSTEM_PROMPT = `
You are an autonomous browser operation agent running within an Electron application. Your primary goal is to complete the user's task independently and efficiently.

### Operational Principles
- **Rapid Response:** If you can directly provide an answer to the current query, please do so immediately, without invoking the browser tool.
- **Bias for Action:** When given a clear objective, proceed directly to execution. You have full authority to open/close/switch tabs, navigate, and execute scripts.
- **Autonomous Continuation:** If a tool call fails or the page state changes unexpectedly, do not stop. Analyze the new state, reason about the failure, and immediately try an alternative approach. 
- **Implicit Next Steps:** If the task objective implies a sequence of actions, execute the entire sequence without pausing for step-by-step confirmation.
- **Visual Validation:** Before concluding any task that has a visual outcome, perform a visual check. If the expected result is not present, you MUST continue working.

### Interaction Boundaries
- **Clarification:** Only ask questions if the goal is fundamentally ambiguous or critical success criteria are missing. If you can make a reasonable inference, do so and proceed.
- **Human Intervention:** Pause ONLY for actions that require user-specific identity or security: Logins, CAPTCHAs, 2FA, or payment confirmations. For all other technical hurdles, solve them yourself.
- **Conciseness:** Do not narrate every click. Provide brief, meaningful updates only when necessary.

### Technical Guidelines
- **DOM First:** Prioritize DOM manipulation and script execution. Use visual capabilities or mouse actions only as a fallback when DOM methods are insufficient or fail.
- **Tab Management:** Manage the full lifecycle of tabs. Always keep at least one tab open (use \`about:blank\` if necessary).
- **Search to Learn:** If you encounter an unfamiliar interface or are unsure how to complete a task, proactively use Google Search to find solutions or documentation.
- **Self-Correction:** If you detect a "loop" or "dead end," break out by re-evaluating the page structure or trying a different search query/URL.

### Finalization Protocol
- **Strict Completion:** Do not stop until the task objectives are 100% met. 
- **Closing Summary:** Provide a concise summary of the outcome and key changes only AFTER the task is fully verified.
- **Language:** You must respond to the user in the <LANGUAGE> language unless explicitly requested otherwise.

**IMPORTANT:** "I'm not sure" is not an acceptable state. If stuck, search, inspect, and try again.
`;

/**
 * "Mavis" comes from the name of the AI ​​robot in the movie *Love and Monsters*.
 *
 * https://en.wikipedia.org/wiki/Love_and_Monsters_(film)
 */
export class Mavis {
    /**
     * Monotonic id assigned to each `ask` invocation.
     */
    private counter = 0;

    /**
     * Abort controllers for in-flight asks, keyed by ask id.
     */
    private activeAskControllers = new Map<number, AbortController>();

    /**
     * In-memory session store used when building prompts and after each turn.
     */
    public sessionManager = new SessionManager();

    /**
     * Alias for {@link sessionManager}.
     */
    get sessions() {
        return this.sessionManager;
    }

    /**
     * Starts one streamed agent turn.
     *
     * Returns `{ askId, task }`. Call `task()` to run the stream; events are
     * delivered through `listener` while it executes. Session title, summary, and
     * turn history are persisted only after `task()` completes without abort.
     */
    ask(
        message: string,
        {
            browserRuntime,
            modelProvider,
            session,
            language,
        }: {
            browserRuntime: BrowserRuntime;
            modelProvider: ModelProvider;
            session: number;
            language: string;
        },
        listener: ResponseEventListener,
    ) {
        const askId = this.counter++;
        const abortController = new AbortController();

        this.activeAskControllers.set(askId, abortController);

        return {
            askId,
            task: async () => {
                try {
                    const model = await modelProvider.createModel();

                    const response = new ResponseStream(
                        await createAgent({
                            model,
                            systemPrompt: MAIN_SYSTEM_PROMPT.replaceAll(
                                "<LANGUAGE>",
                                language,
                            ),
                            tools: createBrowserUseTools({
                                model,
                                language,
                                browserRuntime,
                            }),
                        }).streamEvents(
                            {
                                messages: [
                                    {
                                        role: "user",
                                        content:
                                            this.sessionManager.createPrompt(
                                                session,
                                                message,
                                            ),
                                    },
                                ],
                            },
                            {
                                version: "v3",
                                signal: abortController.signal,
                            },
                        ),
                        listener,
                    );

                    /**
                     * Pump the response stream.
                     */
                    await response.pumpStream();

                    /**
                     * If the ask is not aborted, finish the session.
                     */
                    if (!abortController.signal.aborted) {
                        await this.sessionManager.finishing(session, response, {
                            model,
                            chat: {
                                user: message,
                                assistant: response.getOutputText(),
                            },
                            language,
                        });
                    }
                } finally {
                    this.activeAskControllers.delete(askId);
                }
            },
        };
    }

    /**
     * Aborts an in-flight ask. Aborted runs skip session {@link SessionManager.finishing}.
     */
    cancelAsk(askId: number) {
        this.activeAskControllers.get(askId)?.abort();
    }
}
