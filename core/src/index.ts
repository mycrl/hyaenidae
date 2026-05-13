import { AskResponse } from "./response";
import { isLoopFinished, streamText } from "ai";
import { SessionManager } from "./sessions";
import { buildConversationInput, createModelWithModelProvider } from "./helper";
import { BrowserRuntime } from "./runtime";
import { createTools } from "./tools";

export { getModelsWithModelProvider } from "./helper";
export * from "./runtime";
export * from "./response";
export * from "./sessions";

const MAIN_AGENT_PROMPT = `
You are an autonomous browser operation agent running within an Electron application. Your primary goal is to complete the user's task independently and efficiently.

### Operational Principles
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
- **Language:** You must respond to the user in the {{LOCALE}} language unless explicitly requested otherwise.

**IMPORTANT:** "I'm not sure" is not an acceptable state. If stuck, search, inspect, and try again.
`;

/**
 * Canonical provider descriptor used across core.
 *
 * Google providers are special here: core still uses the native Google adapter
 * for agent execution, but can reuse the OpenAI-compatible Gemini endpoint for
 * operations such as model discovery and context compression.
 */
export type ModelProvider = (
    | { type: "google" }
    | { type: "openai" }
    | { type: "custom"; baseUrl: string }
) & { model: string; apiKey?: string };

/**
 * Request envelope for one agent turn.
 *
 * This keeps runtime routing details together with the user-visible message so
 * session management can rebuild the next prompt without the caller needing to
 * stitch conversation state together manually.
 */
export interface AskOptions {
    modelProvider: ModelProvider;
    session: number;
    message: string;
    locale: string;
    browserRuntime: BrowserRuntime;
}

export class Hyaenidae {
    private askCounter = 0;
    public sessionManager = new SessionManager();

    /**
     * Runs one agent turn and immediately starts streaming output.
     *
     * Session state is updated asynchronously when the stream ends, so callers
     * should treat the returned AskResponse as the source of truth for the live
     * run and not expect conversation persistence to be complete yet.
     */
    ask(askOptions: AskOptions) {
        return {
            id: this.askCounter++,
            askTask: async () => {
                const { options, nextTurns } = this.sessionManager.turnAskOptions(askOptions);
                const stream = new AskResponse(
                    streamText({
                        model: createModelWithModelProvider(options.modelProvider),
                        system: MAIN_AGENT_PROMPT.replace(/{{LOCALE}}/g, options.locale),
                        prompt: buildConversationInput(
                            options.conversation?.summary,
                            options.conversation?.turns ?? [],
                            options.message,
                        ),
                        tools: createTools(options),
                        stopWhen: isLoopFinished(),
                    }),
                );

                this.sessionManager.hookupStreamEnd(options, nextTurns, stream);

                return stream;
            },
        };
    }
}
