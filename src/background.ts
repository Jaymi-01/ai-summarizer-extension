import { GoogleGenerativeAI } from '@google/generative-ai';

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
        // Send back the message and the cause if it exists for better traceability
        const errorData: SummaryResponse = { error: error.message };
        if (error.cause instanceof Error) {
          errorData.cause = error.cause.message;
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
  let cached: { [key: string]: SummaryData } | null = null;
  try {
    const result = await chrome.storage.local.get([cacheKey]);
    cached = result as { [key: string]: SummaryData };
  } catch (error) {
    console.error('Cache Retrieval Error:', error);
    // Continue without cache
  }

  if (cached && cached[cacheKey]) {
    return cached[cacheKey];
  }

  // 2. Get API Key from environment variable
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!geminiApiKey) {
    throw new Error('Gemini API Key is not configured in the build (.env file).');
  }

  // 3. Call Gemini
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

  const prompt = `
    You are an expert content summarizer. Summarize the following web page content.
    
    Page Title: ${title}
    
    Content:
    ${text.substring(0, 30000)} // Truncate to avoid token limits
    
    Please provide the response in the following JSON format:
    {
      "bulletPoints": ["point 1", "point 2", ...],
      "keyInsights": ["insight 1", "insight 2", ...],
      "readingTime": "X minutes"
    }
    
    Ensure the summary is concise and covers the main points accurately.
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract JSON from response (Gemini sometimes wraps in markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response was not in the expected JSON format.', { cause: new Error(responseText) });
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
    // Wrap the original error in a more descriptive symptom error
    throw new Error('The AI failed to generate a summary. This could be due to a network issue or an invalid API key.', { cause: error instanceof Error ? error : new Error(String(error)) });
  }
}
