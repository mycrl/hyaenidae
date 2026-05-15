import "../styles/async-button.css";

import {
    useEffect,
    useState,
    type ButtonHTMLAttributes,
    type MouseEvent,
    type ReactNode,
} from "react";

type AsyncClickHandler = (event: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;

function isPromiseLike(value: unknown): value is Promise<unknown> {
    return typeof value === "object" && value !== null && "then" in value;
}

function LoadingSpinner({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={["async-button-spinner", className].filter(Boolean).join(" ")}
        />
    );
}

export default function AsyncButton({
    children,
    className,
    disabled,
    loading = false,
    loadingContent,
    icon,
    onClick,
    onLoadingChange,
    spinnerClassName,
    ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
    onClick?: AsyncClickHandler;
    loading?: boolean;
    loadingContent?: ReactNode;
    icon?: ReactNode;
    onLoadingChange?: (loading: boolean) => void;
    spinnerClassName?: string;
}) {
    const [internalLoading, setInternalLoading] = useState(false);
    const isLoading = loading || internalLoading;

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
        if (!onClick || disabled || isLoading) {
            return;
        }

        const result = onClick(event);

        if (!isPromiseLike(result)) {
            return;
        }

        setInternalLoading(true);

        try {
            await result;
        } finally {
            setInternalLoading(false);
        }
    };

    const content = isLoading && loadingContent ? loadingContent : children;
    const leadingVisual = isLoading ? <LoadingSpinner className={spinnerClassName} /> : icon;
    const shouldRenderLeadingVisual = leadingVisual !== undefined && leadingVisual !== null;

    return (
        <button
            {...props}
            type={props.type ?? "button"}
            onClick={(event) => {
                void handleClick(event);
            }}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            className={className}
        >
            <span className="async-button-content">
                {shouldRenderLeadingVisual ? (
                    <span aria-hidden="true" className="async-button-leading-visual">
                        {leadingVisual}
                    </span>
                ) : null}
                <span className="async-button-label">{content}</span>
            </span>
        </button>
    );
}
