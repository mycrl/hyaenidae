import "../../styles/pages.shell.css";

import { useCallback, useEffect, useRef, useState } from "react";
import AgentPanel from "./agent-panel";
import AgentPanelResizeHandle from "./agent-panel-resize-handle";
import NavigationBar from "./navigation-bar";
import TabBar from "./tab-bar";
import { useAgentStore } from "../../services/agent";
import { useSettingsStore } from "../../services/settings";
import { useShellStore } from "../../services/shell";

const AGENT_PANEL_MIN_WIDTH = 320;
const AGENT_PANEL_DEFAULT_WIDTH = 450;
const AGENT_PANEL_MAX_WIDTH = 900;
const AGENT_PANEL_RESIZER_WIDTH = 4;
const DEFAULT_TAB_BAR_HEIGHT = 47;
const DEFAULT_NAVIGATION_BAR_HEIGHT = 48;

export default function Shell() {
    const initializeRpc = useShellStore((state) => state.initializeRpc);
    const initializeAgentRpc = useAgentStore((state) => state.initializeRpc);
    const initializeSettingsRpc = useSettingsStore((state) => state.initializeRpc);
    const isAgentPanelOpen = useShellStore((state) => state.isAgentPanelOpen);
    const layoutChanged = useShellStore((state) => state.layoutChanged);
    const [agentPanelWidth, setAgentPanelWidth] = useState(AGENT_PANEL_DEFAULT_WIDTH);
    const tabBarRef = useRef<HTMLDivElement | null>(null);
    const navigationBarRef = useRef<HTMLDivElement | null>(null);
    const rpcInitializedRef = useRef(false);

    const emitLayoutChanged = useCallback(
        (width: number) => {
            const tabBarHeight =
                (tabBarRef.current?.offsetHeight ?? DEFAULT_TAB_BAR_HEIGHT) +
                (navigationBarRef.current?.offsetHeight ?? DEFAULT_NAVIGATION_BAR_HEIGHT) +
                1;

            void layoutChanged({
                tabBarHeight,
                agentPanelWidth: isAgentPanelOpen
                    ? Math.round(width + AGENT_PANEL_RESIZER_WIDTH + 1)
                    : 0,
            });
        },
        [isAgentPanelOpen, layoutChanged],
    );

    useEffect(() => {
        if (rpcInitializedRef.current) {
            return;
        }

        rpcInitializedRef.current = true;
        void initializeRpc()
            .then(async () => {
                await initializeSettingsRpc();
                await initializeAgentRpc();
            })
            .finally(() => {
                // Report one layout after shell RPC initialization.
                emitLayoutChanged(agentPanelWidth);
            });
    }, [
        agentPanelWidth,
        emitLayoutChanged,
        initializeAgentRpc,
        initializeRpc,
        initializeSettingsRpc,
    ]);

    useEffect(() => {
        emitLayoutChanged(agentPanelWidth);
    }, [agentPanelWidth, emitLayoutChanged]);

    return (
        <div tag="app-shell" className="app-shell">
            <div tag="app-frame" className="app-frame">
                <div tag="app-tabbar" ref={tabBarRef}>
                    <TabBar />
                </div>

                <div tag="app-body" className="app-body">
                    <div tag="app-main" className="app-main">
                        <div tag="app-navigation" ref={navigationBarRef}>
                            <NavigationBar />
                        </div>

                        <div tag="app-canvas" className="app-canvas" />
                    </div>

                    {isAgentPanelOpen && (
                        <>
                            <AgentPanelResizeHandle
                                width={agentPanelWidth}
                                minWidth={AGENT_PANEL_MIN_WIDTH}
                                maxWidth={AGENT_PANEL_MAX_WIDTH}
                                onResize={setAgentPanelWidth}
                            />

                            <div
                                tag="app-agent-panel"
                                style={{ width: `${agentPanelWidth}px` }}
                                className="app-agent-panel"
                            >
                                <AgentPanel />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
