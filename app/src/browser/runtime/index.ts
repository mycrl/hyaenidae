import type {
    BrowserActionResult,
    BrowserDomSnapshot,
    BrowserElementNode,
    BrowserGroundingTarget,
    BrowserRuntime,
    BrowserScriptResult,
    BrowserTabSummary,
    BrowserImageSnapshot,
} from "@hyaenidae/core";
import type { WebContents } from "electron";
import { Browser, View } from "..";
import { AccessibilityTreeReader } from "./accessibility";
import { VisionGrounder } from "./vision";

const REDACTED_TEXT = "[redacted sensitive value]";

const SENSITIVE_FIELD_HINT_PATTERN =
    /(pass(word)?|pwd|secret|token|api[-_ ]?key|auth|login|sign[-_ ]?in|user(name)?|email|e-mail|phone|mobile|tel|otp|one[-_ ]?time|verification|captcha|sms|card|cvv|cvc|security code|account)/i;

const SENSITIVE_QUERY_PARAM_PATTERN =
    /^(token|access_token|refresh_token|id_token|code|otp|password|passwd|pwd|secret|api[_-]?key|session|auth|email|phone|username|user)$/i;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BASIC_AUTH_URL_PATTERN = /(https?:\/\/)([^/@\s]+)@/gi;

const looksSensitiveHint = (value?: string) =>
    typeof value === "string" && SENSITIVE_FIELD_HINT_PATTERN.test(value);

const sanitizeVisibleText = (value: string) =>
    value
        .replace(EMAIL_PATTERN, "[redacted email]")
        .replace(BASIC_AUTH_URL_PATTERN, "$1[redacted]@");

const sanitizeUrl = (value: string) => {
    try {
        const url = new URL(value);

        if (url.username) {
            url.username = "[redacted]";
        }

        if (url.password) {
            url.password = "[redacted]";
        }

        for (const [key] of url.searchParams.entries()) {
            if (SENSITIVE_QUERY_PARAM_PATTERN.test(key)) {
                url.searchParams.set(key, "[redacted]");
            }
        }

        return url.toString();
    } catch {
        return sanitizeVisibleText(value);
    }
};

const sanitizeString = (value: string, parentKey?: string, forceRedact = false) => {
    if (forceRedact || looksSensitiveHint(parentKey)) {
        return REDACTED_TEXT;
    }

    return /^(https?:\/\/)/i.test(value) ? sanitizeUrl(value) : sanitizeVisibleText(value);
};

const sanitizeUnknown = (value: unknown, parentKey?: string, forceRedact = false): unknown => {
    if (forceRedact || looksSensitiveHint(parentKey)) {
        return REDACTED_TEXT;
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeUnknown(item, parentKey));
    }

    if (typeof value === "object" && value !== null) {
        return Object.fromEntries(
            Object.entries(value).map(([key, entryValue]) => [
                key,
                sanitizeUnknown(entryValue, key, looksSensitiveHint(key)),
            ]),
        );
    }

    if (typeof value === "string") {
        return sanitizeString(value, parentKey);
    }

    return value;
};

const sanitizeAccessibilityNode = (
    node: BrowserElementNode,
    inheritedSensitive = false,
): BrowserElementNode => {
    const localSensitive =
        inheritedSensitive ||
        looksSensitiveHint([node.role, node.name, node.description].filter(Boolean).join(" "));

    return {
        role: node.role,
        ...(node.name === undefined ? {} : { name: sanitizeString(node.name) }),
        ...(node.description === undefined
            ? {}
            : { description: sanitizeString(node.description) }),
        ...(node.value === undefined
            ? {}
            : {
                  value: localSensitive ? REDACTED_TEXT : sanitizeString(node.value),
              }),
        ...(node.selector === undefined ? {} : { selector: node.selector }),
        ...(node.children === undefined
            ? {}
            : {
                  children: node.children.map((child) =>
                      sanitizeAccessibilityNode(child, localSensitive),
                  ),
              }),
    };
};

export class ElectronBrowserRuntime implements BrowserRuntime {
    private readonly accessibilityReader = new AccessibilityTreeReader();
    private readonly visionGrounder = new VisionGrounder();

    constructor(private readonly browser: Browser) {}

    async listTabs(): Promise<BrowserTabSummary[]> {
        return this.browser.tabs.map((tab) => this.toSummary(tab));
    }

    async getFocusedTab(): Promise<BrowserTabSummary | null> {
        const view = this.browser.getFocusedTab();
        return view ? this.toSummary(view) : null;
    }

    async openTab(url?: string): Promise<BrowserTabSummary> {
        const id = await this.browser.create(url);
        return this.getTabSummary(id);
    }

    async closeTab(tabId: number): Promise<void> {
        await this.browser.remove(tabId);
    }

    async focusTab(tabId: number): Promise<BrowserTabSummary> {
        await this.browser.focus(tabId);
        return this.getTabSummary(tabId);
    }

    async load(tabId: number, url: string): Promise<BrowserTabSummary> {
        await this.browser.load(tabId, url);
        return this.getTabSummary(tabId);
    }

    async reload(tabId: number): Promise<void> {
        this.browser.reload(tabId);
    }

    async goBack(tabId: number): Promise<void> {
        await this.browser.getNavigationHistory(tabId)?.goBack();
    }

    async goForward(tabId: number): Promise<void> {
        await this.browser.getNavigationHistory(tabId)?.goForward();
    }

    async snapshotDom(tabId?: number): Promise<BrowserDomSnapshot> {
        const view = this.requireTab(tabId);
        const accessibility = await this.accessibilityReader.read(view.webContents);

        return {
            tabId: view.webContents.id,
            url: sanitizeUrl(view.webContents.getURL()),
            title: sanitizeString(view.webContents.getTitle()),
            ...(accessibility === undefined
                ? {}
                : { accessibility: sanitizeAccessibilityNode(accessibility) }),
        };
    }

    async captureScreenshot(tabId?: number): Promise<BrowserImageSnapshot> {
        const view = this.requireTab(tabId);
        const overlayIds = await this.applySensitiveOverlays(view);

        try {
            const image = await view.webContents.capturePage();

            return {
                tabId: view.webContents.id,
                mimeType: "image/png",
                base64: image.toPNG().toString("base64"),
                width: image.getSize().width,
                height: image.getSize().height,
            };
        } finally {
            await this.clearSensitiveOverlays(view, overlayIds);
        }
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
            result: sanitizeUnknown(await view.webContents.executeJavaScript(script, true)),
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
        const view =
            tabId === undefined ? this.browser.getFocusedTab() : this.browser.getTab(tabId);
        if (!view) {
            throw new Error(
                tabId === undefined ? "No focused tab available." : `Tab not found: ${tabId}`,
            );
        }

        return view;
    }

    private getTabSummary(tabId: number) {
        const view = this.browser.getTab(tabId);
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

    private async applySensitiveOverlays(view: View) {
        return (await view.webContents.executeJavaScript(
            `(() => {
                const redactionAttr = 'data-hyaenidae-redaction-id';
                const redactionText = 'Sensitive field hidden';
                const sensitivePattern = ${SENSITIVE_FIELD_HINT_PATTERN};
                const sensitiveAutocompleteValues = new Set([
                    'username',
                    'current-password',
                    'new-password',
                    'one-time-code',
                    'cc-name',
                    'cc-given-name',
                    'cc-family-name',
                    'cc-number',
                    'cc-exp',
                    'cc-exp-month',
                    'cc-exp-year',
                    'cc-csc',
                    'webauthn',
                ]);
                const sanitize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
                const isSensitiveElement = (element) => {
                    if (!(element instanceof HTMLElement)) {
                        return false;
                    }

                    const hintText = sanitize([
                        element.getAttribute('name') || '',
                        element.getAttribute('id') || '',
                        element.getAttribute('aria-label') || '',
                        'placeholder' in element && typeof element.placeholder === 'string'
                            ? element.placeholder
                            : '',
                    ].join(' '));

                    const currentValue =
                        'value' in element && typeof element.value === 'string'
                            ? element.value.trim()
                            : element.isContentEditable
                              ? (element.textContent || '').trim()
                              : '';

                    if (!currentValue) {
                        return false;
                    }

                    if (element instanceof HTMLInputElement) {
                        const type = sanitize(element.type || '');
                        const autocomplete = sanitize(element.autocomplete || '');
                        if (['password', 'email', 'tel', 'hidden'].includes(type)) {
                            return true;
                        }

                        if (sensitiveAutocompleteValues.has(autocomplete)) {
                            return true;
                        }

                        return sensitivePattern.test([type, autocomplete, hintText].join(' '));
                    }

                    if (element instanceof HTMLTextAreaElement || element.isContentEditable) {
                        return sensitivePattern.test(hintText);
                    }

                    return false;
                };

                return Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
                    .filter((element) => isSensitiveElement(element))
                    .map((element, index) => {
                        if (!(element instanceof HTMLElement)) {
                            return null;
                        }

                        const rect = element.getBoundingClientRect();
                        if (rect.width <= 0 || rect.height <= 0) {
                            return null;
                        }

                        const overlayId = 'hyaenidae-redaction-' + Date.now() + '-' + index;
                        const overlay = document.createElement('div');
                        overlay.setAttribute(redactionAttr, overlayId);
                        overlay.textContent = redactionText;
                        overlay.style.position = 'fixed';
                        overlay.style.left = rect.left + 'px';
                        overlay.style.top = rect.top + 'px';
                        overlay.style.width = rect.width + 'px';
                        overlay.style.height = rect.height + 'px';
                        overlay.style.zIndex = '2147483647';
                        overlay.style.pointerEvents = 'none';
                        overlay.style.display = 'flex';
                        overlay.style.alignItems = 'center';
                        overlay.style.justifyContent = 'center';
                        overlay.style.background = 'rgba(241, 245, 249, 0.96)';
                        overlay.style.border = '1px solid rgba(148, 163, 184, 0.8)';
                        overlay.style.borderRadius = '8px';
                        overlay.style.color = '#475569';
                        overlay.style.font = '12px sans-serif';
                        overlay.style.letterSpacing = '0.02em';
                        document.documentElement.appendChild(overlay);
                        return overlayId;
                    })
                    .filter(Boolean);
            })()`,
            true,
        )) as string[];
    }

    private async clearSensitiveOverlays(view: View, overlayIds: string[]) {
        if (overlayIds.length === 0) {
            return;
        }

        const serializedOverlayIds = JSON.stringify(overlayIds);

        await view.webContents.executeJavaScript(
            `(() => {
                const overlayIds = ${serializedOverlayIds};
                for (const overlayId of overlayIds) {
                    document
                        .querySelector('[data-hyaenidae-redaction-id="' + overlayId + '"]')
                        ?.remove();
                }
            })()`,
            true,
        );
    }

    private toSummary(view: View): BrowserTabSummary {
        return {
            id: view.webContents.id,
            title: sanitizeString(view.webContents.getTitle() || "New Tab"),
            url: sanitizeUrl(view.webContents.getURL()),
            isFocused: this.browser.currentId === view.webContents.id,
            isLoading: view.webContents.isLoading(),
        };
    }
}
