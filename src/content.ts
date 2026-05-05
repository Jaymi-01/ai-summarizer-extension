import { Readability } from '@mozilla/readability';

function extractContent() {
  const startTime = performance.now();
  try {
    // Optimization: Don't clone the WHOLE document. 
    // Just clone the body content into a new minimal document.
    const doc = document.implementation.createHTMLDocument(document.title);
    doc.body.innerHTML = document.body.innerHTML;

    // Fast Cleanup: Remove heavy elements that Readability doesn't need
    const heavyTags = doc.querySelectorAll('script, style, iframe, canvas, svg, noscript, header, footer, nav, ads');
    for (let i = 0; i < heavyTags.length; i++) {
      heavyTags[i].remove();
    }

    const reader = new Readability(doc);
    const article = reader.parse();

    const result = article ? {
      title: article.title || document.title,
      textContent: article.textContent || '',
      excerpt: article.excerpt || '',
      siteName: article.siteName || '',
      length: (article.textContent || '').length
    } : {
      // Fallback to basic text if Readability fails
      title: document.title,
      textContent: document.body.innerText.substring(0, 10000),
      excerpt: '',
      siteName: '',
      length: Math.min(document.body.innerText.length, 10000),
      warning: 'Used basic extraction fallback.'
    };

    console.log(`[Summaize] Extraction took ${(performance.now() - startTime).toFixed(2)}ms`);
    
    chrome.runtime.sendMessage({ type: 'CONTENT_EXTRACTED', payload: result });
    return result;
  } catch (error) {
    console.error('[Summaize] Critical extraction error:', error);
    const err = { error: 'Extraction failed.' };
    chrome.runtime.sendMessage({ type: 'CONTENT_EXTRACTED', payload: err });
    return err;
  }
}

extractContent();
