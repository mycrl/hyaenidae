import BrowserChrome from "./BrowserChrome.tsx";
import PageContent from "./PageContent.tsx";
import AgentPanel from "./AgentPanel.tsx";
import { useDemoAnimation } from "./useDemoAnimation.ts";
import "../../styles/BrowserDemo.css";

/** Product demo window: browser chrome + page + agent sidebar. */
export default function BrowserDemo() {
    const demo = useDemoAnimation();

    const showUrlCursor = demo.phase === "opening-tab";
    const pageLoading =
        demo.phase === "loading-page" ||
        demo.phase === "ai-responding" ||
        demo.phase === "hold";
    const showComposerCursor = demo.phase === "typing-composer";
    const sendActive = demo.phase === "sending";
    const showAiThinking = demo.showAiThinking;

    return (
        <div className="browser-demo" key={demo.cycle}>
            <div className="browser-window">
                <BrowserChrome
                    tabTitle={demo.tabTitle}
                    showTab={demo.showTab}
                    urlText={demo.urlText}
                    urlReady={demo.urlReady}
                    agentPanelOpen={demo.agentPanelOpen}
                    showUrlCursor={showUrlCursor}
                />

                <div className="browser-body">
                    <PageContent
                        visible={demo.showPageContent}
                        loading={pageLoading}
                    />
                    <AgentPanel
                        composerText={demo.composerText}
                        showComposerCursor={showComposerCursor}
                        chatText={demo.chatText}
                        showAiReply={demo.showAiReply}
                        showAiThinking={showAiThinking}
                        sessionTitle={demo.sessionTitle}
                        sendActive={sendActive}
                    />
                </div>
            </div>
        </div>
    );
}
