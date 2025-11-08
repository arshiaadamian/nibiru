document.addEventListener("DOMContentLoaded", () => {
    const summaryArea = document.getElementById("summaryArea");
    const themeToggle = document.getElementById("themeToggle");
    const toast = document.getElementById("toast");
    
    function applyTheme(theme) {
        console.log("Applying theme:", theme);
        
        document.body.classList.remove("light", "dark");
        
        if (theme === "light") {
            document.body.classList.add("light");
            themeToggle.textContent = "🌞";
        } else {
            document.body.classList.add("dark");
            themeToggle.textContent = "🌙";
        }
        
        document.body.offsetHeight;
    }
    
    if (chrome && chrome.storage) {
        chrome.storage.local.get("theme", (result) => {
            const theme = result.theme || "dark";
            console.log("Loaded theme from storage:", theme);
            applyTheme(theme);
        });
    } else {
        applyTheme("dark");
    }
    
    themeToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log("Theme toggle clicked");
        const isLight = document.body.classList.contains("light");
        const newTheme = isLight ? "dark" : "light";
        
        console.log("Current is light:", isLight, "Switching to:", newTheme);
        applyTheme(newTheme);
        
        if (chrome && chrome.storage) {
            chrome.storage.local.set({ theme: newTheme }, () => {
                console.log("Theme saved:", newTheme);
            });
        }
    });
    
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
    }
    
    document.getElementById("copyBtn").addEventListener("click", () => {
        const placeholder = summaryArea.querySelector(".placeholder");
        const textToCopy = summaryArea.textContent.trim();
        
        if (placeholder || textToCopy === "Click a document or link to generate a summary.") {
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
});
