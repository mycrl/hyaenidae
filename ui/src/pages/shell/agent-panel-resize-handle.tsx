import "../../styles/pages.shell.agent-panel-resize-handle.css";

import { useEffect, useRef, useState } from "react";

interface AgentPanelResizeHandleProps {
    width: number;
    minWidth: number;
    maxWidth: number;
    onResize: (width: number) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function AgentPanelResizeHandle({
    width,
    minWidth,
    maxWidth,
    onResize,
}: AgentPanelResizeHandleProps) {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number; width: number } | null>(null);

    useEffect(() => {
        if (!isDragging) {
            return;
        }

        const onMouseMove = (event: MouseEvent) => {
            const dragStart = dragStartRef.current;
            if (!dragStart) {
                return;
            }

            const deltaX = event.clientX - dragStart.x;
            const maxWidthByViewport = window.innerWidth - minWidth;
            const nextWidth = Math.min(
                clamp(dragStart.width - deltaX, minWidth, maxWidth),
                Math.max(minWidth, maxWidthByViewport),
            );

            onResize(nextWidth);
        };

        const onMouseUp = () => {
            setIsDragging(false);
            dragStartRef.current = null;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        return () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [isDragging, maxWidth, minWidth, onResize]);

    return (
        <div
            tag="agent-panel-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize agent panel"
            onMouseDown={(event) => {
                event.preventDefault();
                dragStartRef.current = {
                    x: event.clientX,
                    width,
                };
                setIsDragging(true);
            }}
            className="agent-panel-resize-handle"
        />
    );
}
