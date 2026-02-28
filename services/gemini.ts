
import { GoogleGenAI, Type } from "@google/genai";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.error?.code || (error instanceof Error && (error as any).status);
      const message = error?.message || (error instanceof Error ? error.message : "");

      if (status === 429 || message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || (typeof status === 'number' && status >= 500)) {
        const waitTime = initialDelay * Math.pow(2, i);
        console.warn(`Gemini API busy or limited (Status: ${status}). Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export interface StyleRequirement {
  category: string;
  weight: number; // Importance or number of sentences to fetch (sum should be around 50)
  reasoning: string;
}

export const analyzeStyleRequirement = async (
  description: string,
  imagesBase64: string[]
): Promise<StyleRequirement[]> => {
  return withRetry(async () => {
    const ai = getAIClient();

    const systemInstruction = `
      You are a prompt engineering strategist. 
      Analyze the user's creative vision and reference images.
      Based on this, decide how many prompt example sentences (total 50) from the archive should be provided for each category to best guide the AI in creating THIS specific style.
      
      CATEGORIES: '주제', '의상', '화면 구성', '원본 유지', '규칙 선언 (부정)', '카메라 구도', '조명', '이미지 스타일', '재질', '색감&톤', '감정', '포즈'.
      
      RULES:
      1. Distribute exactly 50 points (weights) across the categories.
      2. If the vision focuses on lighting, give more weight to '조명'.
      3. If it's a character focused shot, give weight to '주제', '의상', '포즈'.
      4. Return the categories in Korean.
    `;

    const promptParts: any[] = [{ text: `${systemInstruction}\n\nVision: "${description}"` }];
    imagesBase64.forEach((base64) => {
      const cleanBase64 = base64.split(',')[1] || base64;
      promptParts.push({
        inlineData: { mimeType: "image/jpeg", data: cleanBase64 },
      });
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: promptParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            requirements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  weight: { type: Type.NUMBER },
                  reasoning: { type: Type.STRING }
                },
                required: ["category", "weight", "reasoning"]
              }
            }
          },
          required: ["requirements"]
        }
      },
    });

    const result = JSON.parse(response.text || '{"requirements": []}');
    return result.requirements;
  });
};

export const generateAIInsight = async (prompt: string, imagesBase64: string[]): Promise<{ insight: string, originality: string, sentences: { text: string, category: string }[] }> => {
  return withRetry(async () => {
    try {
      const ai = getAIClient();

      const systemInstruction = `
        You are an AI assistant analyzing creative prompts for image generation.
        
        Task 1: Provide a brief creative summary in 'insight'.
        Task 2: Identify 'originality preservation' points regarding maintaining features of input images. 
        Format as "- [EN]: ... | [KR]: ...". 
        CRITICAL for Task 2: The [KR] section MUST contain ONLY the Korean translation. Do NOT include English text or English labels within the [KR] section.

        Task 3: Split the user's prompt into individual sentences and categorize EACH sentence into exactly ONE of the 12 predefined categories.
        
        CRITICAL RULE for Task 3: You MUST classify sentences based on FUNCTIONAL INTENT, not surface keywords.

        ABSOLUTE PRIMARY PRINCIPLE:
        - Classify based on what the sentence is functionally demanding, not just what it mentions.
        - Decision Order:
            1. Does it preserve uploaded content? → "원본 유지"
            2. Is it a prohibition (Do not..., No..., etc.)? → "규칙 선언(부정)"
            3. Is it introducing a new attribute? → Classify into its functional domain (Subject, Outfit, etc.)

        EXACT CATEGORIES (Must use these exact names):
        1. 주제: Core subject, main characters, objects. (In UI/UX context, includes UI elements).
        2. 의상: New outfit style or clothing types.
        3. 화면구성: Spatial/structural arrangement, layout, foreground/background.
        4. 규칙 선언(부정): PROHIBITIONS (Do not, Must not, without, etc.).
        5. 원본 유지: Preservation of ANY element from uploaded source (Outfit, Pose, Composition if preserved).
        6. 카메라 구도: NEW camera angles or framing (Selfie, Low angle, Close-up).
        7. 조명: Lighting sources, exposure, flash.
        8. 이미지 스타일: Aesthetic rendering mode (Photorealistic, Cinematic).
        9. 재질: Physical surface quality (Glossy, Matte, Reflective).
        10. 색감 & 톤: Chromatic and tonal control (Palette, Grain, Gradient).
        11. 감정: Emotional tone, atmosphere, vibe.
        12. 포즈: Physical body positioning (Sitting, Standing).

        PRIORITY WARNING:
        - "The subject wears the same outfit as the source" IS "원본 유지", NOT "의상".
        - "Do not use blue lighting" IS "규칙 선언(부정)", NOT "조명".
      `;

      const promptParts: any[] = [{ text: `${systemInstruction}\n\nUser Prompt: "${prompt}"` }];

      imagesBase64.forEach((base64) => {
        const cleanBase64 = base64.split(',')[1] || base64;
        promptParts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64,
          },
        });
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: promptParts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insight: { type: Type.STRING },
              originality: { type: Type.STRING },
              sentences: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    category: { type: Type.STRING }
                  },
                  required: ["text", "category"]
                }
              }
            },
            required: ["insight", "originality", "sentences"]
          }
        },
      });

      const result = JSON.parse(response.text || "{}");

      return {
        insight: result.insight || "AI insight unavailable.",
        originality: result.originality || "None identified",
        sentences: result.sentences || []
      };
    } catch (error) {
      console.error("Gemini Content Generation Error:", error);
      throw error;
    }
  }).catch((err) => {
    console.error("All retries failed for Gemini Insight:", err);
    return {
      insight: "The AI service is currently overwhelmed.",
      originality: "None identified",
      sentences: []
    };
  });
};

export const generateCustomPrompt = async (
  description: string,
  imagesBase64: string[],
  archiveContext: string
): Promise<{ sentences: { text: string, category: string, alternatives: string[] }[] }> => {
  return withRetry(async () => {
    const ai = getAIClient();

    const systemInstruction = `
      You are a world-class prompt engineer. Your goal is to create a high-quality, structured image generation prompt based on a user's vision and reference images.
      
      REAL-TIME LEARNING:
      The user's archive contains the following categorized sentences. Use these as a style guide. 
      ARCHIVE CONTEXT:
      ${archiveContext}

      CATEGORIES AND RULES:
      - '주제': Main subject declaration and attributes.
      - '의상': Clothing, wearables, accessories.
      - '화면 구성': Cinematic framing, composition, layout, letterboxing.
      - '카메라 구도': Angles and distances (close-up, wide shot).
      - '원본 유지': Preserve literal visual identity from source.
      
      Task:
      1. Analyze user vision: "${description}"
      2. For each relevant category, create a primary 'text' and 3 'alternatives'.
      3. Mimic the distinct technical style of the ARCHIVE context.
      
      CATEGORIZATION (Korean): '주제', '의상', '화면 구성', '원본 유지', '규칙 선언 (부정)', '카메라 구도', '조명', '이미지 스타일', '재질', '색감&톤', '감정', '포즈'.
    `;

    const promptParts: any[] = [{ text: `${systemInstruction}` }];

    imagesBase64.forEach((base64) => {
      const cleanBase64 = base64.split(',')[1] || base64;
      promptParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64,
        },
      });
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: promptParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  category: { type: Type.STRING },
                  alternatives: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["text", "category", "alternatives"]
              }
            }
          },
          required: ["sentences"]
        }
      },
    });

    return JSON.parse(response.text || "{\"sentences\": []}");
  });
};

export const generateSingleCategorizedSentence = async (
  category: string,
  description: string,
  imagesBase64: string[],
  archiveContext: string
): Promise<{ text: string, category: string, alternatives: string[] }> => {
  return withRetry(async () => {
    const ai = getAIClient();

    const systemInstruction = `
      You are a world-class prompt engineer. Generate a SINGLE prompt sentence for the category: "${category}".
      
      Vision: "${description}"
      Archive Style Guide:
      ${archiveContext}

      IF CATEGORY IS '주제': Focus on main subject identity.
      IF CATEGORY IS '의상': Focus on garments and accessories.
      IF CATEGORY IS '화면 구성': Focus on overall composition and layout.
      IF CATEGORY IS '카메라 구도': Focus strictly on angles and shots.

      Output: One 'text' and 3 'alternatives' in JSON.
    `;

    const promptParts: any[] = [{ text: `${systemInstruction}` }];

    imagesBase64.forEach((base64) => {
      const cleanBase64 = base64.split(',')[1] || base64;
      promptParts.push({
        inlineData: { mimeType: "image/jpeg", data: cleanBase64 },
      });
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: promptParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            category: { type: Type.STRING },
            alternatives: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["text", "category", "alternatives"]
        }
      },
    });

    return JSON.parse(response.text || "{}");
  });
};
