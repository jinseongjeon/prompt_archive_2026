
// Simple persistent cache for translations
const CACHE_KEY = 'prompt_translation_cache';

const getCache = (): Record<string, string> => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

const setCache = (text: string, translation: string) => {
  try {
    const cache = getCache();
    cache[text] = translation;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to update translation cache", e);
  }
};

/**
 * Uses a public Google Translate endpoint for fast, free translation.
 */
export const translateText = async (text: string, targetLanguage: string = "ko"): Promise<string> => {
  // Map language names to codes if necessary
  const langCode = targetLanguage.toLowerCase() === 'korean' ? 'ko' : targetLanguage;
  
  // Check cache first
  const cache = getCache();
  if (cache[text]) {
    return cache[text];
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langCode}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Translation request failed");
    
    const data = await response.json();
    // Google Translate response format: [[["translated", "original", ...], ...]]
    const translated = data[0].map((item: any) => item[0]).join('');
    
    if (translated) {
      setCache(text, translated);
    }
    
    return translated || "Translation failed.";
  } catch (error) {
    console.error("Translation Error:", error);
    return "Error during translation.";
  }
};
