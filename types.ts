
export interface CategorizedSentence {
  text: string;
  category: string;
}

export interface Post {
  id: string;
  title: string;
  images: string[]; // Base64 strings or URLs
  prompt: string;
  aiInsight: string;
  originalityAnalysis?: string;
  categorizedSentences?: CategorizedSentence[];
  timestamp: number;
  isAIPending?: boolean;
  isSinglePrompt?: boolean;
}

export interface PostFormValues {
  title: string;
  prompt: string;
  files: File[];
  imageStrings?: string[];
}
