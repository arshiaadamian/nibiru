document.addEventListener("DOMContentLoaded", () => {
    const summaryArea = document.getElementById("summaryArea");
    const themeToggle = document.getElementById("themeToggle");
    const toast = document.getElementById("toast");
    const statusIndicator = document.getElementById("statusIndicator");
    const statusText = statusIndicator.querySelector(".status-text");
    const statusIcon = statusIndicator.querySelector(".status-icon i");
    const planetOverlay = document.getElementById("planetOverlay");
    const summarizeBtnContainer = document.getElementById("summarizeBtnContainer");
    const summarizeBtn = document.getElementById("summarizeBtn");
    const readyToggle = document.getElementById("readyToggle");
    let isInitialLoad = true;
    
    // Planet animation control
    function showPlanetAnimation(duration = 2000) {
        planetOverlay.classList.add("active");
        setTimeout(() => {
            planetOverlay.classList.remove("active");
        }, duration);
    }
    
    // Status management
    function setStatus(ready, showAnimation = false) {
        if (ready) {
            statusIndicator.classList.add("ready");
            statusIndicator.classList.remove("not-ready");
            statusText.textContent = "Ready to Summarize";
            statusIcon.className = "bi bi-check-circle-fill";
            // Show summarize button when ready
            summarizeBtnContainer.style.display = "flex";
            readyToggle.checked = true;
            // Show planet animation when status becomes ready (but not on initial load)
            if (showAnimation && !isInitialLoad) {
                showPlanetAnimation(2000);
            }
        } else {
            statusIndicator.classList.add("not-ready");
            statusIndicator.classList.remove("ready");
            statusText.textContent = "Not Ready";
            statusIcon.className = "bi bi-x-circle-fill";
            // Hide summarize button when not ready
            summarizeBtnContainer.style.display = "none";
            readyToggle.checked = false;
        }
    }
    
    // Initialize status (you can change this based on your logic)
    // For now, checking if there's content to summarize
    function checkStatus(showAnimation = false) {
        const placeholder = summaryArea.querySelector(".empty-state");
        const hasContent = !placeholder && summaryArea.textContent.trim() !== "" && 
                          summaryArea.textContent.trim() !== "No summary available yet. Navigate to a document or webpage to generate a summary.";
        setStatus(hasContent, showAnimation);
    }
    
    // Function to update summary content
    function updateSummary(text) {
        const emptyState = summaryArea.querySelector(".empty-state");
        if (emptyState) {
            emptyState.remove();
        }
        
        if (text && text.trim()) {
            // Show planet animation when generating summary
            showPlanetAnimation(2500);
            // Delay the content update slightly to show animation
            setTimeout(() => {
                summaryArea.innerHTML = `<p>${text}</p>`;
                checkStatus(true);
            }, 500);
        } else {
            summaryArea.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-file-text-empty"></i>
                    <p>No summary available yet. Navigate to a document or webpage to generate a summary.</p>
                </div>
            `;
            checkStatus(false);
        }
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
                checkStatus(false);
            }
            isInitialLoad = false;
        });
    } else {
        applyTheme("dark");
        checkStatus(false);
        isInitialLoad = false;
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
        
        showPlanetAnimation(1500);
        navigator.clipboard.writeText(textToCopy).then(() => {
            setTimeout(() => {
                showToast("Summary copied!");
            }, 1500);
        }).catch(() => {
            showToast("Failed to copy");
        });
    });
    
    document.getElementById("downloadBtn").addEventListener("click", () => {
        showPlanetAnimation(1500);
        setTimeout(() => {
            showToast("PDF download coming soon!");
        }, 1500);
    });
    
    document.getElementById("notionBtn").addEventListener("click", () => {
        showPlanetAnimation(1500);
        setTimeout(() => {
            showToast("Notion export coming soon!");
        }, 1500);
    });
    
    // Summarize button
    summarizeBtn.addEventListener("click", () => {
        showPlanetAnimation(3000);
        showToast("Generating summary...");
        
        // Simulate summary generation (replace with actual API call)
        setTimeout(() => {
            const sampleSummary = "This is a sample summary generated by Nibiru. The extension is working correctly and ready to summarize BCIT course materials, documents, and web pages. The ancient planet animation represents the mystical power of Nibiru, bringing knowledge from the cosmos to BCIT students.";
            updateSummary(sampleSummary);
            showToast("Summary generated!");
        }, 3000);
    });
    
    // Test toggle for ready status
    readyToggle.addEventListener("change", (e) => {
        const isReady = e.target.checked;
        setStatus(isReady, true);
    });
    
    // Listen for messages from content script or background
    if (chrome && chrome.runtime) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "updateSummary") {
                updateSummary(request.summary);
                if (chrome.storage) {
                    chrome.storage.local.set({ summary: request.summary });
                }
            } else if (request.action === "showPlanet") {
                showPlanetAnimation(request.duration || 2000);
            }
        });
    }
    
    // Initial status check
    checkStatus();
});
