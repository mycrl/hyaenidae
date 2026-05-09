import { useCallback, useEffect, useRef, useState } from "react";
import AgentPanel from "../components/AgentPanel";
import AgentPanelResizeHandle from "../components/AgentPanelResizeHandle";
import NavigationBar from "../components/NavigationBar";
import TabBar from "../components/TabBar";
import { useAgentStore } from "../state/agent";
import { useSettingsStore } from "../state/settings";
import { useTabStore } from "../state/shell";

const AGENT_PANEL_MIN_WIDTH = 320;
const AGENT_PANEL_DEFAULT_WIDTH = 450;
const AGENT_PANEL_MAX_WIDTH = 900;
const AGENT_PANEL_RESIZER_WIDTH = 4;
const DEFAULT_TAB_BAR_HEIGHT = 47;
const DEFAULT_NAVIGATION_BAR_HEIGHT = 48;

export default function App() {
    const initializeRpc = useTabStore((state) => state.initializeRpc);
    const initializeAgentRpc = useAgentStore((state) => state.initializeRpc);
    const initializeSettingsRpc = useSettingsStore((state) => state.initializeRpc);
    const settingsProviders = useSettingsStore((state) => state.settings.providers);
    const refreshProviders = useAgentStore((state) => state.refreshProviders);
    const isAgentPanelOpen = useTabStore((state) => state.isAgentPanelOpen);
    const layoutChanged = useTabStore((state) => state.layoutChanged);
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
        void refreshProviders();
    }, [refreshProviders, settingsProviders]);

    useEffect(() => {
        emitLayoutChanged(agentPanelWidth);
    }, [agentPanelWidth, emitLayoutChanged]);

    return (
        <div className="h-screen select-none bg-slate-50">
            <div className="h-full w-full overflow-hidden border border-slate-200 bg-white text-slate-800">
                <div ref={tabBarRef}>
                    <TabBar />
                </div>

                <div className="h-[calc(100%-3rem)] min-h-0 flex">
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div ref={navigationBarRef}>
                            <NavigationBar />
                        </div>

                        <div className="flex-1 min-h-0 bg-white" />
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
                                style={{ width: `${agentPanelWidth}px` }}
                                className="border-l border-slate-200 h-full overflow-hidden bg-white"
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
