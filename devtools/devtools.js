// devtools/devtools.js

browser.devtools.panels
    .create("OPFS Viewer Debug", "", "devtools.html")
    .then((panel) => {
        console.log("[DevTools Panel] DevTools panel created.");
    });

document.addEventListener("DOMContentLoaded", () => {
    const getOpfsContentsButton = document.getElementById(
        "getOpfsContentsButton"
    );
    const statusMessage = document.getElementById("statusMessage");
    const resultDiv = document.getElementById("result");

    // Download elements
    const downloadFilePathInput = document.getElementById("downloadFilePath");
    const downloadFileButton = document.getElementById("downloadFileButton");

    // Upload elements
    const uploadFileInput = document.getElementById("uploadFileInput");
    const uploadFilePathInput = document.getElementById("uploadFilePath");
    const uploadFileButton = document.getElementById("uploadFileButton");
    const uploadStatusDiv = document.getElementById("uploadStatus");

    // Delete elements
    const deleteEntryPathInput = document.getElementById("deleteEntryPath");
    const deleteRecursiveCheckbox = document.getElementById(
        "deleteRecursiveCheckbox"
    );
    const deleteEntryButton = document.getElementById("deleteEntryButton");

    console.log("[DevTools Panel] DOMContentLoaded - Initializing listeners.");

    // Function to update main status message
    function updateStatus(message, className = "info") {
        statusMessage.textContent = message;
        statusMessage.className = className;
        console.log(`[DevTools Panel Status] ${message}`);
    }

    // --- Main OPFS Listing Logic (via eval to DOM bridge) ---
    async function refreshOpfsContents() {
        resultDiv.textContent = "Fetching OPFS contents via eval() to DOM...";
        updateStatus("Refreshing OPFS list...");

        // The function to be executed in the inspected window's context.
        const getOpfsContentsAndBridgeToDOM = async () => {
            const collectedOutput = [];
            console.log(
                "[Inspected Page (Eval)] Starting getOpfsContentsAndBridgeToDOM execution."
            );

            const listDirectoryContents = async (directoryHandle, depth) => {
                depth = depth || 0;
                if (!directoryHandle) {
                    directoryHandle = await navigator.storage.getDirectory();
                    console.log(
                        "[Inspected Page (Eval)] Got root directory handle."
                    );
                }

                try {
                    const entries = await directoryHandle.values();
                    for await (const entry of entries) {
                        const indentation = "    ".repeat(depth);
                        if (entry.kind === "directory") {
                            collectedOutput.push(
                                `${indentation}📁 ${entry.name}/`
                            );
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
                } catch (error) {
                    console.error(
                        "[Inspected Page (Eval)] Error during directory iteration:",
                        error.message,
                        error.name
                    );
                    collectedOutput.push(
                        `Error: OPFS listing failed at ${
                            directoryHandle.name || "root"
                        }: ${error.message} (${error.name})`
                    );
                    throw error; // Re-throw to propagate to outer catch
                }
            };

            let resultStatus = "success";
            let resultMessage = "Successfully retrieved OPFS contents.";
            try {
                await listDirectoryContents(null, 0);
            } catch (error) {
                resultStatus = "error";
                resultMessage = `OPFS access/listing failed: ${error.message}`;
            }

            // Bridge data to DOM
            let dataElement = document.getElementById("opfs-debug-data");
            if (!dataElement) {
                dataElement = document.createElement("script");
                dataElement.id = "opfs-debug-data";
                dataElement.type = "application/json";
                document.head.appendChild(dataElement);
            }
            dataElement.textContent = JSON.stringify({
                status: resultStatus,
                message: resultMessage,
                contents: collectedOutput, // Array of strings for display
            });
            window.dispatchEvent(new CustomEvent("OPFSDebugDataReady"));
            return true; // Indicate completion
        };

        try {
            const [evalConfirmation, isException] =
                await browser.devtools.inspectedWindow.eval(
                    `(${getOpfsContentsAndBridgeToDOM.toString()})()`
                    // { useContentScriptContext: false }
                );
            if (isException) {
                updateStatus(
                    "Error: Eval failed to bridge data for listing. Check page console.",
                    "error"
                );
            } else {
                updateStatus(
                    "Eval initiated for listing. Awaiting content script response...",
                    "info"
                );
            }
        } catch (evalError) {
            updateStatus(
                `Error initiating eval for listing: ${evalError.message}`,
                "error"
            );
        }
    }

    // --- File Download Logic ---
    downloadFileButton.addEventListener("click", async () => {
        const filePath = downloadFilePathInput.value.trim();
        if (!filePath) {
            updateStatus("Please enter a file path to download.", "error");
            return;
        }
        updateStatus(`Attempting to download '${filePath}'...`, "info");

        const downloadFileFromPage = async (path) => {
            console.log(
                `[Inspected Page (Eval)] Attempting to read file for download: ${path}`
            );
            try {
                const parts = path.split("/");
                let currentHandle = await navigator.storage.getDirectory();
                let fileHandle;

                for (let i = 0; i < parts.length; i++) {
                    if (i === parts.length - 1) {
                        // Last part is the file name
                        fileHandle = await currentHandle.getFileHandle(
                            parts[i]
                        );
                    } else {
                        // Intermediate parts are directories
                        currentHandle = await currentHandle.getDirectoryHandle(
                            parts[i]
                        );
                    }
                }

                if (!fileHandle)
                    throw new Error("File handle not found after traversal.");

                const file = await fileHandle.getFile();
                // Read file as ArrayBuffer and convert to Base64
                const arrayBuffer = await file.arrayBuffer();
                const base64Content = btoa(
                    String.fromCharCode(...new Uint8Array(arrayBuffer))
                );

                // Bridge download data to DOM
                let downloadElement = document.getElementById(
                    "opfs-debug-download-data"
                );
                if (!downloadElement) {
                    downloadElement = document.createElement("script");
                    downloadElement.id = "opfs-debug-download-data";
                    downloadElement.type = "application/json";
                    document.head.appendChild(downloadElement);
                }
                downloadElement.textContent = JSON.stringify({
                    fileName: file.name,
                    fileContentBase64: base64Content,
                });
                window.dispatchEvent(new CustomEvent("OPFSDebugDownloadReady"));
                return {
                    status: "success",
                    message: "File data sent to content script for download.",
                };
            } catch (error) {
                console.error(
                    `[Inspected Page (Eval)] Error reading file for download ${path}:`,
                    error
                );
                return {
                    status: "error",
                    message: `Failed to read file for download: ${error.message}`,
                };
            }
        };

        try {
            const [evalResult, isException] =
                await browser.devtools.inspectedWindow.eval(
                    `(${downloadFileFromPage.toString()})('${filePath}')`
                    // { useContentScriptContext: false }
                );
            if (isException || evalResult.status === "error") {
                updateStatus(
                    `Download eval failed: ${
                        isException
                            ? "Exception in page. See page console."
                            : evalResult.message
                    }`,
                    "error"
                );
            } else {
                updateStatus(evalResult.message, "info"); // Eval succeeded, content script will pick up
            }
        } catch (evalError) {
            updateStatus(
                `Error initiating download eval: ${evalError.message}`,
                "error"
            );
        }
    });

    // --- File Upload Logic ---
    uploadFileInput.addEventListener("change", () => {
        if (uploadFileInput.files.length > 0) {
            uploadFileButton.disabled = false;
            uploadStatusDiv.textContent = `File selected: ${uploadFileInput.files[0].name}`;
            uploadStatusDiv.className = "info";
        } else {
            uploadFileButton.disabled = true;
            uploadStatusDiv.textContent = "Select a file.";
            uploadStatusDiv.className = "info";
        }
    });

    uploadFileButton.addEventListener("click", async () => {
        const file = uploadFileInput.files[0];
        const uploadPath = uploadFilePathInput.value.trim();

        if (!file) {
            updateStatus("No file selected for upload.", "error");
            return;
        }
        if (!uploadPath) {
            updateStatus(
                "Please enter a destination path for upload.",
                "error"
            );
            return;
        }

        updateStatus(
            `Reading '${file.name}' for upload to '${uploadPath}'...`,
            "info"
        );

        // Read file content as ArrayBuffer
        const reader = new FileReader();
        reader.onload = async (e) => {
            const fileContentArrayBuffer = e.target.result;
            // Convert ArrayBuffer to Base64 for transfer via eval()
            const base64Content = btoa(
                String.fromCharCode(...new Uint8Array(fileContentArrayBuffer))
            );

            updateStatus(
                `Uploading '${file.name}' to '${uploadPath}'...`,
                "info"
            );

            const uploadFileToPage = async (path, contentBase64) => {
                console.log(
                    `[Inspected Page (Eval)] Attempting to upload to: ${path}`
                );
                try {
                    const parts = path.split("/");
                    let currentHandle = await navigator.storage.getDirectory();
                    let fileName = parts[parts.length - 1];
                    let directoryPath = parts.slice(0, -1);

                    // Create intermediate directories if they don't exist
                    for (const part of directoryPath) {
                        currentHandle = await currentHandle.getDirectoryHandle(
                            part,
                            { create: true }
                        );
                    }

                    const fileHandle = await currentHandle.getFileHandle(
                        fileName,
                        { create: true }
                    );
                    const writable = await fileHandle.createWritable();

                    // Decode Base64 back to Blob
                    const byteCharacters = atob(contentBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray]);

                    await writable.write(blob);
                    await writable.close();

                    return {
                        status: "success",
                        message: `File uploaded: ${path}`,
                    };
                } catch (error) {
                    console.error(
                        `[Inspected Page (Eval)] Error during upload to ${path}:`,
                        error
                    );
                    return {
                        status: "error",
                        message: `Failed to upload: ${error.message}`,
                    };
                }
            };

            try {
                const [evalResult, isException] =
                    await browser.devtools.inspectedWindow.eval(
                        `(${uploadFileToPage.toString()})('${uploadPath}', '${base64Content}')`
                        // { useContentScriptContext: false }
                    );

                if (isException || evalResult.status === "error") {
                    updateStatus(
                        `Upload failed: ${
                            isException
                                ? "Exception in page. See page console."
                                : evalResult.message
                        }`,
                        "error"
                    );
                } else {
                    updateStatus(evalResult.message, "success");
                    refreshOpfsContents(); // Refresh list after successful upload
                }
            } catch (evalError) {
                updateStatus(
                    `Error initiating upload eval: ${evalError.message}`,
                    "error"
                );
            }
        };
        reader.onerror = (e) => {
            updateStatus(
                `Error reading file for upload: ${reader.error}`,
                "error"
            );
        };
        reader.readAsArrayBuffer(file); // Read the file as ArrayBuffer
    });

    // --- Delete Entry Logic ---
    deleteEntryButton.addEventListener("click", async () => {
        const entryPath = deleteEntryPathInput.value.trim();
        const recursive = deleteRecursiveCheckbox.checked;

        if (!entryPath) {
            updateStatus("Please enter an entry path to delete.", "error");
            return;
        }

        updateStatus(
            `Attempting to delete '${entryPath}' (recursive: ${recursive})...`,
            "info"
        );

        const deleteEntryFromPage = async (path, recursiveOption) => {
            console.log(
                `[Inspected Page (Eval)] Attempting to delete: ${path} (recursive: ${recursiveOption})`
            );
            try {
                const parts = path.split("/");
                let currentHandle = await navigator.storage.getDirectory();
                let parentHandle;
                let entryName;

                if (parts.length === 1) {
                    // Deleting from root
                    parentHandle = currentHandle;
                    entryName = parts[0];
                } else {
                    // Deleting from a subdirectory
                    for (let i = 0; i < parts.length - 1; i++) {
                        currentHandle = await currentHandle.getDirectoryHandle(
                            parts[i]
                        );
                    }
                    parentHandle = currentHandle;
                    entryName = parts[parts.length - 1];
                }

                await parentHandle.removeEntry(entryName, {
                    recursive: recursiveOption,
                });
                return {
                    status: "success",
                    message: `Successfully deleted: ${path}`,
                };
            } catch (error) {
                console.error(
                    `[Inspected Page (Eval)] Error deleting ${path}:`,
                    error
                );
                return {
                    status: "error",
                    message: `Failed to delete: ${error.message}`,
                };
            }
        };

        try {
            const [evalResult, isException] =
                await browser.devtools.inspectedWindow.eval(
                    `(${deleteEntryFromPage.toString()})('${entryPath}', ${recursive})`
                    // { useContentScriptContext: false }
                );

            if (isException || evalResult.status === "error") {
                updateStatus(
                    `Delete failed: ${
                        isException
                            ? "Exception in page. See page console."
                            : evalResult.message
                    }`,
                    "error"
                );
            } else {
                updateStatus(evalResult.message, "success");
                refreshOpfsContents(); // Refresh list after successful delete
            }
        } catch (evalError) {
            updateStatus(
                `Error initiating delete eval: ${evalError.message}`,
                "error"
            );
        }
    });

    // --- Listen for operation status from background script (for download feedback) ---
    browser.runtime.onMessage.addListener((message) => {
        if (
            message.type === "OPFS_OPERATION_STATUS" &&
            message.tabId === browser.devtools.inspectedWindow.tabId
        ) {
            updateStatus(message.result.message, message.result.status);
            if (
                message.result.status === "success" &&
                message.result.message.includes("download initiated")
            ) {
                // No need to refresh list for download
            } else {
                refreshOpfsContents(); // Always refresh list after other operations for immediate feedback
            }
        }
        // Also listen for the initial list data coming through the DOM bridge
        if (
            message.type === "OPFS_CONTENTS_RESULT_DOM_BRIDGE" &&
            message.tabId === browser.devtools.inspectedWindow.tabId
        ) {
            const result = message.result;
            if (result.status === "success") {
                if (result.contents && result.contents.length > 0) {
                    resultDiv.textContent =
                        "OPFS Contents:\n" + result.contents.join("\n");
                } else {
                    resultDiv.textContent = "OPFS is empty for this origin.";
                }
                resultDiv.className = "success";
                updateStatus("OPFS list refreshed.", "success");
            } else {
                resultDiv.textContent = `Error from inspected page: ${result.message}`;
                resultDiv.className = "error";
                updateStatus(
                    `Error refreshing list: ${result.message}`,
                    "error"
                );
            }
        }
    });

    // Initial refresh on panel load
    refreshOpfsContents();
});
