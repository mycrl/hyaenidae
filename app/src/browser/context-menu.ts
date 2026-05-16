import { BrowserWindow, Menu, WebContents } from "electron";
import type { Browser } from ".";
import type { Tab } from "./tab";

const TRANSLATIONS = {
    "zh-CN": {
        copy: "复制",
        paste: "粘贴",
        selectAll: "全选",
        saveImage: "保存图片",
        searchWithGoogle: "使用谷歌搜索",
        copyLink: "复制链接地址",
        openLinkInNewTab: "在新标签页中打开链接",
        inspect: "检查",
        reload: "重新加载",
        addToChat: "添加到助手聊天",
        closeTab: "关闭标签页",
    },
    "en-US": {
        copy: "Copy",
        paste: "Paste",
        selectAll: "Select All",
        saveImage: "Save Image",
        searchWithGoogle: "Search with Google",
        copyLink: "Copy Link",
        openLinkInNewTab: "Open Link in New Tab",
        inspect: "Inspect",
        reload: "Reload",
        addToChat: "Add to Agent Chat",
        closeTab: "Close Tab",
    },
};

/**
 * Set properties of menu items based on their IDs.
 *
 * @param menu The context menu to update.
 * @param items An object where keys are menu item IDs and values are partial
 * properties to set.
 */
function setItemsProperties(
    menu: Menu,
    items: {
        [key: string]: Partial<{
            label: string;
            visible: boolean;
            enabled: boolean;
            checked: boolean;
            click: (
                event: Event,
                window: BrowserWindow,
                webContents: WebContents,
            ) => void;
        }>;
    },
) {
    for (const [id, properties] of Object.entries(items)) {
        const item = menu.getMenuItemById(id);
        if (!item) {
            console.warn(`Context menu item with id "${id}" not found.`);

            continue;
        }

        for (const [key, value] of Object.entries(properties)) {
            (item as any)[key] = value;
        }
    }
}

/**
 * Registers a context menu for the given web contents.
 *
 * @param view The view whose web contents to attach the context menu to.
 * @param lang The language for the context menu labels (default is "en-US").
 */
export function registerContextMenu({
    tab,
    browser,
    isShell = false,
    lang = "zh-CN",
}: {
    tab: Tab;
    browser: Browser;
    isShell?: boolean;
    lang?: keyof typeof TRANSLATIONS;
}) {
    const contextMenu = Menu.buildFromTemplate(
        isShell
            ? [
                  {
                      id: "reload",
                      role: "reload",
                      label: TRANSLATIONS[lang].reload,
                  },
                  {
                      id: "addToChat",
                      label: TRANSLATIONS[lang].addToChat,
                  },
                  {
                      id: "closeTab",
                      label: TRANSLATIONS[lang].closeTab,
                  },
              ]
            : [
                  {
                      id: "addToChat",
                      label: TRANSLATIONS[lang].addToChat,
                  },
                  {
                      id: "reload",
                      role: "reload",
                      label: TRANSLATIONS[lang].reload,
                      click: () => {
                          tab.webContents.reload();
                      },
                  },
                  {
                      id: "copy",
                      role: "copy",
                      label: TRANSLATIONS[lang].copy,
                  },
                  {
                      id: "paste",
                      role: "paste",
                      label: TRANSLATIONS[lang].paste,
                  },
                  {
                      id: "selectAll",
                      role: "selectAll",
                      label: TRANSLATIONS[lang].selectAll,
                  },
                  {
                      id: "saveImage",
                      label: TRANSLATIONS[lang].saveImage,
                  },
                  {
                      id: "searchWithGoogle",
                      label: TRANSLATIONS[lang].searchWithGoogle,
                  },
                  {
                      id: "copyLink",
                      label: TRANSLATIONS[lang].copyLink,
                  },
                  {
                      id: "openLinkInNewTab",
                      label: TRANSLATIONS[lang].openLinkInNewTab,
                  },
                  {
                      id: "inspect",
                      label: TRANSLATIONS[lang].inspect,
                      click: () => {
                          tab.webContents.openDevTools({ mode: "detach" });
                      },
                  },
              ],
    );

    if (isShell) {
        tab.getBridge().on("shell:show-context-menu", (options) => {
            console.debug("Shell context menu requested at", options);

            setItemsProperties(contextMenu, {
                reload: {
                    click: () => {
                        browser.reload(options.tabId);
                    },
                },
                closeTab: {
                    click: () => {
                        browser.remove(options.tabId);
                    },
                },
                addToChat: {
                    click: () => {
                        tab.getBridge().send("shell:add-to-chat", {
                            tabId: options.tabId,
                        });
                    },
                },
            });

            contextMenu.popup({
                x: options.x,
                y: options.y,
            });
        });
    } else {
        tab.webContents.on("context-menu", (event, options) => {
            event.preventDefault();

            console.debug("Context menu requested at", event, options);

            setItemsProperties(contextMenu, {
                addToChat: {
                    visible:
                        options.linkURL !== "" ||
                        options.selectionText !== "" ||
                        options.mediaType === "image",
                    click: () => {
                        browser.getShellBridge().send("shell:add-to-chat", {
                            tabId: tab.webContents.id,
                            selected:
                                options.mediaType === "image"
                                    ? {
                                          content: options.srcURL,
                                          type: "image",
                                      }
                                    : options.linkURL !== ""
                                      ? {
                                            content: options.linkURL,
                                            type: "link",
                                        }
                                      : {
                                            content: options.selectionText,
                                            type: "text",
                                        },
                        });
                    },
                },
                copy: {
                    visible:
                        options.selectionText !== "" ||
                        options.mediaType === "image",
                },
                paste: {
                    visible: options.isEditable && options.editFlags.canPaste,
                },
                saveImage: {
                    visible: options.mediaType === "image",
                    click: () => {
                        tab.webContents.downloadURL(options.srcURL);
                    },
                },
                searchWithGoogle: {
                    visible: options.selectionText !== "",
                    label: `${TRANSLATIONS["en-US"].searchWithGoogle} "${options.selectionText}"`,
                    click: () => {
                        browser
                            .create(
                                `https://www.google.com/search?q=${encodeURIComponent(options.selectionText)}`,
                            )
                            .catch((error) => {
                                console.error(
                                    "Failed to open search results:",
                                    error,
                                );
                            });
                    },
                },
                copyLink: {
                    visible: options.linkURL !== "",
                },
                openLinkInNewTab: {
                    visible: options.linkURL !== "",
                    click: () => {
                        browser.create(options.linkURL).catch((error) => {
                            console.error(
                                "Failed to open link in new tab:",
                                error,
                            );
                        });
                    },
                },
            });

            contextMenu.popup();
        });
    }
}
