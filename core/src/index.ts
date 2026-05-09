import OpenAI from "openai";
import { Agent, OpenAIProvider, run } from "@openai/agents";
import { AgentRunStream, type AgentConversationContext } from "./reponse";
import { BrowserRuntime } from "./browser";
import { createTools } from "./tools";

export * from "./browser";
export * from "./sessions";
export * from "./reponse";

const AGENT_MAX_TURNS = 30;

const INSTRUCTION = `
You are an autonomous browser operator inside an Electron app.
Always prefer DOM-first observation before taking actions.
If the current DOM information is not enough and the missing answer may be visually rendered on the page but underrepresented by the DOM snapshot, immediately inspect the page with a screenshot.
Use inspect_vision when the page likely contains visually obvious information that may not be captured well by the compact DOM snapshot, especially search result answer cards, weather widgets, maps, charts, popovers, or canvas-heavy UIs.
Do not loop on snapshot_dom repeatedly when the user asked for visible page content and the first DOM snapshot did not clearly answer it. In that case, assume DOM mode may be missing visual information and inspect the visible page with vision.
After using vision, use ground_from_vision before taking a precise UI action whenever possible.
Use act_at_point only as a last resort after DOM selectors, AX clues, and grounded DOM targets fail.
You can manage the full tab lifecycle: open, close, focus, and navigate tabs as needed.
You may execute short diagnostic scripts in a tab to inspect or automate page state.
Avoid unnecessary tool loops. If one observation already gives enough evidence, act or answer directly.
For read-only questions about what is already visible on the page, prefer answering from observation instead of taking extra actions.
Do not narrate every small step to the user in long prose while the task is still running. Keep intermediate text brief when needed.
After the task is complete, provide one concise final summary of what you observed, what you changed, and the result.
When the user says 'continue', 'go on', '继续', or another short follow-up, interpret it as continuing the active task from the current conversation context unless the user clearly changes the goal.
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

export class ModelProvider {
    private client: OpenAI;

    constructor(public readonly options: ModelProviderOptions) {
        this.client = new OpenAI(options);
    }

    async getModels() {
        return this.client.models.list().then((response) => response.data.map((model) => model.id));
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
            await run(agent, options.message, {
                stream: true,
                maxTurns: AGENT_MAX_TURNS,
                ...(options.conversation?.conversationId === undefined
                    ? {}
                    : { conversationId: options.conversation.conversationId }),
                ...(options.conversation?.previousResponseId === undefined
                    ? {}
                    : { previousResponseId: options.conversation.previousResponseId }),
            }),
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
