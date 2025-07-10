// background.js
browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "OPFS_DATA_FROM_CONTENT_SCRIPT" && sender.tab) {
        // Relay to DevTools panel, passing the tabId to identify which panel instance
        browser.runtime.sendMessage({
            type: "OPFS_CONTENTS_RESULT_DOM_BRIDGE",
            tabId: sender.tab.id,
            result: message.data,
        });
    }
    // You'd also need a message listener here if the DevTools panel
    // initiates the 'eval' through the background script (less likely with eval)
});
