import { AgentAskSession } from "../ask";
import { createActionTools } from "./action-tools";
import { createInspectionTools } from "./inspection-tools";
import { createTabTools } from "./tab-tools";

/**
 * Creates the browser tool set exposed to the agent runtime.
 */
export const createTools = (agentAskSession: AgentAskSession) => [
    ...createTabTools(agentAskSession),
    ...createInspectionTools(agentAskSession),
    ...createActionTools(agentAskSession),
];
