import pino, { Logger } from "pino";
import { format } from "node:util";

const LOGGER: Logger = pino({
    level: process.env.LOG_LEVEL || "info",
    transport: {
        target: "pino-pretty",
        options: {
            colorize: true,
        },
    },
});

const wrapConsole = (level: keyof Logger) => {
    const logger = LOGGER as any;

    return (...args: any[]) => {
        logger[level](format(...args));
    };
};

/**
 * Override the global console methods to use pino for better logging.
 */
export function registerLogger() {
    global.console = {
        log: wrapConsole("info"),
        info: wrapConsole("info"),
        warn: wrapConsole("warn"),
        error: wrapConsole("error"),
        debug: wrapConsole("debug"),
    } as unknown as Console;
}
