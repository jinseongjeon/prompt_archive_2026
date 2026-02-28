
import React, { useState, useEffect } from 'react';
import { Post } from '../types';
import { translateText } from '../services/translation';

interface PromptCardProps {
  item: {
    id: string;
    originalPost: Post;
    text: string;
    category?: string;
    count?: number;
  };
  onClick: () => void;
  onCopy: () => void;
}

const PromptCard: React.FC<PromptCardProps> = ({ item, onClick, onCopy }) => {
  const [translatedTextContent, setTranslatedTextContent] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const autoTranslate = async () => {
      setIsTranslating(true);
      try {
        const result = await translateText(item.text, "Korean");
        setTranslatedTextContent(result);
      } catch (error) {
        console.error("Auto-translation failed", error);
      } finally {
        setIsTranslating(false);
      }
    };

    autoTranslate();
  }, [item.text]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.text);
      setIsCopied(true);
      onCopy(); // Notify parent to increment count
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };


  return (
    <div
      onClick={onClick}
      className="group relative bg-[#0a0a0a] rounded-2xl md:rounded-3xl p-6 md:p-10 transition-all hover:bg-[#0c0c0c] cursor-pointer shadow-sm overflow-hidden"
    >
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-10">
        <div className="flex-1 min-w-0">
          {/* Tags Row */}
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            {item.category && (
              <div className="inline-flex items-center px-2 py-1 md:px-2.5 md:py-1 rounded-md bg-neutral-900 border border-white/5">
                <span className="text-[9px] md:text-[10px] font-semibold text-neutral-500 uppercase">
                  {item.category}
                </span>
              </div>
            )}
          </div>

          {/* Original English Text */}
          <h3 className="text-base md:text-xl text-white leading-snug font-semibold transition-colors">
            {item.text}
          </h3>

          {/* Automatic Korean Translation */}
          <div className="mt-3 md:mt-4 min-h-[1.25rem] md:min-h-[1.5rem]">
            {isTranslating && !translatedTextContent ? (
              <div className="flex items-center gap-2">
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 border border-neutral-700 border-t-neutral-500 rounded-full animate-spin" />
                <span className="text-[10px] md:text-[11px] text-neutral-600 font-medium">Translating...</span>
              </div>
            ) : (
              <p className="text-xs md:text-sm text-white/70 leading-relaxed font-normal">
                {translatedTextContent || "..."}
              </p>
            )}
          </div>
        </div>

        <div className="flex md:flex-col gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity md:absolute md:top-10 md:right-10 pt-2 md:pt-0">
          <button
            onClick={handleCopy}
            title="Copy Original Text"
            className={`p-2 md:p-2.5 rounded-lg md:rounded-xl bg-neutral-900 border border-white/5 transition-colors ${isCopied ? 'text-green-500' : 'text-neutral-500 hover:text-neutral-200'}`}
          >
            {isCopied ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptCard;
