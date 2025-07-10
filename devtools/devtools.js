// devtools/devtools.js

browser.devtools.panels
    .create("OPFS Viewer DOM Bridge", "", "devtools.html")
    .then((panel) => {
        console.log("[DevTools Panel] DevTools panel created.");
    });

document.addEventListener("DOMContentLoaded", () => {
    const getOpfsContentsButton = document.getElementById(
        "getOpfsContentsButton"
    );
    const resultDiv = document.getElementById("result");

    console.log(
        "[DevTools Panel] DOMContentLoaded - Initializing button listener."
    );

    // Listen for the final data from the background script
    browser.runtime.onMessage.addListener((message) => {
        if (
            message.type === "OPFS_CONTENTS_RESULT_DOM_BRIDGE" &&
            message.tabId === browser.devtools.inspectedWindow.tabId
        ) {
            console.log(
                "[DevTools Panel] Received final OPFS data from background script (via DOM bridge)."
            );
            const result = message.result; // This is the object sent from the eval'ed function
            if (result.status === "success") {
                if (result.contents && result.contents.length > 0) {
                    resultDiv.textContent =
                        "OPFS Contents (DOM Bridge):\n" +
                        result.contents.join("\n");
                } else {
                    resultDiv.textContent = "OPFS is empty for this origin.";
                }
                resultDiv.className = "success";
                console.log(
                    "[DevTools Panel] OPFS Contents successfully displayed."
                );
            } else {
                resultDiv.textContent = `Error from inspected page (DOM Bridge): ${result.message}`;
                resultDiv.className = "error";
                console.error(
                    "[DevTools Panel] OPFS Content Retrieval Error (DOM Bridge):",
                    result.message
                );
            }
        }
    });

    getOpfsContentsButton.addEventListener("click", async () => {
        resultDiv.textContent = "Fetching OPFS contents via eval() to DOM...";
        resultDiv.className = "";
        console.log(
            "[DevTools Panel] 'Get OPFS Contents' button clicked (DOM Bridge)."
        );

        // The function to be executed in the inspected window's context.
        // It now writes to the DOM and dispatches an event.
        const getOpfsContentsAndBridgeToDOM = async () => {
            const collectedOutput = [];
            console.log(
                "[Inspected Page (Eval)] Starting getOpfsContentsAndBridgeToDOM execution."
            );

            const listDirectoryContents = async (directoryHandle, depth) => {
                depth = depth || 0;
                console.log(
                    `[Inspected Page (Eval)] Listing dir: ${
                        directoryHandle ? directoryHandle.name : "root"
                    } at depth ${depth}`
                );
                if (!directoryHandle) {
                    directoryHandle = await navigator.storage.getDirectory();
                    console.log(
                        "[Inspected Page (Eval)] Got root directory handle."
                    );
                }

                const entries = await directoryHandle.values();
                for await (const entry of entries) {
                    const indentation = "    ".repeat(depth);
                    if (entry.kind === "directory") {
                        collectedOutput.push(`${indentation}📁 ${entry.name}/`);
                        await listDirectoryContents(entry, depth + 1);
                    } else {
                        let size = null;
                        try {
                            const file = await entry.getFile();
                            size = (file.size / 1024).toFixed(2) + " KB";
                        } catch (fileError) {
                            size = "N/A";
                        }
                        collectedOutput.push(
                            `${indentation}📄 ${entry.name} (${size})`
                        );
                    }
                }
            };

            let resultStatus = "success";
            let resultMessage = "Successfully retrieved OPFS contents.";
            try {
                await listDirectoryContents(null, 0);
                console.log(
                    "[Inspected Page (Eval)] OPFS traversal completed successfully."
                );
            } catch (error) {
                console.error(
                    "[Inspected Page (Eval)] Error during OPFS traversal:",
                    error.message,
                    error.name
                );
                collectedOutput.push(
                    `Error: OPFS traversal failed: ${error.message} (${error.name})`
                );
                resultStatus = "error";
                resultMessage = `OPFS access error: ${error.message} (${error.name})`;
            }

            // --- Bridge to DOM and dispatch event ---
            console.log("[Inspected Page (Eval)] Bridging data to DOM.");
            let dataElement = document.getElementById("opfs-debug-data");
            if (!dataElement) {
                dataElement = document.createElement("script");
                dataElement.id = "opfs-debug-data";
                dataElement.type = "application/json"; // Use a non-executable script type
                document.head.appendChild(dataElement); // Or document.body, but head is cleaner for hidden data
            }
            // Serialize the full result object, including status and message
            dataElement.textContent = JSON.stringify({
                status: resultStatus,
                message: resultMessage,
                contents: collectedOutput,
            });
            console.log(
                "[Inspected Page (Eval)] Data written to DOM. Dispatching event."
            );
            // Dispatch a custom event to signal the content script
            window.dispatchEvent(new CustomEvent("OPFSDebugDataReady"));

            // IMPORTANT: With this approach, the eval() function itself doesn't need to return anything
            // to the devtools panel, as the data is transferred via content script.
            // However, eval() still expects *something* for its return promise.
            // Returning a simple boolean or confirmation message is good practice.
            return true; // Indicates eval() completed its task to the DevTools panel
        };

        try {
            // Execute the function. We don't rely on its return for data, just completion.
            const [evalConfirmation, isException] =
                await browser.devtools.inspectedWindow.eval(
                    `(${getOpfsContentsAndBridgeToDOM.toString()})()`
                );

            if (isException) {
                console.error(
                    "[DevTools Panel] Eval returned an exception during bridging:",
                    evalConfirmation
                );
                resultDiv.textContent = `Error: Eval failed to bridge data. Check inspected page console.`;
                resultDiv.className = "error";
            } else {
                console.log(
                    "[DevTools Panel] Eval completed bridging task. Awaiting content script message..."
                );
                resultDiv.textContent =
                    "Eval completed, awaiting data from content script...";
            }
        } catch (evalError) {
            console.error(
                "[DevTools Panel] Error during eval call:",
                evalError
            );
            resultDiv.textContent = `Error initiating eval: ${evalError.message}`;
            resultDiv.className = "error";
        }
    });
});
