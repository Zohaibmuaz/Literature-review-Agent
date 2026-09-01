"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useReactToPrint } from "react-to-print";
import { Loader2, Search, BookOpen, GraduationCap, Download, History, User, Building } from "lucide-react";

export default function Home() {
  const [topic, setTopic] = useState("");
  const [author, setAuthor] = useState("AI PhD Research Automation");
  const [institution, setInstitution] = useState("Department of Advanced AI Research");
  
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState("");
  const [error, setError] = useState("");
  
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const componentRef = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Research_Paper_${topic.replace(/\s+/g, '_')}`,
  });

  const fetchHistory = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError("");
    setReview("");
    setShowHistory(false);

    try {
      const res = await fetch("http://127.0.0.1:8000/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, author, institution }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate review. Check backend logs.");
      }

      const data = await res.json();
      setReview(data.review);
      fetchHistory(); // Refresh history
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryItem = (item: any) => {
    setTopic(item.topic);
    setAuthor(item.author);
    setInstitution(item.institution);
    setReview(item.review);
    setShowHistory(false);
  };

  const handleDownloadWord = () => {
    if (!componentRef.current) return;
    
    const htmlContent = (componentRef.current as any).innerHTML;
    
    const cssString = `
      <style>
        .academic-paper {
          font-family: "Times New Roman", Times, serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #000000;
          text-align: justify;
        }
        .academic-paper h1, .academic-paper h2, .academic-paper h3, .academic-paper h4 {
          font-weight: bold;
          text-align: center;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          color: #000000;
        }
        .academic-paper p {
          margin-bottom: 1em;
        }
        .academic-paper ul, .academic-paper ol {
          margin-bottom: 1em;
          padding-left: 2em;
        }
      </style>
    `;

    const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Research Paper</title>" + cssString + "</head><body>";
    const postHtml = "</body></html>";
    const fullHtml = preHtml + htmlContent + postHtml;

    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    const filename = `Research_Paper_${topic.replace(/\s+/g, '_')}.doc`;
    const downloadLink = document.createElement("a");
    
    document.body.appendChild(downloadLink);
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 no-print">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-blue-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-800 hidden sm:block">
              AI PhD Research Assistant
            </h1>
            <h1 className="text-lg font-bold tracking-tight text-gray-800 sm:hidden">
              AI Researcher
            </h1>
          </div>
          <button 
            onClick={() => { setShowHistory(!showHistory); fetchHistory(); }}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium bg-gray-100 px-3 py-2 sm:px-4 rounded-lg text-sm sm:text-base"
          >
            <History className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">History</span> ({history.length})
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 sm:pt-8">
        
        {/* History Modal / Section */}
        {showHistory && (
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" /> Past Research Papers
            </h2>
            {history.length === 0 ? (
              <p className="text-gray-500">No papers generated yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map((item, idx) => (
                  <div key={idx} onClick={() => loadHistoryItem(item)} className="p-3 sm:p-4 border rounded-xl hover:bg-blue-50 cursor-pointer transition-colors">
                    <h3 className="font-semibold text-base sm:text-lg text-blue-800">{item.topic}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">By {item.author} • {item.institution}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Section */}
        <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-semibold mb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 shrink-0" />
            Generate Literature Review
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mb-6">
            Enter your details and a research topic. The AI will read 20 recent academic papers and draft a comprehensive review.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Author Name"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 transition-all text-sm sm:text-base"
                  disabled={loading}
                />
              </div>
              <div className="relative flex-1">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Institution Name"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 transition-all text-sm sm:text-base"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex gap-4 flex-col md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Applications of machine learning in healthcare..."
                  className="w-full pl-11 pr-4 py-3 sm:py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base sm:text-lg bg-gray-50 transition-all"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !topic.trim() || !author.trim() || !institution.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 md:min-w-[200px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Researching...
                  </>
                ) : (
                  "Generate Paper"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 sm:mb-8 border border-red-100 text-sm sm:text-base">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
            <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Conducting Research</h3>
            <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">
              Please wait... The AI is querying ArXiv and Semantic Scholar, chunking abstracts, running vector search, and writing the final draft. This usually takes 15-30 seconds.
            </p>
          </div>
        )}

        {/* Results */}
        {review && !loading && (
          <div className="bg-white p-5 sm:p-8 md:p-12 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto relative">
            
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mb-6 z-10 w-full">
              <button
                onClick={handleDownloadWord}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm sm:text-base font-medium"
              >
                <Download className="w-4 h-4" />
                Download Word
              </button>
              <button
                onClick={() => handlePrint()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors shadow-sm text-sm sm:text-base font-medium"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>

            {/* The printable component */}
            <div ref={componentRef} className="print-p-8 print-bg-white w-full">
              <article className="prose max-w-none academic-paper break-words text-justify">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {review}
                </ReactMarkdown>
              </article>
            </div>
            
          </div>
        )}
      </main>
    </div>
  );
}
