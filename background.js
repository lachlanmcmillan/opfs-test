// background.js

browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message.type === "TEST_OPFS_ACCESS" && message.tabId) {
        const tabId = message.tabId;

        try {
            // This function will be executed in the context of the inspected page.
            const injectionResults = await browser.scripting.executeScript({
                target: { tabId: tabId },
                func: async () => {
                    // This code runs in the content script environment
                    try {
                        const root = await navigator.storage.getDirectory();
                        if (root) {
                            // Try to create a dummy file to confirm write access
                            const testFileName = `opfs-test-${Date.now()}.txt`;
                            const fileHandle = await root.getFileHandle(
                                testFileName,
                                { create: true }
                            );
                            const writable = await fileHandle.createWritable();
                            await writable.write("Hello from OPFS Test!");
                            await writable.close();

                            // Verify file exists by trying to get it again
                            await root.getFileHandle(testFileName, {
                                create: false,
                            });
                            await root.removeEntry(testFileName); // Clean up the test file

                            return {
                                status: "success",
                                message: `navigator.storage.getDirectory() accessible. Test file '${testFileName}' created and deleted.`,
                            };
                        } else {
                            return {
                                status: "error",
                                message:
                                    "navigator.storage.getDirectory() returned null/undefined.",
                            };
                        }
                    } catch (error) {
                        return {
                            status: "error",
                            message: `Error in content script: ${error.message} (${error.name})`,
                        };
                    }
                },
            });

            // Send the result from the content script back to the devtools panel
            const contentScriptResult = injectionResults[0]?.result;
            browser.runtime.sendMessage({
                type: "OPFS_ACCESS_RESULT",
                tabId: tabId,
                result: contentScriptResult || {
                    status: "error",
                    message: "No result from content script.",
                },
            });
        } catch (error) {
            console.error(
                "Background script failed to inject/execute script:",
                error
            );
            browser.runtime.sendMessage({
                type: "OPFS_ACCESS_RESULT",
                tabId: tabId,
                result: {
                    status: "error",
                    message: `Background script error: ${error.message}`,
                },
            });
        }
    }
});
