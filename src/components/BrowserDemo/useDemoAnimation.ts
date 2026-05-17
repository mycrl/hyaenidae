import { useEffect, useState } from "react";

export type DemoPhase =
    | "idle"
    | "typing-composer"
    | "sending"
    | "message-sent"
    | "ai-thinking"
    | "opening-tab"
    | "loading-page"
    | "ai-responding"
    | "hold";

const TAB_TITLE = "New York weather today - Go...";
const URL =
    "https://www.google.com/search?q=New+York+weather+today&oq=New+York+weather+today";
const CHAT = "How is the weather in New York today?";
const SESSION_TITLE = "NY Today Weather";

export function useDemoAnimation() {
    const [phase, setPhase] = useState<DemoPhase>("idle");
    const [composerText, setComposerText] = useState("");
    const [chatText, setChatText] = useState("");
    const [urlText, setUrlText] = useState("");
    const [sessionTitle, setSessionTitle] = useState("");
    const [cycle, setCycle] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const timers: ReturnType<typeof setTimeout>[] = [];

        const wait = (ms: number) =>
            new Promise<void>((resolve) => {
                timers.push(setTimeout(resolve, ms));
            });

        const typeText = async (
            full: string,
            setter: (value: string) => void,
            charMs = 28,
        ) => {
            for (let i = 0; i <= full.length; i++) {
                if (cancelled) return;
                setter(full.slice(0, i));
                await wait(charMs + Math.random() * 18);
            }
        };

        const run = async () => {
            while (!cancelled) {
                setPhase("idle");
                setComposerText("");
                setChatText("");
                setUrlText("");
                setSessionTitle("");

                await wait(700);
                if (cancelled) return;

                // 1. Type in composer and send
                setPhase("typing-composer");
                await typeText(CHAT, setComposerText, 36);
                if (cancelled) return;

                setPhase("sending");
                await wait(400);
                if (cancelled) return;

                setComposerText("");
                setChatText(CHAT);
                setPhase("message-sent");
                await wait(400);
                if (cancelled) return;

                // 2. AI thinks first (no tab yet)
                setPhase("ai-thinking");
                await wait(1400);
                if (cancelled) return;

                // 3. Agent opens tab and navigates
                setPhase("opening-tab");
                await typeText(URL, setUrlText, 12);
                if (cancelled) return;

                setPhase("loading-page");
                await wait(900);
                if (cancelled) return;

                // 4. AI shows final reply, then session title
                setPhase("ai-responding");
                await wait(1000);
                if (cancelled) return;

                setSessionTitle(SESSION_TITLE);
                await wait(1400);
                if (cancelled) return;

                setPhase("hold");
                await wait(2800);
                if (cancelled) return;

                setCycle((c) => c + 1);
            }
        };

        void run();

        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
    }, []);

    const showTab =
        phase === "opening-tab" ||
        phase === "loading-page" ||
        phase === "ai-responding" ||
        phase === "hold";

    const showPageContent =
        phase === "loading-page" ||
        phase === "ai-responding" ||
        phase === "hold";

    const showAiThinking =
        phase === "ai-thinking" ||
        phase === "opening-tab" ||
        phase === "loading-page";

    const showAiReply = phase === "ai-responding" || phase === "hold";

    const urlReady =
        phase === "loading-page" ||
        phase === "ai-responding" ||
        phase === "hold";

    return {
        phase,
        cycle,
        tabTitle: TAB_TITLE,
        urlText,
        composerText,
        chatText,
        sessionTitle,
        showTab,
        showPageContent,
        showAiThinking,
        showAiReply,
        urlReady,
        agentPanelOpen: true,
    };
}
