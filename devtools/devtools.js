// devtools/devtools.js

// Initialize the DevTools panel once the panel is ready
browser.devtools.panels
    .create(
        "OPFS Test", // Title for the panel
        "", // Path to an icon (empty for now)
        "devtools.html" // Path to the panel's HTML file
    )
    .then((panel) => {
        // This code runs when the panel is created (it might not be visible yet)
        console.log("DevTools panel created.");

        panel.onShown.addListener(() => {
            console.log("OPFS Test panel shown.");
            // We can do something here if the panel becomes visible
        });

        panel.onHidden.addListener(() => {
            console.log("OPFS Test panel hidden.");
        });
    });

// Get the actual elements *after* the HTML is loaded in the panel.
// Listen for the DOMContentLoaded event if you are not sure when your script runs.
document.addEventListener("DOMContentLoaded", () => {
    const testButton = document.getElementById("testOpfsButton");
    const resultDiv = document.getElementById("result");

    testButton.addEventListener("click", () => {
        resultDiv.textContent = "Testing...";
        resultDiv.className = ""; // Clear previous status
        // Send message to background script to initiate the test
        browser.runtime.sendMessage({
            type: "TEST_OPFS_ACCESS",
            tabId: browser.devtools.inspectedWindow.tabId, // Get the ID of the currently inspected tab
        });
    });

    // Listen for the result from the background script
    browser.runtime.onMessage.addListener((message) => {
        if (
            message.type === "OPFS_ACCESS_RESULT" &&
            message.tabId === browser.devtools.inspectedWindow.tabId
        ) {
            const result = message.result;
            if (result.status === "success") {
                resultDiv.textContent = result.message;
                resultDiv.className = "success";
                console.log("OPFS Test Success:", result.message);
            } else {
                resultDiv.textContent = `Error: ${result.message}`;
                resultDiv.className = "error";
                console.error("OPFS Test Error:", result.message);
            }
        }
    });
});
