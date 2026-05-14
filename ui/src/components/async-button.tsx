import "../styles/async-button.css";

import {
    cloneElement,
    isValidElement,
    useState,
    type ButtonHTMLAttributes,
    type MouseEvent,
    type ReactElement,
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
    onClick,
    spinnerClassName,
    ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
    onClick?: AsyncClickHandler;
    loading?: boolean;
    loadingContent?: ReactNode;
    spinnerClassName?: string;
}) {
    const [isPending, setIsPending] = useState(false);
    const isBusy = loading || isPending;

    const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
        if (!onClick || disabled || isBusy) {
            return;
        }

        const result = onClick(event);

        if (!isPromiseLike(result)) {
            return;
        }

        setIsPending(true);

        try {
            await result;
        } finally {
            setIsPending(false);
        }
    };

    const content = isBusy && loadingContent ? loadingContent : children;

    return (
        <button
            {...props}
            type={props.type ?? "button"}
            onClick={(event) => {
                void handleClick(event);
            }}
            disabled={disabled || isBusy}
            aria-busy={isBusy}
            className={className}
        >
            {isBusy ? (
                <span className="async-button-loading-content">
                    <LoadingSpinner className={spinnerClassName} />
                    <span>
                        {isValidElement(content) ? cloneElement(content as ReactElement) : content}
                    </span>
                </span>
            ) : (
                content
            )}
        </button>
    );
}
