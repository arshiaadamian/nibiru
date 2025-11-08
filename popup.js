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
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsModal = document.getElementById("settingsModal");
    const closeSettings = document.getElementById("closeSettings");
    const apiKeyInput = document.getElementById("apiKeyInput");
    const saveApiKeyBtn = document.getElementById("saveApiKey");
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
        }
    }
    
    // Check if extension is ready (has API key and can access page content)
    async function checkStatus(showAnimation = false) {
        try {
            // Check if API key is set
            const result = await chrome.storage.local.get(['apiKey']);
            const hasApiKey = result.apiKey && result.apiKey.trim() !== '';

            if (!hasApiKey) {
                setStatus(false, showAnimation);
                statusText.textContent = "API Key Not Set";
                return;
            }

            // Check if we have an active tab
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab || !tab.id) {
                    setStatus(false, showAnimation);
                    statusText.textContent = "No Active Tab";
                    return;
                }

                // Check if tab URL is valid (not chrome://, chrome-extension://, etc.)
                const url = tab.url || '';
                if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || 
                    url.startsWith('edge://') || url.startsWith('about:') || url === '') {
                    setStatus(false, showAnimation);
                    statusText.textContent = "Invalid Page";
                    return;
                }

                // Try to verify we can access the page content
                // This is a quick check - if we can inject a script, the page is accessible
                try {
                    // Quick content check - try to see if page has content
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            // Quick check if page has meaningful content
                            const body = document.body;
                            if (!body) return false;
                            const text = body.innerText || body.textContent || '';
                            return text.trim().length > 50; // At least 50 characters
                        }
                    }).then((results) => {
                        if (results && results[0] && results[0].result) {
                            // Page has content, extension is ready
                            setStatus(true, showAnimation);
                        } else {
                            setStatus(false, showAnimation);
                            statusText.textContent = "No Content Detected";
                        }
                    }).catch((error) => {
                        // Can't access page (might be restricted), but URL is valid
                        // Still allow summarization attempt - it might work
                        console.log('Content check failed, but allowing attempt:', error);
                        setStatus(true, showAnimation);
                    });
                } catch (error) {
                    // If we can't check content, but URL is valid, allow it
                    console.log('Could not verify content, but URL is valid:', error);
                    setStatus(true, showAnimation);
                }
            } catch (error) {
                console.error('Error checking tab:', error);
                setStatus(false, showAnimation);
                statusText.textContent = "Error Checking Page";
            }
        } catch (error) {
            console.error('Error checking status:', error);
            setStatus(false, showAnimation);
            statusText.textContent = "Error";
        }
    }
    
    // Function to update summary content
    function updateSummary(text, showAnimation = false) {
        const emptyState = summaryArea.querySelector(".empty-state");
        if (emptyState) {
            emptyState.remove();
        }
        
        if (text && text.trim()) {
            // Show planet animation when generating summary (only if requested)
            if (showAnimation) {
                showPlanetAnimation(2500);
                setTimeout(() => {
                    // Convert markdown to HTML (simple conversion)
                    const htmlText = convertMarkdownToHTML(text);
                    summaryArea.innerHTML = `<div class="summary-content">${htmlText}</div>`;
                    checkStatus(true);
                }, 500);
            } else {
                // Convert markdown to HTML
                const htmlText = convertMarkdownToHTML(text);
                summaryArea.innerHTML = `<div class="summary-content">${htmlText}</div>`;
                checkStatus(true);
            }
            
            // Save to storage
            if (chrome && chrome.storage) {
                chrome.storage.local.set({ summary: text });
            }
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
    
    // Simple markdown to HTML converter
    function convertMarkdownToHTML(markdown) {
        let html = markdown;
        
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
        
        // Italic
        html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
        
        // Lists
        html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
        html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
        
        // Wrap consecutive list items in ul/ol
        html = html.replace(/(<li>.*<\/li>\n?)+/gim, (match) => {
            return '<ul>' + match + '</ul>';
        });
        
        // Paragraphs (lines that aren't headers or lists)
        html = html.split('\n').map(line => {
            line = line.trim();
            if (line && !line.startsWith('<') && !line.match(/^#/)) {
                return '<p>' + line + '</p>';
            }
            return line;
        }).join('\n');
        
        // Code blocks (simple)
        html = html.replace(/`(.*?)`/gim, '<code>$1</code>');
        
        return html;
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
    
    // Load saved theme and summary
    if (chrome && chrome.storage) {
        chrome.storage.local.get("theme", (result) => {
            const theme = result.theme || "dark";
            applyTheme(theme);
        });
        
        // Load saved summary if any
        chrome.storage.local.get("summary", async (result) => {
            if (result.summary) {
                updateSummary(result.summary);
            }
            // Check status (API key and tab availability)
            await checkStatus(false);
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
    const loadingBar = document.getElementById("loadingBar");
    let isGenerating = false;
    
    summarizeBtn.addEventListener("click", () => {
        // Prevent spam clicking
        if (isGenerating || summarizeBtn.disabled) {
            return;
        }
        
        // Disable button and set generating state
        isGenerating = true;
        summarizeBtn.disabled = true;
        summarizeBtn.style.cursor = "not-allowed";
        summarizeBtn.style.opacity = "0.6";
        
        // Hide summary area and show loading bar
        if (summaryArea) summaryArea.style.display = "none";
        if (loadingBar) loadingBar.style.display = "flex";
        
        const rocketContainer = loadingBar.querySelector("#rocketContainer");
        const loadingProgress = document.getElementById("loadingProgress");
        const totalDuration = 3000; // 3 seconds
        const startTime = Date.now();
        let progress = 0;
        
        // Reset rocket position
        if (rocketContainer) {
            rocketContainer.style.left = "-10px";
            rocketContainer.style.animation = "none";
            rocketContainer.classList.remove("complete");
        }
        
        // Start actual summarization
        startSummarization();
    });
    
    // Function to start summarization with progress tracking
    async function startSummarization() {
        const loadingBar = document.getElementById("loadingBar");
        const rocketContainer = loadingBar.querySelector("#rocketContainer");
        const loadingProgress = document.getElementById("loadingProgress");
        const startTime = Date.now();
        const totalDuration = 15000; // Estimate 15 seconds for API call
        let progress = 0;
        let animationComplete = false;
        
        // Start progress animation (visual feedback)
        const updateProgress = () => {
            const elapsed = Date.now() - startTime;
            // Animate progress smoothly, but cap at 90% until API call completes
            progress = Math.min((elapsed / totalDuration) * 90, 90);
            
            // Update rocket position based on progress
            if (rocketContainer) {
                const sceneWidth = loadingBar.querySelector(".space-scene").offsetWidth;
                const rocketPosition = (progress / 100) * (sceneWidth + 20) - 10;
                rocketContainer.style.left = `${rocketPosition}px`;
                
                // Trigger planet pulse when rocket is near
                const planets = loadingBar.querySelectorAll(".planet-marker");
                planets.forEach((planet) => {
                    const planetLeft = parseFloat(getComputedStyle(planet).left);
                    const rocketLeft = parseFloat(rocketContainer.style.left) || 0;
                    const distance = Math.abs(rocketLeft - planetLeft);
                    
                    if (distance < 50 && !planet.classList.contains("rocket-nearby")) {
                        planet.classList.add("rocket-nearby");
                        setTimeout(() => {
                            planet.classList.remove("rocket-nearby");
                        }, 600);
                    }
                });
            }
            
            // Update progress text
            if (loadingProgress) {
                loadingProgress.textContent = `${Math.round(progress)}%`;
            }
            
            if (!animationComplete) {
                requestAnimationFrame(updateProgress);
            }
        };
        
        // Start animation
        requestAnimationFrame(updateProgress);
        
        // Call background script to summarize
        try {
            chrome.runtime.sendMessage({ 
                action: 'summarize'
            }, (response) => {
                animationComplete = true;
                
                if (chrome.runtime.lastError) {
                    console.error('Runtime error:', chrome.runtime.lastError);
                    handleSummarizationError(chrome.runtime.lastError.message);
                    return;
                }
                
                if (response && response.success) {
                    // Complete the animation to 100%
                    completeAnimation(100, () => {
                        // Hide loading bar and show summary
                        if (loadingBar) loadingBar.style.display = "none";
                        if (summaryArea) {
                            summaryArea.style.display = "block";
                            updateSummary(response.summary, false);
                        }
                        showToast("Summary generated!");
                        checkStatus();
                        
                        // Re-enable button
                        isGenerating = false;
                        summarizeBtn.disabled = false;
                        summarizeBtn.style.cursor = "pointer";
                        summarizeBtn.style.opacity = "1";
                    });
                } else {
                    handleSummarizationError(response?.error || 'Failed to generate summary');
                }
            });
        } catch (error) {
            animationComplete = true;
            console.error('Summarization error:', error);
            handleSummarizationError(error.message);
        }
    }
    
    // Function to complete animation to 100%
    function completeAnimation(targetProgress, callback) {
        const loadingBar = document.getElementById("loadingBar");
        const rocketContainer = loadingBar.querySelector("#rocketContainer");
        const loadingProgress = document.getElementById("loadingProgress");
        const startTime = Date.now();
        const duration = 500; // 500ms to animate to 100%
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min((elapsed / duration) * (targetProgress - 90) + 90, targetProgress);
            
            if (rocketContainer) {
                const sceneWidth = loadingBar.querySelector(".space-scene").offsetWidth;
                const rocketPosition = (progress / 100) * (sceneWidth + 20) - 10;
                rocketContainer.style.left = `${rocketPosition}px`;
            }
            
            if (loadingProgress) {
                loadingProgress.textContent = `${Math.round(progress)}%`;
            }
            
            if (progress < targetProgress) {
                requestAnimationFrame(animate);
            } else {
                // Trigger completion animation
                if (rocketContainer) {
                    rocketContainer.classList.add("complete");
                }
                
                // Wait for completion animation, then callback
                setTimeout(() => {
                    if (rocketContainer) {
                        rocketContainer.classList.remove("complete");
                        rocketContainer.style.left = "-10px";
                    }
                    if (loadingProgress) {
                        loadingProgress.textContent = "0%";
                    }
                    if (callback) callback();
                }, 1000);
            }
        };
        
        animate();
    }
    
    // Function to handle summarization errors
    function handleSummarizationError(errorMessage) {
        const loadingBar = document.getElementById("loadingBar");
        const summaryArea = document.getElementById("summaryArea");
        
        // Hide loading bar
        if (loadingBar) loadingBar.style.display = "none";
        
        // Format error message with line breaks
        const formattedError = errorMessage.replace(/\n/g, '<br>');
        
        // Determine error type and styling
        let errorIcon = "bi-exclamation-triangle-fill";
        let errorColor = "#ef4444";
        let helpText = "";
        
        if (errorMessage.includes('Quota') || errorMessage.includes('quota')) {
            errorIcon = "bi-hourglass-split";
            errorColor = "#f59e0b";
            helpText = '<p style="font-size: 12px; margin-top: 8px; color: #f59e0b;">💡 Tip: Free tier quotas reset daily. You can also enable billing (free tier remains free) to get higher limits.</p>';
        } else if (errorMessage.includes('API key')) {
            helpText = '<p style="font-size: 12px; margin-top: 8px;">Please set your Gemini API key in the extension settings.</p>';
        } else if (errorMessage.includes('not enabled') || errorMessage.includes('not found')) {
            helpText = '<p style="font-size: 12px; margin-top: 8px;">Make sure the Generative Language API is enabled in Google Cloud Console.</p>';
        }
        
        // Show error in summary area
        if (summaryArea) {
            summaryArea.style.display = "block";
            summaryArea.innerHTML = `
                <div class="empty-state" style="color: ${errorColor};">
                    <i class="bi ${errorIcon}"></i>
                    <p><strong>Error:</strong></p>
                    <p style="text-align: left; white-space: pre-line; font-size: 12px; line-height: 1.6;">${formattedError}</p>
                    ${helpText}
                </div>
            `;
        }
        
        showToast("Failed to generate summary");
        checkStatus();
        
        // Re-enable button
        isGenerating = false;
        summarizeBtn.disabled = false;
        summarizeBtn.style.cursor = "pointer";
        summarizeBtn.style.opacity = "1";
    }
    
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
    
    // Settings modal
    settingsBtn.addEventListener("click", () => {
        settingsModal.style.display = "flex";
        // Check if API key exists
        chrome.storage.local.get(['apiKey'], (result) => {
            if (result.apiKey && result.apiKey.trim()) {
                // Show placeholder indicating key is set
                apiKeyInput.placeholder = "API key is set (enter new key to update)";
                apiKeyInput.value = '';
            } else {
                apiKeyInput.placeholder = "AI...";
                apiKeyInput.value = '';
            }
        });
    });

    closeSettings.addEventListener("click", () => {
        settingsModal.style.display = "none";
    });

    // Close modal when clicking outside
    settingsModal.addEventListener("click", (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = "none";
        }
    });

    // Save API key
    saveApiKeyBtn.addEventListener("click", () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showToast("Please enter an API key");
            return;
        }

        // Basic validation - Gemini API keys typically start with 'AI' or are longer
        if (apiKey.length < 20) {
            showToast("Invalid API key format. Gemini API keys are typically longer.");
            return;
        }

        chrome.storage.local.set({ apiKey: apiKey }, () => {
            showToast("API key saved!");
            settingsModal.style.display = "none";
            // Clear input for security
            apiKeyInput.value = '';
            apiKeyInput.placeholder = "AI...";
            // Check status again
            checkStatus();
        });
    });

    // Initial status check
    checkStatus();
});
