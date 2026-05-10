import { Agent, OpenAIProvider, run } from "@openai/agents";
import { AgentConversationTurn, AgentRunStream } from "./agent-run-stream";
import OpenAI from "openai";
import { createTools } from "./tools";
import { BaseAskOptions, AgentAskSession } from "./ask";

const INSTRUCTION = `
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

const AGENT_MAX_TURNS = 30;

const MAX_PROMPT_HISTORY_TURNS = 12;

/**
 * Builds the effective user prompt by combining the latest message with
 * compressed summary data and a short tail of recent turns.
 */
function buildConversationInput(
    summary: string | undefined,
    turns: AgentConversationTurn[],
    message: string,
) {
    const recentTurns = turns.slice(-MAX_PROMPT_HISTORY_TURNS);

    if (!summary && recentTurns.length === 0) {
        return message;
    }

    return [
        ...(summary ? ["Compressed task context:", summary, ""] : []),
        ...(recentTurns.length > 0
            ? [
                  "Recent conversation turns:",
                  ...recentTurns.map(
                      (turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`,
                  ),
                  "",
              ]
            : []),
        "",
        "Continue from this context and answer the latest user message.",
        `Latest user message: ${message}`,
    ].join("\n");
}

/**
 * Minimal runtime contract implemented by agent adapters that can execute
 * a user request and stream intermediate activity back to the caller.
 */
export interface AgentRuntime<T> {
    /**
     * Starts a streamed agent run for the provided ask options.
     */
    ask(options: T): Promise<AgentRunStream>;
}

/**
 * Creates and runs the browser-focused OpenAI agent used by the application.
 */
export class HyaenidaeAgent implements AgentRuntime<BaseAskOptions> {
    constructor(private readonly client: OpenAI) {}

    /**
     * Instantiates the agent with the current locale, model, and browser tools,
     * then starts a streamed run for the requested message.
     */
    async ask(options: BaseAskOptions): Promise<AgentRunStream> {
        const agentAskSession: AgentAskSession = {
            ...options,
            client: this.client,
        };

        const agent = new Agent({
            name: "Hyaenidae Assistant",
            instructions: INSTRUCTION.replace(/{{LOCALE}}/g, options.locale),
            model: await new OpenAIProvider({ openAIClient: this.client }).getModel(options.model),
            tools: createTools(agentAskSession),
        });

        const stream = new AgentRunStream(
            await run(
                agent,
                buildConversationInput(
                    options.conversation?.summary,
                    options.conversation?.turns ?? [],
                    options.message,
                ),
                {
                    stream: true,
                    maxTurns: AGENT_MAX_TURNS,
                    ...(options.conversation?.conversationId === undefined
                        ? {}
                        : { conversationId: options.conversation.conversationId }),
                    ...(options.conversation?.previousResponseId === undefined
                        ? {}
                        : { previousResponseId: options.conversation.previousResponseId }),
                },
            ),
        );

        stream.start();

        return stream;
    }
}
