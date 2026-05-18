import type {
    BrowserActionResult,
    BrowserDomSnapshot,
    BrowserElementNode,
    BrowserRuntime,
    BrowserScriptResult,
    BrowserTabSummary,
    BrowserImageSnapshot,
} from "@hyaenidae/core";
import type { WebContents } from "electron";
import type { Browser } from "../browser";
import type { Tab } from "../browser/tab";
import { AccessibilityTreeReader } from "./accessibility";

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

const sanitizeString = (
    value: string,
    parentKey?: string,
    forceRedact = false,
) => {
    if (forceRedact || looksSensitiveHint(parentKey)) {
        return REDACTED_TEXT;
    }

    return /^(https?:\/\/)/i.test(value)
        ? sanitizeUrl(value)
        : sanitizeVisibleText(value);
};

const sanitizeUnknown = (
    value: unknown,
    parentKey?: string,
    forceRedact = false,
): unknown => {
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
        looksSensitiveHint(
            [node.role, node.name, node.description].filter(Boolean).join(" "),
        );

    return {
        role: node.role,
        ...(node.name === undefined ? {} : { name: sanitizeString(node.name) }),
        ...(node.description === undefined
            ? {}
            : { description: sanitizeString(node.description) }),
        ...(node.value === undefined
            ? {}
            : {
                  value: localSensitive
                      ? REDACTED_TEXT
                      : sanitizeString(node.value),
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

    constructor(private readonly browser: Browser) {}

    async listTabs(): Promise<BrowserTabSummary[]> {
        return this.browser.tabs.map((tab) => this.toSummary(tab));
    }

    async getFocusedTab(): Promise<BrowserTabSummary | null> {
        const tab = this.browser.getFocusedTab();
        return tab ? this.toSummary(tab) : null;
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
        await this.browser.reload(tabId);
    }

    async goBack(tabId: number): Promise<void> {
        await this.browser.getNavigationHistory(tabId)?.goBack();
    }

    async goForward(tabId: number): Promise<void> {
        await this.browser.getNavigationHistory(tabId)?.goForward();
    }

    async snapshotDom(tabId?: number): Promise<BrowserDomSnapshot> {
        const tab = this.requireTab(tabId);
        const accessibility = await this.accessibilityReader.read(
            tab.webContents,
        );

        return {
            tabId: tab.webContents.id,
            url: sanitizeUrl(tab.webContents.getURL()),
            title: sanitizeString(tab.webContents.getTitle()),
            ...(accessibility === undefined
                ? {}
                : { accessibility: sanitizeAccessibilityNode(accessibility) }),
        };
    }

    async captureScreenshot(tabId?: number): Promise<BrowserImageSnapshot> {
        const tab = this.requireTab(tabId);
        const overlayIds = await this.applySensitiveOverlays(tab);

        try {
            const image = await tab.webContents.capturePage();

            return {
                tabId: tab.webContents.id,
                mimeType: "image/jpeg",
                base64: image.toJPEG(80).toString("base64"),
                width: image.getSize().width,
                height: image.getSize().height,
            };
        } finally {
            await this.clearSensitiveOverlays(tab, overlayIds);
        }
    }

    async runScript(input: {
        tabId?: number;
        script: string;
        args?: unknown[];
    }): Promise<BrowserScriptResult> {
        const tab = this.requireTab(input.tabId);
        const serializedArgs = JSON.stringify(input.args ?? []);
        // Expose args as a local variable so agent-authored snippets can stay short.
        const script = `(async () => {
            const args = ${serializedArgs};
            return await (async () => {
                ${input.script}
            })();
        })()`;

        return {
            tabId: tab.webContents.id,
            result: sanitizeUnknown(
                await tab.webContents.executeJavaScript(script, true),
            ),
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
        const tab = this.requireTab(input.tabId);

        if (input.action === "scroll") {
            await tab.webContents.executeJavaScript(
                `window.scrollBy({ top: ${input.direction === "up" ? -1 : 1} * ${input.amount ?? 600}, behavior: 'smooth' });`,
                true,
            );

            return {
                tabId: tab.webContents.id,
                action: input.action,
                ok: true,
                details: "Scrolled page.",
            };
        }

        if (!input.selector) {
            throw new Error(`Action '${input.action}' requires a selector.`);
        }

        if (input.action === "click") {
            const domClickResult = await this.tryDomClick(tab, input.selector);

            if (!domClickResult.ok) {
                const point = await this.resolveInteractionPoint(
                    tab,
                    input.selector,
                );
                await this.dispatchClick(tab.webContents, point);
            }

            return {
                tabId: tab.webContents.id,
                action: input.action,
                ok: true,
                details: domClickResult.ok
                    ? `Clicked ${input.selector} via DOM action.`
                    : `Clicked ${input.selector} via mouse fallback.`,
            };
        }

        const domTypeResult = await this.tryDomType(
            tab,
            input.selector,
            input.text ?? "",
        );

        if (!domTypeResult.ok) {
            const point = await this.resolveInteractionPoint(
                tab,
                input.selector,
            );
            await this.dispatchClick(tab.webContents, point);
            await this.focusElementForTyping(tab, input.selector);
            await tab.webContents.insertText(input.text ?? "");
        }

        return {
            tabId: tab.webContents.id,
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
        const tab = this.requireTab(input.tabId);

        tab.webContents.focus();
        tab.webContents.sendInputEvent({
            type: "mouseDown",
            x: Math.round(input.x),
            y: Math.round(input.y),
            button: "left",
            clickCount: 1,
        });

        tab.webContents.sendInputEvent({
            type: "mouseUp",
            x: Math.round(input.x),
            y: Math.round(input.y),
            button: "left",
            clickCount: 1,
        });

        if (input.action === "type") {
            await tab.webContents.insertText(input.text ?? "");
        }

        return {
            tabId: tab.webContents.id,
            action: input.action,
            ok: true,
            details:
                input.action === "type"
                    ? `Clicked and typed at (${Math.round(input.x)}, ${Math.round(input.y)}).`
                    : `Clicked at (${Math.round(input.x)}, ${Math.round(input.y)}).`,
        };
    }

    private requireTab(tabId?: number) {
        const tab =
            tabId === undefined
                ? this.browser.getFocusedTab()
                : this.browser.getTab(tabId);
        if (!tab) {
            throw new Error(
                tabId === undefined
                    ? "No focused tab available."
                    : `Tab not found: ${tabId}`,
            );
        }

        return tab;
    }

    private getTabSummary(tabId: number) {
        const tab = this.browser.getTab(tabId);
        if (!tab) {
            throw new Error(`Tab not found: ${tabId}`);
        }

        return this.toSummary(tab);
    }

    private async resolveInteractionPoint(tab: Tab, selector: string) {
        const serializedSelector = JSON.stringify(selector);

        return (await tab.webContents.executeJavaScript(
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

    private async tryDomClick(tab: Tab, selector: string) {
        const serializedSelector = JSON.stringify(selector);

        return (await tab.webContents.executeJavaScript(
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

    private async tryDomType(tab: Tab, selector: string, text: string) {
        const serializedSelector = JSON.stringify(selector);
        const serializedText = JSON.stringify(text);

        return (await tab.webContents.executeJavaScript(
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

    private async focusElementForTyping(tab: Tab, selector: string) {
        const serializedSelector = JSON.stringify(selector);

        await tab.webContents.executeJavaScript(
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

    private async dispatchClick(
        webContents: WebContents,
        point: { x: number; y: number },
    ) {
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

    private async applySensitiveOverlays(tab: Tab) {
        return (await tab.webContents.executeJavaScript(
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

    private async clearSensitiveOverlays(tab: Tab, overlayIds: string[]) {
        if (overlayIds.length === 0) {
            return;
        }

        const serializedOverlayIds = JSON.stringify(overlayIds);

        await tab.webContents.executeJavaScript(
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

    private toSummary(tab: Tab): BrowserTabSummary {
        return {
            id: tab.webContents.id,
            title: sanitizeString(tab.webContents.getTitle() || "New Tab"),
            url: sanitizeUrl(tab.webContents.getURL()),
            isFocused: this.browser.focusedId === tab.webContents.id,
            isLoading: tab.webContents.isLoading(),
        };
    }
}
