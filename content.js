// Content script to extract page content
// Runs in the context of web pages to extract text content
// Optimized for BCIT Learning Hub (D2L/Brightspace)

(function() {
    'use strict';

    // Extract readable text content from the page
    function extractPageContent() {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation');
        scripts.forEach(el => el.style.display = 'none');

        // BCIT Learning Hub specific selectors (prioritized)
        const mainContentSelectors = [
            // Learning Hub specific (D2L/Brightspace)
            '.d2l-fileviewer',                    // Document viewer container
            '.d2l-fileviewer-content',            // Document viewer content
            '[data-testid="content-viewer"]',     // Content viewer
            '.d2l-htmlblock',                     // HTML content block
            '.d2l-htmleditor-container',          // HTML editor container
            '.d2l-widget-content',                // Widget content
            '#d2l_content',                      // Main content area
            '.d2l-page-main',                     // Main page area
            '.d2l-content',                       // General content
            '.d2l-read',                         // Read content area
            '.d2l-article',                      // Article content
            // Standard selectors
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

        // Try to extract from iframe if present (for embedded documents)
        let iframeContent = '';
        try {
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    // Only access if same-origin or if we can access it
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) {
                        const iframeBody = iframeDoc.body;
                        if (iframeBody) {
                            const iframeText = iframeBody.innerText || iframeBody.textContent || '';
                            if (iframeText.trim().length > 100) { // Only use if substantial content
                                iframeContent += '\n\n[Embedded Document Content]\n' + iframeText.trim();
                            }
                        }
                    }
                } catch (e) {
                    // Cross-origin iframe, can't access - skip
                    console.log('Cannot access iframe content (cross-origin):', e);
                }
            }
        } catch (e) {
            console.log('Error accessing iframes:', e);
        }

        // Try to extract from PDF.js viewer (common for PDFs)
        let pdfContent = '';
        try {
            // PDF.js viewer text layer
            const pdfTextLayer = document.querySelector('.textLayer, .pdfViewer, #viewer');
            if (pdfTextLayer) {
                const pdfText = pdfTextLayer.innerText || pdfTextLayer.textContent || '';
                if (pdfText.trim().length > 100) {
                    pdfContent = '\n\n[PDF Content]\n' + pdfText.trim();
                }
            }
            
            // Try to find text spans in PDF viewer
            const pdfTextSpans = document.querySelectorAll('.textLayer span, .page .textLayer span, .textLayer div');
            if (pdfTextSpans.length > 0) {
                let pdfText = '';
                pdfTextSpans.forEach(span => {
                    const spanText = span.textContent || '';
                    if (spanText.trim()) {
                        pdfText += spanText + ' ';
                    }
                });
                if (pdfText.trim().length > 100) {
                    pdfContent = '\n\n[PDF Content]\n' + pdfText.trim();
                }
            }
        } catch (e) {
            console.log('Error extracting PDF content:', e);
        }

        const contentElement = mainContent || document.body;
        let textContent = contentElement.innerText || contentElement.textContent || '';
        
        // Add iframe and PDF content if found
        if (iframeContent) {
            textContent += iframeContent;
        }
        if (pdfContent) {
            textContent += pdfContent;
        }
        
        const title = document.title || '';
        const url = window.location.href || '';

        // Extract context (breadcrumbs, sidebar, etc.) - Learning Hub specific
        const contextSelectors = [
            // Learning Hub breadcrumbs
            '.d2l-navigation-s-item',            // Navigation items
            '.d2l-breadcrumbs',                  // Breadcrumbs
            '.d2l-navigation-s-link',            // Navigation links
            '.d2l-page-header',                   // Page header
            '.d2l-navigation-s-title',           // Course title
            // Standard selectors
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
                const contextText = contextEl.innerText || contextEl.textContent || '';
                if (contextText.trim()) {
                    context = contextText.trim();
                    break;
                }
            }
        }

        // Also get course title from Learning Hub
        try {
            const courseTitle = document.querySelector('.d2l-navigation-s-title, .d2l-page-header-title, .d2l-navigation-s-link');
            if (courseTitle) {
                const courseText = courseTitle.innerText || courseTitle.textContent || '';
                if (courseText && courseText.trim()) {
                    context = (context ? context + ' > ' : '') + courseText.trim();
                }
            }
        } catch (e) {
            console.log('Error extracting course title:', e);
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

    // Listen for messages from popup/background
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

    // Also expose the function globally for direct calls
    if (typeof window !== 'undefined') {
        window.extractPageContent = extractPageContent;
    }
})();

