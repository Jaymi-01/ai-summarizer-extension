interface SummaryData {
  bulletPoints: string[];
  keyInsights: string[];
  readingTime: string;
}

interface SummarizeRequest {
  type: 'SUMMARIZE_PAGE';
  payload: {
    title: string;
    text: string;
    url: string;
  };
}

interface SummaryResponse extends Partial<SummaryData> {
  error?: string;
  cause?: string;
}

chrome.runtime.onMessage.addListener((message: SummarizeRequest, _sender: chrome.runtime.MessageSender, sendResponse: (response: SummaryResponse) => void) => {
  if (message.type === 'SUMMARIZE_PAGE') {
    handleSummarization(message.payload)
      .then(sendResponse)
      .catch((error: Error) => {
        const errorData: SummaryResponse = { error: error.message };
        
        // Extract a detailed cause string by traversing the cause chain
        let currentCause: unknown = error.cause;
        const causeChain: string[] = [];
        
        while (currentCause) {
          if (currentCause instanceof Error) {
            causeChain.push(currentCause.message);
            currentCause = currentCause.cause;
          } else {
            causeChain.push(String(currentCause));
            break;
          }
        }
        
        if (causeChain.length > 0) {
          errorData.cause = causeChain.join(' → ');
        }
        
        sendResponse(errorData);
      });
    return true; // Keep message channel open for async response
  }
});

async function handleSummarization(payload: { title: string; text: string; url: string }): Promise<SummaryData> {
  const { title, text, url } = payload;

  // 1. Check Cache
  const cacheKey = `summary_${url}`;
  try {
    const result = await chrome.storage.local.get([cacheKey]);
    if (result && result[cacheKey]) {
      return result[cacheKey] as SummaryData;
    }
  } catch (error: unknown) {
    console.warn('Cache Retrieval Error:', error);
  }

  // 2. Call Vercel Backend
  // IMPORTANT: Replace this URL with your actual Vercel deployment URL
  const BACKEND_URL = 'https://your-vercel-project.vercel.app/api/summarize';

  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend Error: ${response.status}`, { cause: errorText });
    }

    const summaryData = (await response.json()) as SummaryData;

    // 3. Save to Cache
    try {
      await chrome.storage.local.set({ [cacheKey]: summaryData });
    } catch (error: unknown) {
      console.warn('Cache Storage Error:', error);
    }

    return summaryData;
  } catch (error: unknown) {
    console.error('Summarization Error:', error);
    throw new Error('The AI failed to generate a summary.', { cause: error });
  }
}
