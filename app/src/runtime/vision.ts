import { BrowserDomSnapshot, BrowserGroundingTarget } from "@hyaenidae/core";

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

const tokenize = (value: string) =>
    normalize(value)
        .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
        .filter((token) => token.length >= 2);

// Grounds a visual description back onto DOM candidates so follow-up actions can stay deterministic.
export class VisionGrounder {
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
                    : {
                          text: candidate.element.text ?? candidate.element.ariaLabel,
                      }),
                ...(candidate.element.href === undefined ? {} : { url: candidate.element.href }),
            }));
    }
}
