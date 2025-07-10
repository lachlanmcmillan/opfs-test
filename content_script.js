// content_script.js
console.log("[Content Script] OPFS DOM Bridge content script loaded.");

// Listener for custom events dispatched by the page's code (from eval)
window.addEventListener(
    "OPFSDebugDataReady",
    (event) => {
        console.log(
            "[Content Script] Received OPFSDebugDataReady event from page."
        );
        try {
            const dataElement = document.getElementById("opfs-debug-data");
            if (dataElement) {
                const rawData = dataElement.textContent;
                const opfsData = JSON.parse(rawData);
                console.log(
                    "[Content Script] Parsed OPFS data from DOM element."
                );

                // Send data to background script
                browser.runtime.sendMessage({
                    type: "OPFS_DATA_FROM_CONTENT_SCRIPT",
                    data: opfsData,
                });

                // Clean up the temporary element (optional, but good practice)
                dataElement.remove();
            } else {
                console.error(
                    "[Content Script] OPFS debug data element not found!"
                );
            }
        } catch (e) {
            console.error(
                "[Content Script] Error processing OPFS data from DOM:",
                e
            );
        }
    },
    false
); // Use capture phase if element might be removed quickly
