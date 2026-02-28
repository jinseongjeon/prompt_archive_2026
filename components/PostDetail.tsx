import React, { useState } from 'react';
import { Post } from '../types';
import { translateText } from '../services/translation';
import { splitIntoSentences, categorizeSentence } from '../utils/promptUtils';

interface PostDetailProps {
  post: Post;
  onClose: () => void;
}

const PostDetail: React.FC<PostDetailProps> = ({ post, onClose }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedPrompt, setTranslatedPrompt] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // New States for Structured Prompt
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sentenceTranslations, setSentenceTranslations] = useState<{ [key: string]: string }>({});
  const [sentenceTranslating, setSentenceTranslating] = useState<{ [key: string]: boolean }>({});
  const [isExpanded, setIsExpanded] = useState(false);

  // Ensure prompt is split and categorized if sentences are missing
  const sentences = React.useMemo(() => {
    if (post.categorizedSentences && post.categorizedSentences.length > 0) {
      return post.categorizedSentences;
    }
    // Fallback if AI haven't categorized yet
    return splitIntoSentences(post.prompt).map(s => ({
      text: s,
      category: categorizeSentence(s, undefined, post.prompt) // Pass full prompt for context
    }));
  }, [post.prompt, post.categorizedSentences]);

  const categories = ['All', ...Array.from(new Set(sentences.map(s => s.category).filter(Boolean)))];

  const filteredSentences = sentences.filter(s =>
    selectedCategory === 'All' || s.category === selectedCategory
  );

  // Auto-translate sentences when they change
  React.useEffect(() => {
    filteredSentences.forEach((s, idx) => {
      // Use text as key to avoid shifting index issues
      if (!sentenceTranslations[s.text] && !sentenceTranslating[s.text]) {
        // Stagger requests slightly to avoid heavy parallel load
        setTimeout(() => {
          translateSentence(s.text, s.text);
        }, idx * 100);
      }
    });
  }, [filteredSentences]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % post.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + post.images.length) % post.images.length);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [id]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleTranslate = async () => {
    if (isTranslated) {
      setIsTranslated(false);
      return;
    }

    if (translatedPrompt) {
      setIsTranslated(true);
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translateText(post.prompt, "Korean");
      setTranslatedPrompt(result);
      setIsTranslated(true);
    } catch (error) {
      console.error("Translation failed", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const translateSentence = async (text: string, id: string) => {
    if (sentenceTranslations[id]) return;
    setSentenceTranslating(prev => ({ ...prev, [id]: true }));
    try {
      const result = await translateText(text, "Korean");
      setSentenceTranslations(prev => ({ ...prev, [id]: result }));
    } catch (error) {
      console.error("Sentence translation failed", error);
    } finally {
      setSentenceTranslating(prev => ({ ...prev, [id]: false }));
    }
  };

  const parseOriginality = (text: string | undefined) => {
    if (!text || text.toLowerCase().includes("none identified")) return [];

    // Split into lines starting with '-'
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-'))
      .map(line => {
        const cleanLine = line.replace(/^-?\s*/, '');
        const parts = cleanLine.split('|');
        // Based on service instruction format "- [EN]: ... | [KR]: ..."
        const en = parts[0]?.replace('[EN]:', '').trim() || '';
        // Extract Korean part and forcefully remove any English labels if AI leaked them
        let kr = parts[1]?.replace('[KR]:', '').trim() || '';
        if (kr.includes('[EN]:')) {
          kr = kr.split('[EN]:')[0].trim();
        }
        const raw = line.replace(/^-?\s*/, '').trim();
        return { en, kr, raw };
      })
      .filter(item => item.en || item.kr);
  };

  const preservationPoints = parseOriginality(post.originalityAnalysis);

  const CopyIcon = ({ copied }: { copied: boolean }) => (
    copied ? (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
      </svg>
    )
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center max-md:p-0 p-4 md:p-8">
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Main Container */}
      <div className="relative z-10 bg-neutral-950 max-md:rounded-none rounded-2xl overflow-hidden flex flex-col md:flex-row w-full max-w-6xl shadow-2xl animate-in zoom-in-95 duration-300 max-md:h-screen max-md:max-h-screen max-h-[95vh] md:max-h-[90vh]">

        {/* Left: Image Area */}
        <div
          className={`relative w-full md:w-[600px] bg-[#121212] flex items-center justify-center overflow-hidden flex-shrink-0 transition-all duration-700 cursor-pointer ${isExpanded ? 'max-md:h-[15vh] md:h-initial' : 'max-md:h-[40vh] md:h-initial'
            } md:min-h-full`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)' }}
          onClick={() => setIsExpanded(false)}
        >
          {post.images.map((imgSrc, idx) => (
            <img
              key={idx}
              src={imgSrc}
              alt={`Slide ${idx}`}
              className={`absolute inset-0 w-full h-full object-contain ${idx === currentImageIndex ? 'opacity-100 z-20' : 'opacity-0 z-10'
                }`}
            />
          ))}

          {post.images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-4 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors z-30"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors z-30"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                {post.images.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all ${i === currentImageIndex ? 'w-4 bg-white' : 'w-1 bg-white/20'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: Info Sidebar */}
        <div
          className={`flex-1 flex flex-col min-w-0 bg-neutral-950 overflow-hidden relative transition-all duration-700 ${isExpanded ? 'max-md:h-[75vh]' : 'max-md:h-[50vh]'
            } md:h-initial md:min-h-full`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)' }}
          onClick={(e) => {
            // Only expand if clicked in parent, not on buttons/links
            if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.clickable-area')) {
              setIsExpanded(true);
            }
          }}
        >

          {/* Close Button Inside Sidebar - Positioned absolute */}
          <button
            onClick={onClose}
            className="absolute top-8 right-8 text-neutral-600 hover:text-white transition-colors z-50 px-2 py-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Title Area */}
          <div className="p-6 md:p-8 pr-16 md:pr-20 clickable-area">
            <h2 className="text-lg md:text-xl font-semibold text-neutral-100 truncate" title={post.title}>
              {post.title}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-8 md:space-y-10 scrollbar-hide">
            {/* Main Prompt Section */}
            <div className="p-6 md:p-8 pb-0 clickable-area">
              <div className="flex justify-between items-center mb-6">
                <label className="block text-[10px] font-semibold text-neutral-600">Prompt</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTranslate(); }}
                    disabled={isTranslating}
                    className={`flex items-center gap-1.5 text-[9px] font-semibold transition-colors ${isTranslated ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'} ${isTranslating ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {isTranslating ? (
                      <div className="w-2.5 h-2.5 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                    )}
                    {isTranslated ? 'Original' : 'Translate'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(isTranslated ? translatedPrompt : post.prompt, 'main-prompt'); }}
                    className={`flex items-center gap-1.5 text-[9px] font-semibold transition-colors ${copiedStates['main-prompt'] ? 'text-green-500' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <CopyIcon copied={!!copiedStates['main-prompt']} />
                    {copiedStates['main-prompt'] ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed font-normal whitespace-pre-wrap">
                {isTranslated ? translatedPrompt : post.prompt}
              </p>
            </div>

            {/* Structured Prompt Section */}
            <div className="space-y-6">
              <div className="sticky top-0 bg-neutral-950 z-40 px-6 md:px-8 py-4 border-b border-white/5 flex justify-between items-center shadow-[0_1px_30px_rgba(0,0,0,0.5)]">
                <label className="block text-[10px] font-semibold text-neutral-600 uppercase">Structured Details</label>

                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-white/5 text-[10px] font-semibold text-neutral-400 hover:text-white transition-colors"
                  >
                    <span>{selectedCategory}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isFilterOpen && (
                    <div className="absolute top-full right-0 mt-2 w-40 bg-neutral-900 border border-white/5 rounded-xl overflow-hidden shadow-2xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); setIsFilterOpen(false); }}
                          className={`w-full px-4 py-2 text-left text-[10px] font-semibold transition-colors hover:bg-white/5 ${selectedCategory === cat ? 'text-white' : 'text-neutral-500'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {post.isAIPending ? (
                <div className="flex items-center gap-3 py-10 px-6 md:px-8">
                  <div className="w-3 h-3 border border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
                  <span className="text-[10px] font-semibold text-neutral-600 uppercase">분석 중...</span>
                </div>
              ) : filteredSentences.length > 0 ? (
                <div className="space-y-4 px-6 md:px-8 pb-10">
                  {filteredSentences.map((s, idx) => {
                    const sId = s.text; // Use text as ID for consistency with translation cache
                    return (
                      <div key={idx} className="bg-neutral-900/40 rounded-2xl p-6 md:p-10 space-y-4 group relative border border-transparent hover:border-white/5 transition-all">
                        <div className="flex justify-between items-start gap-4">
                          <span className="px-2 py-0.5 rounded bg-neutral-800 text-[8px] font-semibold text-neutral-500 uppercase">{s.category || 'General'}</span>
                          <div className="flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(s.text, sId); }}
                              title="Copy"
                              className={`p-1.5 rounded-lg bg-neutral-950/50 transition-colors ${copiedStates[sId] ? 'text-green-500' : 'text-neutral-500 hover:text-white'}`}
                            >
                              <CopyIcon copied={!!copiedStates[sId]} />
                            </button>
                          </div>
                        </div>

                        {/* Original English Text - Matching PromptCard style but slightly smaller on PC */}
                        <p className="text-base md:text-lg text-white leading-snug font-semibold whitespace-pre-wrap">
                          {s.text}
                        </p>

                        {/* Automatic Korean Translation - Matching PromptCard style */}
                        <div className="min-h-[1.25rem] md:min-h-[1.5rem]">
                          {sentenceTranslating[sId] && !sentenceTranslations[sId] ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 md:w-2.5 h-2 md:h-2.5 border border-neutral-700 border-t-neutral-500 rounded-full animate-spin" />
                              <span className="text-[10px] md:text-[11px] text-neutral-600 font-medium">Translating...</span>
                            </div>
                          ) : (
                            <p className="text-xs md:text-sm text-white/70 leading-relaxed font-normal whitespace-pre-wrap animate-in fade-in duration-500">
                              {sentenceTranslations[sId] || "..."}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center px-6 md:px-8">
                  <p className="text-[10px] font-semibold text-neutral-700 uppercase">No detailed patterns found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
