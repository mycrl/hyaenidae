import OpenAI from "openai";
import { Agent, OpenAIProvider, run } from "@openai/agents";
import {
    AgentRunStream,
    type AgentConversationContext,
    type AgentConversationTurn,
} from "./reponse";
import { BrowserRuntime } from "./browser";
import { createTools } from "./tools";

export * from "./browser";
export * from "./sessions";
export * from "./reponse";

const AGENT_MAX_TURNS = 30;
const MAX_PROMPT_HISTORY_TURNS = 12;
const MAX_COMPRESSION_SOURCE_TURNS = 10;

const CONTEXT_COMPRESSION_PROMPT = `
You compress browser-agent session context for the next turn.
Preserve only the information needed to continue the task reliably.
Prioritize:
- the user's current goal
- confirmed preferences and constraints
- important decisions already made
- key observations that changed the plan
- the key path completed so far
- the current state in that path, including blockers or waiting-for-user steps
- the most likely next step

Do not include:
- screenshots or image payload details
- raw tool logs, tool call arguments, or execution-by-execution narration
- repetitive wording, filler, or chain-of-thought
- details that no longer affect the task

Do not drop critical facts such as product requirements, quantities, URLs that matter, selected items, login state, explicit user approvals, or blockers.

Return plain text using exactly these sections:
Goal:
Constraints:
Progress:
Current state:
Next step:
`;

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

const extractResponseText = (response: unknown) => {
    if (typeof response !== "object" || response === null) {
        return "";
    }

    const outputText = (response as { output_text?: string }).output_text;
    if (typeof outputText === "string" && outputText.length > 0) {
        return outputText;
    }

    const output = (response as { output?: Array<{ content?: Array<{ text?: string }> }> }).output;
    if (!Array.isArray(output)) {
        return "";
    }

    return output
        .flatMap((item) => item.content ?? [])
        .map((item) => item.text)
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .join("\n")
        .trim();
};

const buildPrompt = (prompt: string, locale: string) => {
    return prompt.replace(/{{LOCALE}}/g, locale);
};

const buildConversationInput = (
    summary: string | undefined,
    turns: AgentConversationTurn[],
    message: string,
) => {
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
};

export interface ModelProviderOptions {
    baseURL: string;
    apiKey: string;
}

export interface ModelAskOptions {
    model: string;
    message: string;
    locale: string;
    conversation?: AgentConversationContext;
    browserRuntime: BrowserRuntime;
}

export interface ConversationCompressionOptions {
    model: string;
    locale: string;
    previousSummary?: string;
    turns: AgentConversationTurn[];
}

export class ModelProvider {
    private client: OpenAI;

    constructor(public readonly options: ModelProviderOptions) {
        this.client = new OpenAI(options);
    }

    async getModels() {
        return this.client.models.list().then((response) => response.data.map((model) => model.id));
    }

    async compressConversation(options: ConversationCompressionOptions) {
        const turns = options.turns.slice(-MAX_COMPRESSION_SOURCE_TURNS);
        const response = await this.client.responses.create({
            model: options.model,
            input: [
                {
                    role: "system",
                    content: [
                        {
                            type: "input_text",
                            text: CONTEXT_COMPRESSION_PROMPT,
                        },
                    ],
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: [
                                `Write the compressed context in ${options.locale} unless the user explicitly asked for another language.`,
                                options.previousSummary
                                    ? `Previous compressed context:\n${options.previousSummary}`
                                    : "Previous compressed context: none",
                                "Recent conversation turns:",
                                ...turns.map(
                                    (turn) =>
                                        `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`,
                                ),
                            ].join("\n\n"),
                        },
                    ],
                },
            ],
        });

        return extractResponseText(response);
    }

    async ask(options: ModelAskOptions): Promise<AgentRunStream> {
        const agent = new Agent({
            name: "Hyaenidae Assistant",
            instructions: buildPrompt(INSTRUCTION, options.locale),
            model: await new OpenAIProvider({ openAIClient: this.client }).getModel(options.model),
            tools: createTools(options.browserRuntime, {
                inspect: async ({ prompt, tabId }) => {
                    const snapshot = await options.browserRuntime.captureScreenshot(tabId);
                    const response = await this.client.responses.create({
                        model: options.model,
                        input: [
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "input_text",
                                        text: [
                                            "You are inspecting a browser screenshot for a browser automation agent.",
                                            `Write the analysis in ${options.locale} unless the user explicitly asked for another language.`,
                                            "Answer concisely with actionable observations.",
                                            prompt,
                                        ].join("\n"),
                                    },
                                    {
                                        type: "input_image",
                                        image_url: `data:${snapshot.mimeType};base64,${snapshot.base64}`,
                                        detail: "auto",
                                    },
                                ],
                            },
                        ],
                    });

                    return {
                        tabId: snapshot.tabId,
                        analysis: extractResponseText(response),
                        width: snapshot.width,
                        height: snapshot.height,
                    };
                },
            }),
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

export class ModelProviderController {
    private counter = 0;
    private providers: { [key: number]: ModelProvider } = {};

    constructor() {}

    create(options: ModelProviderOptions) {
        const id = this.counter++;
        this.providers[id] = new ModelProvider(options);
        return id;
    }

    getProviders() {
        return this.providers;
    }

    getProvider(id: number) {
        return this.providers[id];
    }

    remove(id: number) {
        delete this.providers[id];
    }
}
