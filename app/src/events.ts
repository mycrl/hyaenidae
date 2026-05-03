/**
 * A simple event emitter implementation that supports both specific event
 * listeners and wildcard watchers.
 *
 * Listeners can be registered for specific events, while watchers will receive
 * all emitted events. The EventEmitter class provides methods for adding and
 * removing listeners and watchers, as well as emitting events to the registered
 * callbacks.
 */
export interface Listener {
    id: number;
    event?: string;
    isWatcher: boolean;
}

/**
 * Implements a simple event emitter that allows registering listeners for
 * specific events as well as wildcard watchers that receive all events.
 *
 * The EventEmitter class provides methods for adding and removing listeners and
 * watchers, as well as emitting events to the registered callbacks.
 */
export default class EventEmitter {
    // A counter to generate unique IDs for listeners and watchers
    private counter = 0;

    // A mapping of watcher IDs to their callback functions
    private watchers: {
        [id: number]: (event: string, ...args: any[]) => Promise<void>;
    } = {};

    // A mapping of event names to arrays of listeners registered for those events
    private events: {
        [event: string]: {
            id: number;
            callback: (...args: any[]) => Promise<void>;
        }[];
    } = {};

    constructor() {}

    /**
     * Registers a listener for a specific event. The callback will be invoked
     * whenever the specified event is emitted, receiving any arguments passed
     * to the emit method. Returns a Listener object that can be used to remove
     * the listener later.
     *
     * @param event - The name of the event to listen for
     *
     * @param callback - The function to call when the event is emitted, which
     * will receive any arguments passed to the emit method
     *
     * @returns A Listener object that can be used to remove the listener later
     */
    on(event: string, callback: (...args: any[]) => Promise<void>): Listener {
        if (!this.events[event]) {
            this.events[event] = [];
        }

        const id = this.counter++;
        this.events[event].push({ id, callback });

        return { id, event, isWatcher: false };
    }

    /**
     * Registers a wildcard watcher that will receive all emitted events. The
     * callback will be invoked with the event name and any arguments passed to
     * the emit method whenever any event is emitted. Returns a Listener object
     * that can be used to remove the watcher later.
     *
     * @param callback - The function to call when any event is emitted, which
     * will receive the event name and any arguments passed to the emit method
     *
     * @returns A Listener object that can be used to remove the watcher later
     */
    watch(
        callback: (event: string, ...args: any[]) => Promise<void>,
    ): Listener {
        const id = this.counter++;
        this.watchers[id] = callback;

        return { id, isWatcher: true };
    }

    /**
     * Emits an event with the specified name and arguments, invoking all
     * registered listeners for that event as well as all wildcard watchers.
     * Listeners registered for the specific event will receive the arguments
     * passed to the emit method, while wildcard watchers will receive the event
     * name and the same arguments.
     *
     * @param event - The name of the event to emit
     *
     * @param args - The arguments to pass to the listeners registered for the
     * specific event, as well as to the wildcard watchers
     */
    async emit(event: string, ...args: any[]) {
        if (this.events[event]) {
            await Promise.all(
                this.events[event].map((listener) =>
                    listener.callback(...args),
                ),
            );
        }

        await Promise.all(
            Object.values(this.watchers).map((watcher) =>
                watcher(event, ...args),
            ),
        );
    }

    /**
     * Removes a previously registered listener or watcher. If the provided
     * Listener object corresponds to a specific event listener, it will be
     * removed from the list of listeners for that event. If it corresponds to a
     * wildcard watcher, it will be removed from the list of watchers. After
     * removal, the specified callback will no longer be invoked when the
     * corresponding event is emitted.
     *
     * @param listener - The Listener object representing the listener or
     * watcher to remove, which should have been returned by a previous call to
     * the on or watch method
     */
    removeListener(listener: Listener) {
        if (listener.isWatcher) {
            delete this.watchers[listener.id];
        } else {
            const listeners = this.events[listener.event!];
            if (listeners) {
                const index = listeners.findIndex((l) => l.id === listener.id);
                if (index !== -1) {
                    listeners.splice(index, 1);
                }

                if (listeners.length === 0) {
                    delete this.events[listener.event!];
                }
            }
        }
    }
}
