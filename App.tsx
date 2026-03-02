import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Post, PostFormValues, CategorizedSentence } from './types';
import { savePost, getAllPosts, deletePost, updatePost } from './services/storage';
import { generateAIInsight } from './services/gemini';
import PostForm from './components/PostForm';
import PostCard from './components/PostCard';
import PostDetail from './components/PostDetail';
import PromptCard from './components/PromptCard';
import MakeTab from './components/MakeTab';
import UpdateTab from './components/UpdateTab';
import PromptForm from './components/PromptForm';
import { splitIntoSentences, categorizeSentence, normalizeCategory } from './utils/promptUtils';

type Tab = 'archive' | 'prompt' | 'make' | 'update';
type SortType = '최신순' | '인기순';

const CATEGORIES = [
  '전체',
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

const COPY_COUNTS_KEY = 'prompt_copy_counts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('archive');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [sortType, setSortType] = useState<SortType>('최신순');
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [copyCounts, setCopyCounts] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  // Dropdown States
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const navDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize data
  const fetchPosts = useCallback(async () => {
    try {
      const storedPosts = await getAllPosts();
      setPosts(storedPosts);

      const storedCounts = localStorage.getItem(COPY_COUNTS_KEY);
      if (storedCounts) {
        setCopyCounts(JSON.parse(storedCounts));
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (navDropdownRef.current && !navDropdownRef.current.contains(event.target as Node)) {
        setIsNavDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll lock when modal is open
  useEffect(() => {
    if (selectedPost || isModalOpen || isPromptModalOpen || editingPost) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedPost, isModalOpen, isPromptModalOpen, editingPost]);

  const handlePromptCopy = useCallback((text: string) => {
    setCopyCounts(prev => {
      const newCounts = { ...prev, [text]: (prev[text] || 0) + 1 };
      localStorage.setItem(COPY_COUNTS_KEY, JSON.stringify(newCounts));
      return newCounts;
    });
  }, []);

  const filteredArchivePosts = useMemo(() => {
    const basePosts = posts.filter(post => !post.isSinglePrompt);
    if (!searchQuery.trim()) return basePosts;
    const query = searchQuery.toLowerCase().trim();

    return basePosts
      .map(post => {
        let score = 0;
        const title = post.title.toLowerCase();
        const prompt = post.prompt.toLowerCase();
        if (title === query) score += 100;
        else if (title.includes(query)) score += 50;
        if (prompt.includes(query)) score += 20;
        return { ...post, score };
      })
      .filter(post => post.score > 0)
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.timestamp - a.timestamp));
  }, [posts, searchQuery]);

  const filteredPromptSentences = useMemo(() => {
    let allItems = posts.flatMap(post => {
      const sentences: CategorizedSentence[] = post.categorizedSentences ||
        splitIntoSentences(post.prompt).map(s => ({ text: s, category: post.isAIPending ? '분석 중' : categorizeSentence(s, undefined, post.prompt) }));

      return sentences.map(s => ({
        id: `${post.id}-${s.text.substring(0, 15)}`,
        originalPost: post,
        text: s.text,
        category: normalizeCategory(s.category),
        count: copyCounts[s.text] || 0,
        timestamp: post.timestamp
      }));
    });

    if (selectedCategory !== '전체') {
      allItems = allItems.filter(item => item.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      allItems = allItems.filter(item =>
        item.text.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
      );
    }

    return allItems.sort((a, b) => {
      if (sortType === '인기순') {
        if (b.count !== a.count) return b.count - a.count;
      }
      return b.timestamp - a.timestamp;
    });
  }, [posts, searchQuery, selectedCategory, sortType, copyCounts]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const processAIBackground = async (post: Post) => {
    try {
      const aiResponse = await generateAIInsight(post.prompt, post.images);
      const updatedPost: Post = {
        ...post,
        aiInsight: aiResponse.insight,
        originalityAnalysis: aiResponse.originality,
        categorizedSentences: aiResponse.sentences,
        isAIPending: false
      };
      await updatePost(updatedPost);
      setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
      if (selectedPost?.id === updatedPost.id) setSelectedPost(updatedPost);
    } catch (error) {
      console.error("Background AI processing failed:", error);
      const failedPost = { ...post, isAIPending: false };
      await updatePost(failedPost);
      setPosts(prev => prev.map(p => p.id === failedPost.id ? failedPost : p));
    }
  };

  const handlePostSubmit = async (values: PostFormValues) => {
    setIsSubmitting(true);
    try {
      let finalImages = editingPost ? editingPost.images : [];
      if (values.imageStrings && values.imageStrings.length > 0) {
        finalImages = values.imageStrings;
      } else if (values.files.length > 0) {
        finalImages = await Promise.all(values.files.map(fileToBase64));
      }
      const newPost: Post = editingPost ? {
        ...editingPost,
        title: values.title,
        prompt: values.prompt,
        images: finalImages,
        isAIPending: true,
      } : {
        id: crypto.randomUUID(),
        title: values.title,
        images: finalImages,
        prompt: values.prompt,
        aiInsight: "분석 중...",
        timestamp: Date.now(),
        isAIPending: true,
      };

      if (editingPost) {
        await updatePost(newPost);
        // We re-fetch or use state. Since updatePost now handles storage, re-fetching ensures consistency.
        const storedPosts = await getAllPosts();
        setPosts(storedPosts);
      } else {
        await savePost(newPost);
        const storedPosts = await getAllPosts();
        setPosts(storedPosts);
      }

      setIsModalOpen(false);
      setEditingPost(null);
      processAIBackground(newPost);
    } catch (error: any) {
      console.error("Save failed:", error);
      alert("Failed to save.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePromptSubmit = async (text: string, category: string) => {
    setIsSubmitting(true);
    try {
      const sentences = splitIntoSentences(text).map(s => ({
        text: s,
        category: categorizeSentence(s, category, text) // Pass full text for context
      }));

      const newPost: Post = {
        id: crypto.randomUUID(),
        title: "Single Prompt",
        images: [],
        prompt: text,
        aiInsight: "Single Prompt Registration",
        timestamp: Date.now(),
        isAIPending: false,
        isSinglePrompt: true,
        categorizedSentences: sentences
      };

      await savePost(newPost);
      const storedPosts = await getAllPosts();
      setPosts(storedPosts);
      setIsPromptModalOpen(false);
    } catch (error) {
      console.error("Single prompt registration failed:", error);
      alert("Failed to register prompt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setIsModalOpen(true);
  };

  const handleDeletePost = async (id: string) => {
    try {
      await deletePost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      if (selectedPost?.id === id) setSelectedPost(null);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-400 font-normal pb-24">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050505] px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 md:gap-6 px-4 md:px-8 py-3 md:py-4 overflow-visible">
          <div className="flex items-center gap-4 md:gap-10 shrink-0 relative" ref={navDropdownRef}>
            <button
              onClick={() => setIsNavDropdownOpen(!isNavDropdownOpen)}
              className="flex items-center gap-2 text-xs md:text-sm font-semibold uppercase text-white py-1 md:py-2 hover:opacity-80 transition-all"
            >
              <span>{activeTab}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-3 w-3 transition-transform duration-300 ${isNavDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isNavDropdownOpen && (
              <div className="absolute top-full left-0 mt-4 w-40 bg-[#0a0a0a]/95 backdrop-blur-xl rounded-2xl overflow-hidden z-50 shadow-2xl border border-white/5 py-1 animate-in fade-in zoom-in-95 duration-200">
                {(['archive', 'prompt', 'make', 'update'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setIsNavDropdownOpen(false);
                    }}
                    className={`w-full px-5 py-3 text-left text-[11px] md:text-xs font-semibold uppercase transition-colors hover:bg-white/5 ${activeTab === tab ? 'text-white bg-white/5' : 'text-neutral-500'
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end min-w-0">
            <div className="max-w-[120px] md:max-w-md w-full relative group transition-all duration-300 focus-within:max-w-[180px] md:focus-within:max-w-lg">
              <div className="absolute inset-y-0 left-3 md:left-5 flex items-center pointer-events-none text-neutral-600 group-focus-within:text-neutral-400 transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-neutral-900/60 rounded-full h-8 md:h-11 pl-8 md:pl-12 pr-4 text-[10px] md:text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:bg-neutral-800 transition-colors duration-300"
              />
            </div>
            <button
              onClick={() => {
                if (activeTab === 'prompt') {
                  setIsPromptModalOpen(true);
                } else {
                  setEditingPost(null);
                  setIsModalOpen(true);
                }
              }}
              className="w-8 h-8 md:w-11 md:h-11 flex items-center justify-center bg-white hover:bg-neutral-100 text-black rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-6 relative z-0 pt-24 md:pt-36">
        {isLoading ? (
          <div className="flex justify-center items-center py-20"><div className="w-4 h-4 border-2 border-neutral-800 border-t-neutral-500 rounded-full animate-spin" /></div>
        ) : (
          <div className="min-h-[50vh]">
            {activeTab === 'archive' ? (
              filteredArchivePosts.length > 0 ? (
                <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12 animate-in fade-in duration-500">
                  {filteredArchivePosts.map(post => <PostCard key={post.id} post={post} onClick={setSelectedPost} onEdit={handleEditPost} onDelete={handleDeletePost} />)}
                </section>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-neutral-600 space-y-4 animate-in fade-in duration-500">
                  <p className="text-[10px] font-semibold">No archives found</p>
                  <button onClick={() => setSearchQuery('')} className="text-[9px] border-b border-neutral-800 pb-1 hover:text-neutral-400">Clear search</button>
                </div>
              )
            ) : activeTab === 'prompt' ? (
              <div className="animate-in fade-in duration-500">
                <div className="flex flex-row justify-between items-center gap-3 mb-6 md:mb-10">
                  {/* Custom Sort Dropdown */}
                  <div className="relative" ref={sortRef}>
                    <button
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      className="flex items-center justify-between gap-3 bg-neutral-900/60 text-neutral-400 text-[11px] font-semibold h-10 px-5 rounded-xl hover:bg-neutral-800 hover:text-neutral-200 transition-all focus:outline-none min-w-[100px]"
                    >
                      <span>{sortType}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform duration-300 ${isSortOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isSortOpen && (
                      <div className="absolute top-full right-0 mt-2 w-32 bg-[#0a0a0a]/90 backdrop-blur-xl rounded-2xl overflow-hidden z-50 shadow-2xl animate-in fade-in zoom-in-95 duration-200 py-1">
                        {['최신순', '인기순'].map((type) => (
                          <button
                            key={type}
                            onClick={() => { setSortType(type as SortType); setIsSortOpen(false); }}
                            className={`w-full px-5 py-3 text-left text-[11px] font-semibold transition-colors hover:bg-neutral-800/50 ${sortType === type ? 'text-white' : 'text-neutral-500'}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Custom Category Dropdown */}
                  <div className="relative" ref={categoryRef}>
                    <button
                      onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                      className="flex items-center justify-between gap-3 bg-neutral-900/60 text-neutral-400 text-[11px] font-semibold h-10 px-5 rounded-xl hover:bg-neutral-800 hover:text-neutral-200 transition-all focus:outline-none min-w-[120px]"
                    >
                      <span>{selectedCategory}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform duration-300 ${isCategoryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isCategoryOpen && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-[#0a0a0a]/90 backdrop-blur-xl rounded-2xl overflow-hidden z-50 shadow-2xl animate-in fade-in zoom-in-95 duration-200 py-1 max-h-[320px] overflow-y-auto scrollbar-hide">
                        {CATEGORIES.map((category) => (
                          <button
                            key={category}
                            onClick={() => { setSelectedCategory(category); setIsCategoryOpen(false); }}
                            className={`w-full px-5 py-3 text-left text-[11px] font-semibold transition-colors hover:bg-neutral-800/50 ${selectedCategory === category ? 'text-white' : 'text-neutral-500'}`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <section className="w-full space-y-8">
                  {filteredPromptSentences.length > 0 ? (
                    filteredPromptSentences.map((item) => (
                      <PromptCard
                        key={item.id}
                        item={item}
                        onClick={() => {
                          if (item.originalPost.isSinglePrompt) {
                            showToast("단일 프롬프트로 업데이트 된 포스트입니다.");
                          } else {
                            setSelectedPost(item.originalPost);
                          }
                        }}
                        onCopy={() => handlePromptCopy(item.text)}
                      />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-neutral-600 space-y-4">
                      <p className="text-[10px] font-semibold">{selectedCategory !== '전체' ? `No results for "${selectedCategory}"` : "No sentences matching your search"}</p>
                      <button onClick={() => { setSearchQuery(''); setSelectedCategory('전체'); setSortType('최신순'); }} className="text-[9px] border-b border-neutral-800 pb-1 hover:text-neutral-400">Clear all filters</button>
                    </div>
                  )}
                </section>
              </div>
            ) : activeTab === 'make' ? (
              <MakeTab archivePosts={posts} />
            ) : (
              <UpdateTab posts={posts} setPosts={setPosts} />
            )}
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isSubmitting && setIsModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg"><PostForm onSubmit={handlePostSubmit} onClose={() => setIsModalOpen(false)} isSubmitting={isSubmitting} initialData={editingPost} /></div>
        </div>
      )}

      {selectedPost && <PostDetail post={selectedPost} onClose={() => setSelectedPost(null)} />}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-white text-black px-6 py-3 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {toastMessage}
          </div>
        </div>
      )}

      {isPromptModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isSubmitting && setIsPromptModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg">
            <PromptForm
              onSubmit={handlePromptSubmit}
              onClose={() => setIsPromptModalOpen(false)}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;