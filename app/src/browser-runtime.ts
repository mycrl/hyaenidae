import type {
    BrowserActionResult,
    BrowserDomSnapshot,
    BrowserElementNode,
    BrowserGroundingTarget,
    BrowserRuntime,
    BrowserScriptResult,
    BrowserTabSummary,
    BrowserVisionSnapshot,
} from "@hyaenidae/core";
import type { WebContents } from "electron";
import { BrowserViews, View } from "./views";

const MAX_ELEMENTS = 250;
const MAX_TEXT_SAMPLE = 4000;

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

const tokenize = (value: string) =>
    normalize(value)
        .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
        .filter((token) => token.length >= 2);

class WebContentsDebugger {
    constructor(private readonly webContents: WebContents) {}

    async sendCommand(method: string, commandParams?: Record<string, unknown>) {
        const shouldDetach = !this.webContents.debugger.isAttached();

        if (shouldDetach) {
            this.webContents.debugger.attach("1.3");
        }

        try {
            return await this.webContents.debugger.sendCommand(method, commandParams);
        } finally {
            if (shouldDetach && this.webContents.debugger.isAttached()) {
                this.webContents.debugger.detach();
            }
        }
    }
}

// Reads Chromium's accessibility tree so the agent can reason about semantics, not only raw DOM.
class AccessibilityTreeReader {
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

// Produces a compact DOM snapshot that is cheap enough to feed back into the model.
class DomSnapshotReader {
    async read(view: View): Promise<BrowserDomSnapshot["document"]> {
        return (await view.webContents.executeJavaScript(
            `(() => {
                const limit = ${MAX_ELEMENTS};
                const maxTextLength = ${MAX_TEXT_SAMPLE};
                const sanitize = (value) => (value || "").replace(/\s+/g, " ").trim();
                const cssPath = (element) => {
                    if (!(element instanceof Element)) {
                        return "";
                    }
                    if (element.id) {
                        return '#' + CSS.escape(element.id);
                    }
                    const segments = [];
                    let current = element;
                    while (current instanceof Element && segments.length < 6) {
                        let segment = current.tagName.toLowerCase();
                        if (current.classList.length > 0) {
                            segment += '.' + Array.from(current.classList).slice(0, 2).map((name) => CSS.escape(name)).join('.');
                        }
                        const parent = current.parentElement;
                        if (parent) {
                            const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
                            if (siblings.length > 1) {
                                segment += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
                            }
                        }
                        segments.unshift(segment);
                        if (!parent || current === document.body) {
                            break;
                        }
                        current = parent;
                    }
                    return segments.join(' > ');
                };
                const candidates = Array.from(document.querySelectorAll('a,button,input,textarea,select,[role],[aria-label],summary')).slice(0, limit);
                return {
                    title: document.title,
                    url: location.href,
                    textSample: sanitize(document.body?.innerText || "").slice(0, maxTextLength),
                    elements: candidates.map((element) => ({
                        bounds: (() => {
                            const rect = element.getBoundingClientRect();
                            return {
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height,
                            };
                        })(),
                        tag: element.tagName.toLowerCase(),
                        selector: cssPath(element),
                        role: element.getAttribute('role') || undefined,
                        text: sanitize(element.textContent || "").slice(0, 200) || undefined,
                        ariaLabel: sanitize(element.getAttribute('aria-label') || "") || undefined,
                        value: 'value' in element && typeof element.value === 'string' ? sanitize(element.value).slice(0, 200) || undefined : undefined,
                        href: element instanceof HTMLAnchorElement ? element.href : undefined,
                        placeholder: 'placeholder' in element && typeof element.placeholder === 'string' ? sanitize(element.placeholder).slice(0, 200) || undefined : undefined,
                    })),
                };
            })()`,
            true,
        )) as BrowserDomSnapshot["document"];
    }
}

// Grounds a visual description back onto DOM candidates so follow-up actions can stay deterministic.
class VisionGrounder {
    ground(snapshot: BrowserDomSnapshot, description: string): BrowserGroundingTarget[] {
        const tokens = tokenize(description);
        const candidates = snapshot.document?.elements ?? [];

        return candidates
            .map((element) => {
                const haystack = normalize(
                    [
                        element.tag,
                        element.role,
                        element.text,
                        element.ariaLabel,
                        element.value,
                        element.href,
                        element.placeholder,
                    ]
                        .filter(Boolean)
                        .join(" "),
                );
                const score = tokens.reduce(
                    (total, token) => total + (haystack.includes(token) ? 1 : 0),
                    0,
                );

                return {
                    element,
                    score,
                };
            })
            .filter((candidate) => candidate.score > 0 && candidate.element.selector)
            .sort((left, right) => right.score - left.score)
            .slice(0, 5)
            .map((candidate) => ({
                point: {
                    x: candidate.element.bounds.x + candidate.element.bounds.width / 2,
                    y: candidate.element.bounds.y + candidate.element.bounds.height / 2,
                },
                tabId: snapshot.tabId,
                selector: candidate.element.selector,
                reason: `Matched ${candidate.score} description token(s) against DOM/AX text.`,
                confidence:
                    candidate.score >= Math.max(2, Math.ceil(tokens.length * 0.6))
                        ? "high"
                        : candidate.score >= 2
                          ? "medium"
                          : "low",
                ...(candidate.element.role === undefined ? {} : { role: candidate.element.role }),
                ...((candidate.element.text ?? candidate.element.ariaLabel) === undefined
                    ? {}
                    : { text: candidate.element.text ?? candidate.element.ariaLabel }),
                ...(candidate.element.href === undefined ? {} : { url: candidate.element.href }),
            }));
    }
}

export class ElectronBrowserRuntime implements BrowserRuntime {
    private readonly domReader = new DomSnapshotReader();
    private readonly accessibilityReader = new AccessibilityTreeReader();
    private readonly visionGrounder = new VisionGrounder();

    constructor(private readonly views: BrowserViews) {}

    async listTabs(): Promise<BrowserTabSummary[]> {
        return this.views.tabs.map((tab) => this.toSummary(tab));
    }

    async getFocusedTab(): Promise<BrowserTabSummary | null> {
        const view = this.views.getFocusedTab();
        return view ? this.toSummary(view) : null;
    }

    async openTab(url?: string): Promise<BrowserTabSummary> {
        const id = await this.views.create(url);
        return this.getTabSummary(id);
    }

    async closeTab(tabId: number): Promise<void> {
        await this.views.remove(tabId);
    }

    async focusTab(tabId: number): Promise<BrowserTabSummary> {
        await this.views.focus(tabId);
        return this.getTabSummary(tabId);
    }

    async load(tabId: number, url: string): Promise<BrowserTabSummary> {
        await this.views.load(tabId, url);
        return this.getTabSummary(tabId);
    }

    async reload(tabId: number): Promise<void> {
        this.views.reload(tabId);
    }

    async goBack(tabId: number): Promise<void> {
        await this.views.getNavigationHistory(tabId)?.goBack();
    }

    async goForward(tabId: number): Promise<void> {
        await this.views.getNavigationHistory(tabId)?.goForward();
    }

    async snapshotDom(tabId?: number): Promise<BrowserDomSnapshot> {
        const view = this.requireTab(tabId);
        const [document, accessibility] = await Promise.all([
            this.domReader.read(view),
            this.accessibilityReader.read(view.webContents),
        ]);

        return {
            tabId: view.webContents.id,
            url: view.webContents.getURL(),
            title: view.webContents.getTitle() || document?.title || "",
            ...(document === undefined ? {} : { document }),
            ...(accessibility === undefined ? {} : { accessibility }),
        };
    }

    async captureVision(tabId?: number): Promise<BrowserVisionSnapshot> {
        const view = this.requireTab(tabId);
        const image = await view.webContents.capturePage();

        return {
            tabId: view.webContents.id,
            mimeType: "image/png",
            base64: image.toPNG().toString("base64"),
            width: image.getSize().width,
            height: image.getSize().height,
        };
    }

    async groundFromVision(input: {
        tabId?: number;
        description: string;
    }): Promise<BrowserGroundingTarget[]> {
        const snapshot = await this.snapshotDom(input.tabId);
        return this.visionGrounder.ground(snapshot, input.description);
    }

    async runScript(input: {
        tabId?: number;
        script: string;
        args?: unknown[];
    }): Promise<BrowserScriptResult> {
        const view = this.requireTab(input.tabId);
        const serializedArgs = JSON.stringify(input.args ?? []);
        // Expose args as a local variable so agent-authored snippets can stay short.
        const script = `(async () => {
            const args = ${serializedArgs};
            return await (async () => {
                ${input.script}
            })();
        })()`;

        return {
            tabId: view.webContents.id,
            result: await view.webContents.executeJavaScript(script, true),
        };
    }

    async act(input: {
        tabId?: number;
        action: "click" | "type" | "scroll";
        selector?: string;
        text?: string;
        direction?: "up" | "down";
        amount?: number;
    }): Promise<BrowserActionResult> {
        const view = this.requireTab(input.tabId);

        if (input.action === "scroll") {
            await view.webContents.executeJavaScript(
                `window.scrollBy({ top: ${input.direction === "up" ? -1 : 1} * ${input.amount ?? 600}, behavior: 'smooth' });`,
                true,
            );

            return {
                tabId: view.webContents.id,
                action: input.action,
                ok: true,
                details: "Scrolled page.",
            };
        }

        if (!input.selector) {
            throw new Error(`Action '${input.action}' requires a selector.`);
        }

        if (input.action === "click") {
            const domClickResult = await this.tryDomClick(view, input.selector);

            if (!domClickResult.ok) {
                const point = await this.resolveInteractionPoint(view, input.selector);
                await this.dispatchClick(view.webContents, point);
            }

            return {
                tabId: view.webContents.id,
                action: input.action,
                ok: true,
                details: domClickResult.ok
                    ? `Clicked ${input.selector} via DOM action.`
                    : `Clicked ${input.selector} via mouse fallback.`,
            };
        }

        const domTypeResult = await this.tryDomType(view, input.selector, input.text ?? "");

        if (!domTypeResult.ok) {
            const point = await this.resolveInteractionPoint(view, input.selector);
            await this.dispatchClick(view.webContents, point);
            await this.focusElementForTyping(view, input.selector);
            await view.webContents.insertText(input.text ?? "");
        }

        return {
            tabId: view.webContents.id,
            action: input.action,
            ok: true,
            details: domTypeResult.ok
                ? `Typed into ${input.selector} via DOM action.`
                : `Typed into ${input.selector} via keyboard fallback.`,
        };
    }

    async actAtPoint(input: {
        tabId?: number;
        action: "click" | "type";
        x: number;
        y: number;
        text?: string;
    }): Promise<BrowserActionResult> {
        const view = this.requireTab(input.tabId);

        view.webContents.focus();
        view.webContents.sendInputEvent({
            type: "mouseDown",
            x: Math.round(input.x),
            y: Math.round(input.y),
            button: "left",
            clickCount: 1,
        });
        view.webContents.sendInputEvent({
            type: "mouseUp",
            x: Math.round(input.x),
            y: Math.round(input.y),
            button: "left",
            clickCount: 1,
        });

        if (input.action === "type") {
            await view.webContents.insertText(input.text ?? "");
        }

        return {
            tabId: view.webContents.id,
            action: input.action,
            ok: true,
            details:
                input.action === "type"
                    ? `Clicked and typed at (${Math.round(input.x)}, ${Math.round(input.y)}).`
                    : `Clicked at (${Math.round(input.x)}, ${Math.round(input.y)}).`,
        };
    }

    private requireTab(tabId?: number) {
        const view = tabId === undefined ? this.views.getFocusedTab() : this.views.getTab(tabId);
        if (!view) {
            throw new Error(
                tabId === undefined ? "No focused tab available." : `Tab not found: ${tabId}`,
            );
        }

        return view;
    }

    private getTabSummary(tabId: number) {
        const view = this.views.getTab(tabId);
        if (!view) {
            throw new Error(`Tab not found: ${tabId}`);
        }

        return this.toSummary(view);
    }

    private async resolveInteractionPoint(view: View, selector: string) {
        const serializedSelector = JSON.stringify(selector);

        return (await view.webContents.executeJavaScript(
            `(() => {
                const element = document.querySelector(${serializedSelector});
                if (!(element instanceof HTMLElement)) {
                    throw new Error('Element not found for selector: ' + ${serializedSelector});
                }

                element.scrollIntoView({ block: 'center', inline: 'center' });
                const rect = element.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) {
                    throw new Error('Element is not interactable for selector: ' + ${serializedSelector});
                }

                return {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                };
            })()`,
            true,
        )) as { x: number; y: number };
    }

    private async tryDomClick(view: View, selector: string) {
        const serializedSelector = JSON.stringify(selector);

        return (await view.webContents.executeJavaScript(
            `(() => {
                const element = document.querySelector(${serializedSelector});
                if (!(element instanceof HTMLElement)) {
                    throw new Error('Element not found for selector: ' + ${serializedSelector});
                }

                const before = {
                    href: location.href,
                    title: document.title,
                    expanded: element.getAttribute('aria-expanded'),
                    checked: 'checked' in element ? Boolean(element.checked) : undefined,
                    active: document.activeElement === element,
                };

                element.scrollIntoView({ block: 'center', inline: 'center' });
                element.focus();
                element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, button: 0 }));
                element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
                element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, button: 0 }));
                element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
                element.click();

                const after = {
                    href: location.href,
                    title: document.title,
                    expanded: element.getAttribute('aria-expanded'),
                    checked: 'checked' in element ? Boolean(element.checked) : undefined,
                    active: document.activeElement === element,
                };

                return {
                    ok:
                        before.href !== after.href ||
                        before.title !== after.title ||
                        before.expanded !== after.expanded ||
                        before.checked !== after.checked ||
                        (!before.active && after.active),
                };
            })()`,
            true,
        )) as { ok: boolean };
    }

    private async tryDomType(view: View, selector: string, text: string) {
        const serializedSelector = JSON.stringify(selector);
        const serializedText = JSON.stringify(text);

        return (await view.webContents.executeJavaScript(
            `(() => {
                const element = document.querySelector(${serializedSelector});
                if (!(element instanceof HTMLElement)) {
                    throw new Error('Element not found for selector: ' + ${serializedSelector});
                }

                element.scrollIntoView({ block: 'center', inline: 'center' });
                element.focus();

                if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                    const prototype = element instanceof HTMLInputElement
                        ? HTMLInputElement.prototype
                        : HTMLTextAreaElement.prototype;
                    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
                    descriptor?.set?.call(element, ${serializedText});
                    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: ${serializedText}, inputType: 'insertText' }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));

                    return { ok: element.value === ${serializedText} };
                }

                if (element.isContentEditable) {
                    element.textContent = ${serializedText};
                    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: ${serializedText}, inputType: 'insertText' }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));

                    return { ok: (element.textContent || '') === ${serializedText} };
                }

                return { ok: false };
            })()`,
            true,
        )) as { ok: boolean };
    }

    private async focusElementForTyping(view: View, selector: string) {
        const serializedSelector = JSON.stringify(selector);

        await view.webContents.executeJavaScript(
            `(() => {
                const element = document.querySelector(${serializedSelector});
                if (
                    !(
                        element instanceof HTMLInputElement ||
                        element instanceof HTMLTextAreaElement ||
                        element instanceof HTMLElement
                    )
                ) {
                    throw new Error('Element not found for selector: ' + ${serializedSelector});
                }

                element.scrollIntoView({ block: 'center', inline: 'center' });
                element.focus();
                if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                    element.select();
                } else {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(element);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
            })()`,
            true,
        );
    }

    private async dispatchClick(webContents: WebContents, point: { x: number; y: number }) {
        const x = Math.round(point.x);
        const y = Math.round(point.y);

        webContents.focus();
        webContents.sendInputEvent({
            type: "mouseMove",
            x,
            y,
        });
        webContents.sendInputEvent({
            type: "mouseDown",
            x,
            y,
            button: "left",
            clickCount: 1,
        });
        webContents.sendInputEvent({
            type: "mouseUp",
            x,
            y,
            button: "left",
            clickCount: 1,
        });
    }

    private toSummary(view: View): BrowserTabSummary {
        return {
            id: view.webContents.id,
            title: view.webContents.getTitle() || "New Tab",
            url: view.webContents.getURL(),
            isFocused: this.views.currentId === view.webContents.id,
            isLoading: view.webContents.isLoading(),
        };
    }
}
