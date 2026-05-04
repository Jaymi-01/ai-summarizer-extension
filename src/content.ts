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

    return {
      title: article.title,
      textContent: article.textContent || '',
      excerpt: article.excerpt || '',
      siteName: article.siteName || '',
      length: (article.textContent || '').length
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error during content extraction.'
    };
  }
}

// Immediately execute and return the result for chrome.scripting.executeScript
extractContent();
