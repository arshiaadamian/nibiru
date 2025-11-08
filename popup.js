document.addEventListener("DOMContentLoaded", () => {
    const summaryArea = document.getElementById("summaryArea");
    const themeToggle = document.getElementById("themeToggle");
    const toast = document.getElementById("toast");
    const statusIndicator = document.getElementById("statusIndicator");
    const statusText = statusIndicator.querySelector(".status-text");
    const statusIcon = statusIndicator.querySelector(".status-icon i");
    
    // Status management
    function setStatus(ready) {
        if (ready) {
            statusIndicator.classList.add("ready");
            statusIndicator.classList.remove("not-ready");
            statusText.textContent = "Ready to Summarize";
            statusIcon.className = "bi bi-check-circle-fill";
        } else {
            statusIndicator.classList.add("not-ready");
            statusIndicator.classList.remove("ready");
            statusText.textContent = "Not Ready";
            statusIcon.className = "bi bi-x-circle-fill";
        }
    }
    
    // Initialize status (you can change this based on your logic)
    // For now, checking if there's content to summarize
    function checkStatus() {
        const placeholder = summaryArea.querySelector(".empty-state");
        const hasContent = !placeholder && summaryArea.textContent.trim() !== "" && 
                          summaryArea.textContent.trim() !== "No summary available yet. Navigate to a document or webpage to generate a summary.";
        setStatus(hasContent);
    }
    
    // Function to update summary content
    function updateSummary(text) {
        const emptyState = summaryArea.querySelector(".empty-state");
        if (emptyState) {
            emptyState.remove();
        }
        
        if (text && text.trim()) {
            summaryArea.innerHTML = `<p>${text}</p>`;
        } else {
            summaryArea.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-file-text-empty"></i>
                    <p>No summary available yet. Navigate to a document or webpage to generate a summary.</p>
                </div>
            `;
        }
        checkStatus();
    }
    
    // Theme management
    function applyTheme(theme) {
        document.body.classList.remove("light", "dark");
        
        if (theme === "light") {
            document.body.classList.add("light");
            themeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
        } else {
            document.body.classList.add("dark");
            themeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
        }
    }
    
    // Load saved theme
    if (chrome && chrome.storage) {
        chrome.storage.local.get("theme", (result) => {
            const theme = result.theme || "dark";
            applyTheme(theme);
        });
        
        // Load saved summary if any
        chrome.storage.local.get("summary", (result) => {
            if (result.summary) {
                updateSummary(result.summary);
            } else {
                checkStatus();
            }
        });
    } else {
        applyTheme("dark");
        checkStatus();
    }
    
    // Theme toggle
    themeToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isLight = document.body.classList.contains("light");
        const newTheme = isLight ? "dark" : "light";
        
        applyTheme(newTheme);
        
        if (chrome && chrome.storage) {
            chrome.storage.local.set({ theme: newTheme });
        }
    });
    
    // Toast notifications
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
    }
    
    // Action buttons
    document.getElementById("copyBtn").addEventListener("click", () => {
        const emptyState = summaryArea.querySelector(".empty-state");
        const textToCopy = summaryArea.textContent.trim();
        
        if (emptyState || !textToCopy || textToCopy.includes("No summary available")) {
            showToast("No summary to copy yet");
            return;
        }
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast("Summary copied!");
        }).catch(() => {
            showToast("Failed to copy");
        });
    });
    
    document.getElementById("downloadBtn").addEventListener("click", () => {
        showToast("PDF download coming soon!");
    });
    
    document.getElementById("notionBtn").addEventListener("click", () => {
        showToast("Notion export coming soon!");
    });
    
    // Listen for messages from content script or background
    if (chrome && chrome.runtime) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "updateSummary") {
                updateSummary(request.summary);
                if (chrome.storage) {
                    chrome.storage.local.set({ summary: request.summary });
                }
            }
        });
    }
    
    // Initial status check
    checkStatus();
});
