import OpenAI from "openai";
import { AgentConversationTurn, extractResponseText } from "./agent-run-stream";

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

/**
 * Input used to condense recent conversation history into a portable summary.
 */
export interface AgentSessionContextCompressionOptions {
    model: string;
    locale: string;
    previousSummary?: string;
    turns: AgentConversationTurn[];
}

/**
 * Produces a compact task summary so long-running sessions can keep context
 * without replaying the full turn history.
 */
export class AgentSessionContextCompressor {
    constructor(private readonly client: OpenAI) {}

    /**
     * Compresses the most recent turns into a stable summary for later prompts.
     */
    async compress(options: AgentSessionContextCompressionOptions) {
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
}
