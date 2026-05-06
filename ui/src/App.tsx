import { useEffect } from "react";
import AgentPanel from "./components/AgentPanel";
import NavigationBar from "./components/NavigationBar";
import TabBar from "./components/TabBar";
import { useTabStore } from "./state/tabStore";

export default function App() {
    const initializeRpc = useTabStore((state) => state.initializeRpc);
    const isAgentPanelOpen = useTabStore((state) => state.isAgentPanelOpen);

    useEffect(() => {
        void initializeRpc();
    }, [initializeRpc]);

    return (
        <div className="h-screen select-none bg-slate-50">
            <div className="h-full w-full overflow-hidden border border-slate-200 bg-white text-slate-800">
                <TabBar />

                <div className="h-[calc(100%-3rem)] min-h-0 flex">
                    <div className="flex-1 min-w-0 flex flex-col">
                        <NavigationBar />

                        <div className="flex-1 min-h-0 bg-white" />
                    </div>

                    {isAgentPanelOpen && (
                        <div className="w-[450px] border-l border-slate-200 h-full overflow-hidden bg-white transition-[width,min-width,border-color] duration-200">
                            <AgentPanel />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
