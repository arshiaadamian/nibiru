// Content script to extract page content
// Runs in the context of web pages to extract text content

(function() {
    'use strict';

    // Extract readable text content from the page
    function extractPageContent() {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation');
        scripts.forEach(el => el.style.display = 'none');

        // Try to find main content area (common selectors for learning management systems)
        const mainContentSelectors = [
            'main',
            '[role="main"]',
            '.main-content',
            '.content',
            '#content',
            '.page-content',
            '.article',
            '.post',
            '.entry-content',
            '.body-content',
            'article',
            '.assignment-content',
            '.course-content',
            '.learning-hub-content'
        ];

        let mainContent = null;
        for (const selector of mainContentSelectors) {
            mainContent = document.querySelector(selector);
            if (mainContent) break;
        }

        // Fallback to body if no main content found
        const contentElement = mainContent || document.body;

        // Extract text content
        const textContent = contentElement.innerText || contentElement.textContent || '';

        // Get page title
        const title = document.title || '';

        // Get page URL
        const url = window.location.href || '';

        // Extract context (breadcrumbs, sidebar, etc.)
        const contextSelectors = [
            '.breadcrumbs',
            '.breadcrumb',
            '.navigation-path',
            '.page-path',
            '[aria-label*="breadcrumb" i]',
            'nav[aria-label*="navigation" i]'
        ];

        let context = '';
        for (const selector of contextSelectors) {
            const contextEl = document.querySelector(selector);
            if (contextEl) {
                context = contextEl.innerText || contextEl.textContent || '';
                break;
            }
        }

        // Get HTML content for better context
        const htmlContent = contentElement.innerHTML || '';

        // Restore hidden elements
        scripts.forEach(el => el.style.display = '');

        return {
            text: textContent.trim(),
            html: htmlContent,
            title: title.trim(),
            url: url,
            context: context.trim()
        };
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extractContent') {
            try {
                const content = extractPageContent();
                sendResponse({ success: true, content: content });
            } catch (error) {
                console.error('Error extracting content:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true; // Keep message channel open for async response
        }
    });
})();

