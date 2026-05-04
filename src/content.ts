import { Readability } from '@mozilla/readability';

function extractContent() {
  try {
    // Clone the document so that Readability doesn't modify the live DOM
    const docClone = document.cloneNode(true) as Document;
    const reader = new Readability(docClone);
    const article = reader.parse();

    if (!article) {
      return {
        error: 'Could not parse article content.'
      };
    }

    const result = {
      title: article.title,
      textContent: article.textContent || '',
      excerpt: article.excerpt || '',
      siteName: article.siteName || '',
      length: (article.textContent || '').length
    };

    // Send the result back to the popup/background
    chrome.runtime.sendMessage({
      type: 'CONTENT_EXTRACTED',
      payload: result
    });

    return result;
  } catch (error) {
    const errorResult = {
      error: error instanceof Error ? error.message : 'Unknown error during content extraction.'
    };
    
    chrome.runtime.sendMessage({
      type: 'CONTENT_EXTRACTED',
      payload: errorResult
    });

    return errorResult;
  }
}

// Execute
extractContent();
