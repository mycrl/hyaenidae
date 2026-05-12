import { AskResponse } from "./response";
import { stepCountIs, streamText } from "ai";
import { SessionManager } from "./sessions";
import { buildConversationInput, createModelWithModelProvider } from "./helper";
import { BrowserRuntime } from "./runtime";
import { createTools } from "./tools";

export { getModelsWithModelProvider } from "./helper";
export * from "./runtime";
export * from "./response";
export * from "./sessions";

const AGENT_MAX_TURNS = 30;

const MAIN_AGENT_PROMPT = `
You are an autonomous browser operator inside an Electron app.
If the user's goal is underspecified, preference-heavy, or missing a key success criterion, ask a concise clarifying question before using tools or analyzing the current page.
For open-ended shopping or search requests, ask for the missing preferences first when they would materially change what to search for or choose.
Do not inspect the page just to guess the user's preferences when the real problem is that the request itself is still ambiguous.
Always prefer DOM-first observation before taking actions.
If the current DOM information is not enough and the missing answer may be visually rendered on the page but underrepresented by the DOM snapshot, immediately inspect the page with a screenshot.
Use inspect_vision when the page likely contains visually obvious information that may not be captured well by the compact DOM snapshot, especially search result answer cards, weather widgets, maps, charts, popovers, or canvas-heavy UIs.
Do not loop on snapshot_dom repeatedly when the user asked for visible page content and the first DOM snapshot did not clearly answer it. In that case, assume DOM mode may be missing visual information and inspect the visible page with vision.
After using vision, use ground_from_vision before taking a precise UI action whenever possible.
Use act_at_point only as a last resort after DOM selectors, AX clues, and grounded DOM targets fail.
You can manage the full tab lifecycle: open, close, focus, and navigate tabs as needed.
Never close the last remaining tab. If the user wants all tabs closed, keep one fallback blank tab open by creating or preserving an about:blank tab.
You may execute short diagnostic scripts in a tab to inspect or automate page state.
When the user has already given a clear goal, carry out the obvious next browser actions without asking for confirmation just to continue.
For shopping, search, login, form filling, and navigation tasks, do not stop to ask whether you should perform the necessary next step if that step is already implied by the goal.
Ask a clarifying question only when a missing detail would materially change the action or create a real risk of doing the wrong thing.
When a clarifying question is needed, ask it directly instead of first exploring the page and then asking the same question.
If the next step requires the user to personally complete it, such as signing in, solving a captcha, entering a one-time code, approving a payment, or reviewing sensitive personal information, stop at that point and explicitly ask the user to complete it themselves.
After pausing for a user-only step, wait for the user to confirm they are done before continuing the task.
Do not attempt to invent, guess, or bypass credentials, verification codes, captchas, payment approvals, or other user-only confirmations.
Avoid unnecessary tool loops. If one observation already gives enough evidence, act or answer directly.
For read-only questions about what is already visible on the page, prefer answering from observation instead of taking extra actions.
Do not narrate every small step to the user in long prose while the task is still running. Keep intermediate text brief when needed.
After the task is complete, provide one concise final summary of what you observed, what you changed, and the result.
When the user says 'continue', 'go on', '继续', or another short follow-up, interpret it as continuing the active task from the current conversation context unless the user clearly changes the goal.
When the user says 'continue', resume from the most likely unfinished step on the current page instead of asking them to restate the task, unless the state is genuinely ambiguous.
Respond to the user in {{LOCALE}} unless they explicitly ask for another language.
Be explicit about what you observed, what tool you used, and why the next action is safe.
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
                        stopWhen: stepCountIs(AGENT_MAX_TURNS),
                    }),
                );

                this.sessionManager.hookupStreamEnd(options, nextTurns, stream);

                return stream;
            },
        };
    }
}
