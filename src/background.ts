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
        if (error.cause instanceof Error) {
          errorData.cause = error.cause.message;
        } else if (error.cause) {
          errorData.cause = String(error.cause);
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
  } catch (error) {
    console.warn('Cache Retrieval Error:', error);
  }

  // 2. Get API Key from environment variable
  const geminiApiKey = (process.env as any).VITE_GEMINI_API_KEY; // esbuild will replace this
  
  if (!geminiApiKey) {
    throw new Error('Gemini API Key is not configured.');
  }

  // 3. Call Gemini API directly via fetch (more robust for extensions)
  const prompt = `
    You are an expert content summarizer. Summarize the following web page content.
    
    Page Title: ${title}
    
    Content:
    ${text.substring(0, 25000)}
    
    Please provide the response in the following JSON format:
    {
      "bulletPoints": ["point 1", "point 2", ...],
      "keyInsights": ["insight 1", "insight 2", ...],
      "readingTime": "X minutes"
    }
    
    Return ONLY the JSON. No markdown formatting.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status}`, { cause: errorText });
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error('Empty response from AI.');
    }
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response as JSON.', { cause: responseText });
    }
    
    const summaryData = JSON.parse(jsonMatch[0]) as SummaryData;

    // 4. Save to Cache
    try {
      await chrome.storage.local.set({ [cacheKey]: summaryData });
    } catch (error) {
      console.warn('Cache Storage Error:', error);
    }

    return summaryData;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error('The AI failed to generate a summary.', { cause: error instanceof Error ? error : new Error(String(error)) });
  }
}
