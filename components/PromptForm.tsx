
import React, { useState, useRef, useEffect } from 'react';

const CATEGORIES = [
    '주제',
    '의상',
    '화면구성',
    '규칙 선언(부정)',
    '원본 유지',
    '카메라 구도',
    '조명',
    '이미지 스타일',
    '재질',
    '색감 & 톤',
    '감정',
    '포즈'
];

interface PromptFormProps {
    onSubmit: (prompt: string, category: string) => Promise<void>;
    onClose: () => void;
    isSubmitting: boolean;
}

const PromptForm: React.FC<PromptFormProps> = ({ onSubmit, onClose, isSubmitting }) => {
    const [prompt, setPrompt] = useState('');
    const [category, setCategory] = useState('주제');
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const categoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
                setIsCategoryOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        await onSubmit(prompt.trim(), category);
        onClose();
    };

    return (
        <div className="bg-neutral-900 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl w-full max-w-lg mx-auto overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6 md:mb-8">
                <h2 className="text-lg md:text-xl font-normal text-neutral-100">Upload Single Prompt</h2>
                <button
                    onClick={onClose}
                    className="text-neutral-500 hover:text-neutral-200 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-[10px] font-semibold text-neutral-500 mb-2">Category</label>
                    <div className="relative" ref={categoryRef}>
                        <button
                            type="button"
                            onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                            className="w-full flex items-center justify-between bg-neutral-950 rounded-xl p-4 text-sm text-neutral-200 focus:outline-none transition-all"
                        >
                            <span>{category}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-300 ${isCategoryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {isCategoryOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] rounded-2xl overflow-hidden z-50 shadow-2xl border border-neutral-800 py-1 max-h-[240px] overflow-y-auto scrollbar-hide">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => { setCategory(cat); setIsCategoryOpen(false); }}
                                        className={`w-full px-5 py-3 text-left text-sm transition-colors hover:bg-neutral-800/50 ${category === cat ? 'text-white font-semibold' : 'text-neutral-500'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-semibold text-neutral-500 mb-2">Prompt Text</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter the prompt sentence here..."
                        className="w-full bg-neutral-950 rounded-2xl p-5 text-sm text-neutral-200 focus:outline-none transition-all min-h-[120px] resize-none placeholder:text-neutral-700"
                        disabled={isSubmitting}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || !prompt.trim()}
                    className={`w-full py-4 rounded-2xl text-xs font-semibold transition-all ${isSubmitting
                        ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-neutral-200'
                        }`}
                >
                    {isSubmitting ? 'Uploading...' : 'Register Prompt'}
                </button>
            </form>
        </div>
    );
};

export default PromptForm;
