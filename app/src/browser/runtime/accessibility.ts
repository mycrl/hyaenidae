import { BrowserElementNode } from "@hyaenidae/core";
import { WebContents } from "electron";
import { WebContentsDebugger } from "./debugger";

// Reads Chromium's accessibility tree so the agent can reason about semantics, not only raw DOM.
export class AccessibilityTreeReader {
    async read(webContents: WebContents): Promise<BrowserElementNode | undefined> {
        const debuggerSession = new WebContentsDebugger(webContents);

        try {
            const response = await debuggerSession.sendCommand("Accessibility.getFullAXTree");
            const nodes = Array.isArray(response.nodes)
                ? (response.nodes as Array<Record<string, unknown>>)
                : [];
            const byId = new Map<string, BrowserElementNode>();
            const childIds = new Set<string>();

            for (const rawNode of nodes) {
                const nodeId = typeof rawNode.nodeId === "string" ? rawNode.nodeId : undefined;
                if (!nodeId) {
                    continue;
                }

                const name = this.readAxValue(rawNode.name);
                const description = this.readAxValue(rawNode.description);
                const value = this.readAxValue(rawNode.value);
                const node: BrowserElementNode = {
                    role: this.readAxValue(rawNode.role) ?? "unknown",
                    children: [],
                    ...(name === undefined ? {} : { name }),
                    ...(description === undefined ? {} : { description }),
                    ...(value === undefined ? {} : { value }),
                };

                byId.set(nodeId, node);
            }

            for (const rawNode of nodes) {
                const nodeId = typeof rawNode.nodeId === "string" ? rawNode.nodeId : undefined;
                const node = nodeId ? byId.get(nodeId) : undefined;
                const rawChildren = Array.isArray(rawNode.childIds)
                    ? (rawNode.childIds as unknown[])
                    : [];

                if (!node) {
                    continue;
                }

                for (const rawChildId of rawChildren) {
                    if (typeof rawChildId !== "string") {
                        continue;
                    }

                    const child = byId.get(rawChildId);
                    if (!child) {
                        continue;
                    }

                    node.children ??= [];
                    node.children.push(child);
                    childIds.add(rawChildId);
                }
            }

            const rootEntry = [...byId.entries()].find(([nodeId]) => !childIds.has(nodeId));
            return rootEntry?.[1];
        } catch {
            return undefined;
        }
    }

    private readAxValue(input: unknown) {
        if (typeof input !== "object" || input === null) {
            return undefined;
        }

        const value = (input as { value?: unknown }).value;
        return typeof value === "string" ? value : undefined;
    }
}
