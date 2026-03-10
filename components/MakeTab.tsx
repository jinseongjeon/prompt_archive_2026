
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Post, CategorizedSentence } from '../types';
import { generateCustomPrompt, generateSingleCategorizedSentence, analyzeStyleRequirement, generateSentenceFromUserRequest } from '../services/gemini';
import { translateText } from '../services/translation';

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

interface MakeSentence extends CategorizedSentence {
  alternatives: string[];
}

interface MakeTabProps {
  archivePosts: Post[];
}

const MakeTab: React.FC<MakeTabProps> = ({ archivePosts }) => {
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingSentence, setIsAddingSentence] = useState(false);
  const [resultSentences, setResultSentences] = useState<MakeSentence[]>([]);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isCopiedAll, setIsCopiedAll] = useState(false);
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [copiedIndividual, setCopiedIndividual] = useState<Record<string, boolean>>({});

  // Additional request state
  const [additionalRequest, setAdditionalRequest] = useState('');
  const [isAddingByRequest, setIsAddingByRequest] = useState(false);

  // Drag and drop images state
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);

  // Drag and drop sentences state
  const [draggedSentenceIndex, setDraggedSentenceIndex] = useState<number | null>(null);
  const [dragOverSentenceIndex, setDragOverSentenceIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [generationStep, setGenerationStep] = useState<string>('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.sentence-btn')) {
          setActiveSentenceIndex(null);
        }
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const createIntelligentContext = async (desc: string, images: string[]) => {
    setGenerationStep('Analyzing vision...');
    const requirements = await analyzeStyleRequirement(desc, images);

    setGenerationStep('Curating archive style...');
    // Create a map of categories to their sentences
    const categoryMap: Record<string, string[]> = {};
    archivePosts.forEach(post => {
      (post.categorizedSentences || []).forEach(s => {
        if (!categoryMap[s.category]) categoryMap[s.category] = [];
        categoryMap[s.category].push(s.text);
      });
    });

    // Select sentences based on weights
    const selectedSentences: string[] = [];
    requirements.forEach(req => {
      const available = categoryMap[req.category] || [];
      // Take up to 'weight' most recent sentences
      const taken = available.slice(0, Math.max(1, Math.round(req.weight)));
      taken.forEach(txt => selectedSentences.push(`${req.category}: ${txt}`));
    });

    // If we have room, fill with general recent ones to reach ~50
    if (selectedSentences.length < 30) {
      const allSentences = archivePosts.flatMap(p => p.categorizedSentences || []);
      for (const s of allSentences) {
        if (selectedSentences.length >= 50) break;
        const entry = `${s.category}: ${s.text}`;
        if (!selectedSentences.includes(entry)) {
          selectedSentences.push(entry);
        }
      }
    }

    return selectedSentences.join('\n');
  };

  const activeAlternatives = useMemo(() => {
    if (activeSentenceIndex === null) return [];
    return resultSentences[activeSentenceIndex].alternatives || [];
  }, [activeSentenceIndex, resultSentences]);

  useEffect(() => {
    const translateResults = async () => {
      const textsToTranslate = resultSentences.map(s => s.text);
      for (const text of textsToTranslate) {
        if (!translations[text]) {
          const translated = await translateText(text, "Korean");
          setTranslations(prev => ({ ...prev, [text]: translated }));
        }
      }
    };
    if (resultSentences.length > 0) translateResults();
  }, [resultSentences]);

  useEffect(() => {
    const translateAlts = async () => {
      if (activeSentenceIndex === null) return;
      for (const altText of activeAlternatives) {
        if (!translations[altText]) {
          const translated = await translateText(altText, "Korean");
          setTranslations(prev => ({ ...prev, [altText]: translated }));
        }
      }
    };
    translateAlts();
  }, [activeSentenceIndex, activeAlternatives]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFiles = (files: File[]) => {
    const validImageFiles = files.filter(file => file.type.startsWith('image/'));

    if (validImageFiles.length + selectedFiles.length > 5) {
      alert("Maximum 5 images allowed");
      return;
    }

    const newFiles = [...selectedFiles, ...validImageFiles];
    setSelectedFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    handleFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOverImages = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isGenerating) setIsDraggingImages(true);
  };

  const handleDragLeaveImages = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImages(false);
  };

  const handleDropImages = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImages(false);
    if (isGenerating) return;

    const files = Array.from(e.dataTransfer.files) as File[];
    handleFiles(files);
  };

  const removeFile = (idx: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(idx, 1);
    setSelectedFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
  };

  const handleImageDragStart = (idx: number) => {
    setDraggedImageIndex(idx);
  };

  const handleImageDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverImageIndex(idx);
  };

  const handleImageDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedImageIndex === null || draggedImageIndex === targetIdx) {
      setDraggedImageIndex(null);
      setDragOverImageIndex(null);
      return;
    }

    const updatedPreviews = [...previews];
    const [draggedPreview] = updatedPreviews.splice(draggedImageIndex, 1);
    updatedPreviews.splice(targetIdx, 0, draggedPreview);

    const updatedFiles = [...selectedFiles];
    const [draggedFile] = updatedFiles.splice(draggedImageIndex, 1);
    updatedFiles.splice(targetIdx, 0, draggedFile);

    setPreviews(updatedPreviews);
    setSelectedFiles(updatedFiles);
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setActiveSentenceIndex(null);
    try {
      const images = await Promise.all(selectedFiles.map(fileToBase64));
      const intelligentContext = await createIntelligentContext(description, images);

      setGenerationStep('Engineering prompt...');
      const res = await generateCustomPrompt(description, images, intelligentContext);
      setResultSentences(res.sentences);
    } catch (err) {
      console.error("Make generation failed", err);
      alert("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleAddSentence = async (category: string) => {
    if (isAddingSentence) return;
    setIsAddMenuOpen(false);
    setIsAddingSentence(true);
    setGenerationStep(`Expanding ${category}...`);
    try {
      const images = await Promise.all(selectedFiles.map(fileToBase64));
      const intelligentContext = await createIntelligentContext(description, images);
      const newSentence = await generateSingleCategorizedSentence(category, description, images, intelligentContext);
      setResultSentences(prev => [...prev, newSentence as MakeSentence]);
    } catch (err) {
      console.error("Failed to add sentence:", err);
      alert("Failed to generate a new sentence.");
    } finally {
      setIsAddingSentence(false);
      setGenerationStep('');
    }
  };

  const removeSentence = (idx: number) => {
    setResultSentences(prev => prev.filter((_, i) => i !== idx));
    if (activeSentenceIndex === idx) setActiveSentenceIndex(null);
    else if (activeSentenceIndex !== null && activeSentenceIndex > idx) {
      setActiveSentenceIndex(activeSentenceIndex - 1);
    }
  };

  const handleAdditionalRequest = async () => {
    if (!additionalRequest.trim() || isAddingByRequest) return;
    setIsAddingByRequest(true);
    setGenerationStep('Processing your request...');
    try {
      const images = await Promise.all(selectedFiles.map(fileToBase64));
      const intelligentContext = await createIntelligentContext(description, images);
      const currentPromptContext = resultSentences.map(s => `[${s.category}] ${s.text}`).join('\n');
      const newSentence = await generateSentenceFromUserRequest(
        additionalRequest,
        currentPromptContext,
        description,
        images,
        intelligentContext
      );
      setResultSentences(prev => [...prev, newSentence as MakeSentence]);
      setAdditionalRequest('');
    } catch (err) {
      console.error("Failed to add sentence from request:", err);
      alert("Failed to generate sentence. Please try again.");
    } finally {
      setIsAddingByRequest(false);
      setGenerationStep('');
    }
  };

  const copyAllPrompt = async () => {
    const fullText = resultSentences.map(s => s.text).join(' ');
    try {
      await navigator.clipboard.writeText(fullText);
      setIsCopiedAll(true);
      setTimeout(() => setIsCopiedAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const swapSentence = (altText: string) => {
    if (activeSentenceIndex === null) return;
    const newSentences = [...resultSentences];
    newSentences[activeSentenceIndex] = { ...newSentences[activeSentenceIndex], text: altText };
    setResultSentences(newSentences);
    setActiveSentenceIndex(null);
  };

  const insertSentence = (altText: string) => {
    if (activeSentenceIndex === null) return;
    const currentSentence = resultSentences[activeSentenceIndex];
    const newSentence: MakeSentence = {
      ...currentSentence,
      text: altText,
      alternatives: []
    };

    const newSentences = [...resultSentences];
    newSentences.splice(activeSentenceIndex + 1, 0, newSentence);
    setResultSentences(newSentences);
    setActiveSentenceIndex(null);
  };

  const copyIndividual = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndividual(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedIndividual(prev => ({ ...prev, [id]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

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

  // Sentence reordering logic
  const handleSentenceDragStart = (idx: number) => {
    setDraggedSentenceIndex(idx);
  };

  const handleSentenceDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverSentenceIndex(idx);
  };

  const handleSentenceDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedSentenceIndex === null || draggedSentenceIndex === targetIdx) {
      setDraggedSentenceIndex(null);
      setDragOverSentenceIndex(null);
      return;
    }

    const updatedSentences = [...resultSentences];
    const [draggedItem] = updatedSentences.splice(draggedSentenceIndex, 1);
    updatedSentences.splice(targetIdx, 0, draggedItem);

    setResultSentences(updatedSentences);
    setDraggedSentenceIndex(null);
    setDragOverSentenceIndex(null);

    // Reset active index if needed
    if (activeSentenceIndex !== null) {
      if (activeSentenceIndex === draggedSentenceIndex) {
        setActiveSentenceIndex(targetIdx);
      } else if (draggedSentenceIndex < activeSentenceIndex && targetIdx >= activeSentenceIndex) {
        setActiveSentenceIndex(activeSentenceIndex - 1);
      } else if (draggedSentenceIndex > activeSentenceIndex && targetIdx <= activeSentenceIndex) {
        setActiveSentenceIndex(activeSentenceIndex + 1);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-10 animate-in fade-in duration-700 relative">
      <div className="flex flex-col gap-12">

        <div className="flex-1 space-y-16">
          <section className="space-y-10">
            <div className="space-y-4 px-2 md:px-0">
              <label className="block text-[10px] font-semibold text-neutral-600 uppercase">Vision Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What kind of image are you imagining?"
                className="w-full bg-neutral-900/30 rounded-2xl md:rounded-3xl p-6 md:p-8 text-base md:text-lg text-white font-normal focus:outline-none min-h-[140px] md:min-h-[160px] resize-none border-none placeholder:text-neutral-800"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-semibold text-neutral-600 uppercase">Reference Images ({selectedFiles.length}/5)</label>
              <div
                onDragOver={handleDragOverImages}
                onDragLeave={handleDragLeaveImages}
                onDrop={handleDropImages}
                className={`flex flex-wrap gap-4 p-6 rounded-[2.5rem] border transition-all duration-300 ${isDraggingImages
                  ? 'border-white bg-white/5 scale-[1.01]'
                  : 'border-neutral-900 bg-neutral-900/10'
                  }`}
              >
                {previews.map((p, idx) => (
                  <div
                    key={idx}
                    className={`relative w-24 h-24 rounded-2xl overflow-hidden group shadow-2xl cursor-grab active:cursor-grabbing transition-all duration-300 border-2 ${dragOverImageIndex === idx && draggedImageIndex !== idx
                      ? 'border-white/50 scale-105 z-10'
                      : 'border-transparent'
                      } ${draggedImageIndex === idx ? 'opacity-30' : 'opacity-100'}`}
                    draggable
                    onDragStart={() => handleImageDragStart(idx)}
                    onDragOver={(e) => handleImageDragOver(e, idx)}
                    onDrop={(e) => handleImageDrop(e, idx)}
                    onDragEnd={() => {
                      setDraggedImageIndex(null);
                      setDragOverImageIndex(null);
                    }}
                  >
                    <img src={p} className="w-full h-full object-cover opacity-80" alt="ref" />
                    <button
                      onClick={() => removeFile(idx)}
                      className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
                {previews.length < 5 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-2xl bg-neutral-900 flex items-center justify-center text-neutral-700 hover:bg-neutral-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                )}
                {previews.length === 0 && !isDraggingImages && (
                  <div className="flex-1 flex items-center h-24 px-4 pointer-events-none">
                    <p className="text-[11px] text-neutral-700 font-semibold uppercase">Drop images here or click +</p>
                  </div>
                )}
                {isDraggingImages && (
                  <div className="flex-1 flex items-center h-24 px-4 pointer-events-none">
                    <p className="text-[11px] text-white font-semibold uppercase animate-pulse">Release to upload</p>
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !description.trim()}
              className={`w-full h-16 rounded-3xl font-semibold transition-all shadow-xl hover:scale-[1.01] active:scale-[0.99] ${isGenerating ? 'bg-neutral-900 text-neutral-600' : 'bg-white text-black hover:bg-neutral-100'
                }`}
            >
              {isGenerating ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-4 h-4 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
                  <span>{generationStep || 'Generating...'}</span>
                </div>
              ) : 'Generate Personalized Prompt'}
            </button>
          </section>

          {resultSentences.length > 0 && (
            <section className="space-y-6 animate-in slide-in-from-bottom-5 duration-500 relative">
              <div className="flex justify-between items-end px-2">
                <div className="flex items-center gap-3">
                  <label className="block text-[10px] font-semibold text-neutral-600 uppercase">Custom Structured Prompt</label>
                  <span className="text-[9px] font-medium text-neutral-800 italic">(Drag to reorder)</span>
                </div>
                <div className="flex items-center gap-6">
                  {isAddingSentence && (
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 border border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
                      <span className="text-[9px] font-semibold text-neutral-600 uppercase">Learning from archive...</span>
                    </div>
                  )}
                  <button
                    onClick={copyAllPrompt}
                    className={`flex items-center gap-2 text-[10px] font-semibold uppercase transition-colors ${isCopiedAll ? 'text-green-500' : 'text-neutral-500 hover:text-white'}`}
                  >
                    {isCopiedAll ? (
                      <><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>Copied</>
                    ) : (
                      <><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>Copy All</>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-[#0a0a0a] rounded-[32px] md:rounded-[40px] p-6 md:p-12 space-y-2">
                <div className="space-y-4">
                  {resultSentences.map((s, idx) => (
                    <div
                      key={idx}
                      className={`group relative transition-all duration-300 rounded-[2rem] border cursor-grab active:cursor-grabbing ${dragOverSentenceIndex === idx && draggedSentenceIndex !== idx
                        ? 'border-white/20 bg-white/5 -translate-y-1'
                        : 'border-transparent'
                        } ${draggedSentenceIndex === idx ? 'opacity-30' : 'opacity-100'}`}
                      draggable
                      onDragStart={() => handleSentenceDragStart(idx)}
                      onDragOver={(e) => handleSentenceDragOver(e, idx)}
                      onDrop={(e) => handleSentenceDrop(e, idx)}
                      onDragEnd={() => {
                        setDraggedSentenceIndex(null);
                        setDragOverSentenceIndex(null);
                      }}
                    >
                      <div className="flex items-start gap-4 p-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="text-[9px] font-semibold text-neutral-700 uppercase">{s.category}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyIndividual(s.text, `main-${idx}`); }}
                              className={`flex items-center gap-1.5 text-[9px] font-semibold transition-colors ${copiedIndividual[`main-${idx}`] ? 'text-green-500' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                              <CopyIcon copied={!!copiedIndividual[`main-${idx}`]} />
                              {copiedIndividual[`main-${idx}`] ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <button
                            onClick={() => setActiveSentenceIndex(idx)}
                            className={`sentence-btn text-xl md:text-2xl text-left transition-all font-semibold leading-snug p-2 -ml-2 rounded-xl block w-full ${activeSentenceIndex === idx ? 'bg-neutral-800 text-white shadow-xl' : 'text-white hover:bg-neutral-900/80'
                              }`}
                          >
                            {s.text}
                          </button>
                          <p className="text-sm text-white/50 font-normal leading-relaxed px-1">
                            {translations[s.text] || "..."}
                          </p>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); removeSentence(idx); }}
                          className="mt-3 text-neutral-800 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Sentence Logic */}
                <div className="pt-10 border-t border-neutral-900/50 mt-6 flex flex-col items-center gap-6">
                  <div className="relative" ref={addMenuRef}>
                    <button
                      onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                      disabled={isAddingSentence}
                      className={`h-14 px-8 rounded-2xl bg-neutral-950 text-[10px] font-semibold uppercase transition-all flex items-center gap-3 ${isAddingSentence ? "text-neutral-700 cursor-not-allowed" : "text-neutral-500 hover:bg-neutral-900 hover:text-white"
                        }`}
                    >
                      {isAddingSentence ? (
                        <div className="w-4 h-4 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      {isAddingSentence ? "Adding Sentence..." : "Add specific detail sentence"}
                    </button>
                    {isAddMenuOpen && (
                      <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-64 bg-[#0a0a0a] rounded-3xl border border-neutral-900 shadow-2xl p-4 grid grid-cols-1 gap-1 z-20 animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <div className="px-3 py-2 border-b border-neutral-900 mb-2">
                          <span className="text-[9px] font-semibold text-neutral-600 uppercase">Select Category</span>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto scrollbar-hide space-y-1">
                          {CATEGORIES.map(cat => (
                            <button
                              key={cat}
                              onClick={() => handleAddSentence(cat)}
                              className="w-full text-left px-4 py-3 rounded-xl text-[10px] font-semibold uppercase text-neutral-500 hover:text-white hover:bg-neutral-900 transition-all"
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-600 font-medium italic">Click each sentence to explore adjusted alternatives, drag to reorder, or add new patterns.</p>
                </div>

                {/* Gemini Additional Request Input */}
                <div className="pt-8 border-t border-neutral-900/50 mt-4">
                  <label className="block text-[10px] font-semibold text-neutral-600 uppercase mb-4 px-2">Ask Gemini to add more</label>
                  <div className="flex gap-3 items-start">
                    <textarea
                      value={additionalRequest}
                      onChange={(e) => setAdditionalRequest(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAdditionalRequest();
                        }
                      }}
                      placeholder="추가하고 싶은 내용을 설명하세요... (예: 따뜻한 조명 효과 추가해줘)"
                      disabled={isAddingByRequest}
                      className="flex-1 bg-neutral-950 rounded-2xl p-5 text-sm text-white font-normal focus:outline-none focus:ring-1 focus:ring-neutral-700 min-h-[56px] max-h-[120px] resize-none border border-neutral-900 placeholder:text-neutral-700 disabled:opacity-50 transition-all"
                    />
                    <button
                      onClick={handleAdditionalRequest}
                      disabled={isAddingByRequest || !additionalRequest.trim()}
                      className={`h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center transition-all ${isAddingByRequest
                          ? 'bg-neutral-900 text-neutral-700 cursor-not-allowed'
                          : additionalRequest.trim()
                            ? 'bg-white text-black hover:bg-neutral-200 hover:scale-105 active:scale-95'
                            : 'bg-neutral-900 text-neutral-700 cursor-not-allowed'
                        }`}
                    >
                      {isAddingByRequest ? (
                        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {activeSentenceIndex !== null && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[55] animate-in fade-in duration-300"
            onClick={() => setActiveSentenceIndex(null)}
          />
        )}

        <div
          ref={sidebarRef}
          className={`fixed top-0 right-0 h-screen w-full lg:w-[450px] bg-[#0a0a0a] border-l border-neutral-900 z-[60] shadow-[-20px_0_60px_rgba(0,0,0,0.8)] transition-transform duration-500 ease-in-out transform flex flex-col ${activeSentenceIndex !== null ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          {activeSentenceIndex !== null && (
            <>
              <div className="p-8 pb-4 flex justify-between items-center shrink-0">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-neutral-600 uppercase">Category</span>
                  <div className="flex items-center gap-3">
                    <h4 className="text-white text-lg font-semibold">{resultSentences[activeSentenceIndex].category}</h4>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSentenceIndex(null)}
                  className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-10 scrollbar-hide">
                <div className="space-y-3">
                  <span className="text-[10px] font-semibold text-neutral-600 uppercase">Currently Selected</span>
                  <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800/50">
                    <p className="text-sm text-white font-semibold leading-relaxed mb-2">{resultSentences[activeSentenceIndex].text}</p>
                    <p className="text-xs text-white/40 font-normal leading-relaxed italic">{translations[resultSentences[activeSentenceIndex].text] || "..."}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <span className="text-[10px] font-semibold text-neutral-600 uppercase">Refined Candidates</span>
                  <div className="space-y-4">
                    {activeAlternatives.length > 0 ? activeAlternatives.map((altText, i) => (
                      <div
                        key={i}
                        className="w-full text-left p-6 rounded-3xl bg-neutral-900/20 transition-all group border border-transparent hover:border-neutral-800/50"
                      >
                        <div className="flex justify-between items-start gap-3 mb-4">
                          <p className="text-sm text-white font-semibold leading-relaxed shrink min-w-0">{altText}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyIndividual(altText, `alt-${i}`); }}
                            className={`p-1.5 rounded-lg bg-neutral-950/50 transition-colors shrink-0 ${copiedIndividual[`alt-${i}`] ? 'text-green-500' : 'text-neutral-500 hover:text-white'}`}
                          >
                            <CopyIcon copied={!!copiedIndividual[`alt-${i}`]} />
                          </button>
                        </div>
                        <p className="text-xs text-white/40 font-normal leading-relaxed mb-6">
                          {translations[altText] || "Translating..."}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => swapSentence(altText)}
                            className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-[10px] font-bold uppercase text-neutral-400 hover:bg-white hover:text-black transition-all"
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => insertSentence(altText)}
                            className="flex-1 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-[10px] font-bold uppercase text-neutral-400 hover:border-white hover:text-white transition-all"
                          >
                            Add Below
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="py-12 flex flex-col items-center justify-center text-neutral-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                        <p className="text-[10px] uppercase font-semibold text-center">Learning from vision...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-neutral-900/30 border-t border-neutral-900 text-center">
                <p className="text-[10px] text-neutral-600 font-medium">Candidates are contextually adjusted to your vision and archive style.</p>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default MakeTab;
