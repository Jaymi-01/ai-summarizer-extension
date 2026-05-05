import { useState, useEffect } from 'react';
import { 
  Sparkle, 
  Clock, 
  WarningCircle
} from '@phosphor-icons/react';

interface SummaryData {
  bulletPoints: string[];
  keyInsights: string[];
  readingTime: string;
}

interface ExtractionResult {
  title: string;
  textContent: string;
  excerpt: string;
  siteName: string;
  length: number;
  error?: string;
}

interface SummaryResponse extends Partial<SummaryData> {
  error?: string;
  cause?: string;
}

function App() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pageTitle, setPageTitle] = useState('');

  useEffect(() => {
    getCurrentTab().then(tab => {
      if (tab?.url) {
        setPageTitle(tab.title || '');
        const cacheKey = `summary_${tab.url}`;
        chrome.storage.local.get([cacheKey], (result: Record<string, SummaryData>) => {
          if (result[cacheKey]) {
            setSummary(result[cacheKey]);
          }
        });
      }
    });
  }, []);

  const getCurrentTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  };

  const handleSummarize = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const tab = await getCurrentTab();
      if (!tab?.id) throw new Error('No active browser tab detected.');

      // Setup a hybrid extraction logic (Message + Direct Return)
      let extractionResolver: (val: ExtractionResult) => void;
      let extractionRejecter: (err: Error) => void;
      
      const extractionPromise = new Promise<ExtractionResult>((resolve, reject) => {
        extractionResolver = resolve;
        extractionRejecter = reject;
      });

      const messageListener = (message: any) => {
        if (message.type === 'CONTENT_EXTRACTED') {
          chrome.runtime.onMessage.removeListener(messageListener);
          if (message.payload.error) {
            extractionRejecter(new Error(message.payload.error));
          } else {
            extractionResolver(message.payload);
          }
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
      
      // Timeout after 15 seconds
      const timeoutId = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        extractionRejecter(new Error('Extraction timed out. Large pages may require more time.'));
      }, 15000);

      // 1. Execute Content Script
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        // Use direct return if available
        if (results && results[0] && results[0].result) {
          const directResult = results[0].result as ExtractionResult;
          if (!directResult.error) {
            clearTimeout(timeoutId);
            chrome.runtime.onMessage.removeListener(messageListener);
            extractionResolver!(directResult);
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        chrome.runtime.onMessage.removeListener(messageListener);
        throw new Error('This page is protected by Chrome.', { cause: err });
      }

      // Wait for the message from the content script
      const extractionResult = await extractionPromise;
      clearTimeout(timeoutId);

      // 2. Send to Background for AI
      chrome.runtime.sendMessage({
        type: 'SUMMARIZE_PAGE',
        payload: {
          title: extractionResult.title,
          text: extractionResult.textContent,
          url: tab.url
        }
      }, (response: SummaryResponse) => {
        if (chrome.runtime.lastError) {
          setError('Background communication error.');
          setLoading(false);
          return;
        }

        if (response?.error) {
          if (response.cause) console.warn('Analysis Cause:', response.cause);
          setError(response.error);
        } else if (response && response.bulletPoints && response.keyInsights && response.readingTime) {
          setSummary(response as SummaryData);
        }
        setLoading(false);
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis Error';
      setError(message);
      if (err instanceof Error && err.cause) {
        console.error('Root Cause:', err.cause);
      }
      setLoading(false);
    }
  };

  const clearSummary = async () => {
    const tab = await getCurrentTab();
    if (tab?.url) {
      chrome.storage.local.remove(`summary_${tab.url}`, () => {
        setSummary(null);
      });
    }
  };

  const copyToClipboard = () => {
    if (!summary) return;
    const text = `SUMMARY:\n${summary.bulletPoints.map(p => `• ${p}`).join('\n')}\n\nKEY INSIGHTS:\n${summary.keyInsights.map(i => `★ ${i}`).join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="w-[400px] min-h-[500px] bg-white flex flex-col font-sans text-black selection:bg-black selection:text-white border border-zinc-200">
      <header className="px-8 pt-12 pb-8 flex flex-col gap-1 border-b border-black">
        <div className="flex items-center gap-2 mb-2">
          <Sparkle size={16} weight="fill" />
          <h1 className="text-[10px] font-black uppercase tracking-[0.5em]">
            Summaize
          </h1>
        </div>
        <h2 className="text-xs font-bold text-zinc-500 truncate" title={pageTitle}>
          {pageTitle || 'No page detected'}
        </h2>
      </header>

      <main className="flex-grow flex flex-col px-8 py-10 gap-10 overflow-y-auto max-h-[460px] custom-scrollbar">
        {!summary && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-500">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Initialize Analysis</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed max-w-[220px]">
              Ready to summarize this page with AI Summarizer.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-zinc-100 border-t-black rounded-full animate-spin" />
            <p className="mt-8 text-[9px] font-black uppercase tracking-[0.4em]">Analyzing</p>
          </div>
        )}

        {error && (
          <div className="border-2 border-black p-6 flex flex-col gap-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <WarningCircle size={16} weight="bold" />
              <p className="font-black text-[10px] uppercase tracking-widest">System Error</p>
            </div>
            <p className="text-[11px] leading-relaxed font-medium">{error}</p>
          </div>
        )}

        {summary && (
          <div className="flex flex-col gap-12 animate-in fade-in duration-700">
            <section>
              <h3 className="text-[9px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-black" />
                Executive Summary
              </h3>
              <ul className="space-y-6">
                {summary.bulletPoints.map((point, i) => (
                  <li key={i} className="text-[13px] leading-relaxed font-medium pl-6 relative">
                    <span className="absolute left-0 top-0 text-[10px] font-black text-zinc-300">{(i + 1).toString().padStart(2, '0')}</span>
                    {point}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-[9px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-black" />
                Key Findings
              </h3>
              <div className="space-y-4">
                {summary.keyInsights.map((insight, i) => (
                  <div key={i} className="p-5 border border-zinc-200 text-[12px] leading-relaxed font-bold bg-zinc-50/50">
                    {insight}
                  </div>
                ))}
              </div>
            </section>

            <div className="pt-8 border-t border-zinc-100 flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Clock size={14} weight="bold" />
                  {summary.readingTime}
                </div>
                <button 
                  onClick={copyToClipboard}
                  className={`flex items-center gap-2 transition-all outline-none focus:ring-2 focus:ring-black focus:ring-offset-4 rounded-sm ${copied ? 'text-zinc-400' : 'hover:opacity-60'}`}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <button 
                onClick={clearSummary}
                className="hover:opacity-60 transition-all outline-none focus:ring-2 focus:ring-black focus:ring-offset-4 rounded-sm"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="p-8 pt-0">
        {!loading && (
          <button
            onClick={handleSummarize}
            className="w-full bg-black text-white py-5 font-black text-[10px] uppercase tracking-[0.5em] hover:bg-zinc-800 active:scale-[0.99] transition-all outline-none focus:ring-4 focus:ring-zinc-200 focus:ring-offset-0 shadow-lg"
          >
            {summary ? 'Refresh' : 'Summarize Page'}
          </button>
        )}
      </footer>
    </div>
  );
}

export default App;
