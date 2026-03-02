export const splitIntoSentences = (text: string): string[] => {
    if (!text) return [];

    // First split by obvious punctuation
    const sentences = text
        .split(/(?<=[.!?])\s+|\n+/) // Split by .!? AND newlines
        .map(s => {
            // Clean up bullet points, headers, and extra symbols
            return s.trim()
                .replace(/^[-*•]\s+/, '') // Remove bullet points at start
                .replace(/^\[.*\]\s*/, '') // Remove brackets like [Absolute Subject Rules]
                .replace(/^[A-Z\s&]+(\(.*\))?:\s*/, ''); // Remove headers like "CAMERA & FLASH (EXTREMELY IMPORTANT):"
        })
        .map(s => s.trim())
        .filter(s => s.length > 3); // Filter out very short remnants or headers

    return sentences;
};

export const CATEGORIES = [
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

/**
 * AI가 반환하는 카테고리 이름을 표준 CATEGORIES 목록의 이름으로 정규화합니다.
 * 공백, 특수문자(&, 괄호 주변 공백) 차이를 무시하고 매칭합니다.
 */
export const normalizeCategory = (category: string): string => {
    if (!category) return '주제';

    // 공백 제거 + & 통일 + 소문자 비교용 정규화
    const normalize = (s: string) =>
        s.replace(/\s+/g, '')
            .replace(/&amp;/g, '&')
            .replace(/＆/g, '&')
            .toLowerCase();

    const normalizedInput = normalize(category);

    const match = CATEGORIES.find(c => normalize(c) === normalizedInput);
    return match || category;
};

export const detectDomain = (text: string): 'UI' | 'GENERAL' => {
    if (!text) return 'GENERAL';
    const lower = text.toLowerCase();
    const uiKeywords = ['ui', 'ux', 'user interface', 'website', 'app screen', 'dashboard', 'thumbnail', 'button', 'layout', 'margin', 'padding', 'corner radii', 'ios-style'];
    let score = 0;
    for (const kw of uiKeywords) {
        if (lower.includes(kw)) score++;
    }
    return score >= 1 ? 'UI' : 'GENERAL';
};

export const categorizeSentence = (sentence: string, hintCategory?: string, fullPrompt?: string): string => {
    const lower = sentence.toLowerCase();
    const domain = detectDomain(fullPrompt || sentence);

    // Exact names as provided in the new 12 categories
    const categories = {
        SUBJECT: '주제',
        OUTFIT: '의상',
        COMPOSITION: '화면구성',
        NEGATIVE: '규칙 선언(부정)',
        ORIGINAL: '원본 유지',
        CAMERA: '카메라 구도',
        LIGHTING: '조명',
        STYLE: '이미지 스타일',
        MATERIAL: '재질',
        COLOR: '색감 & 톤',
        EMOTION: '감정',
        POSE: '포즈'
    };

    // 1. [Functional Priority: 원본 유지]
    // If it demands preservation of the uploaded source
    const preservationKeywords = ['preserve', 'keep', 'maintain', 'identical', '100%', 'source image', 'uploaded', 'reference image', 'original', 'consistency', 'same as'];
    if (preservationKeywords.some(kw => lower.includes(kw))) {
        return categories.ORIGINAL;
    }

    // 2. [Functional Priority: 규칙 선언(부정)]
    // If it is a prohibition
    const negativeKeywords = ['must not', 'should not', 'do not', 'don\'t', 'never', 'avoid', 'exclude', 'strictly no', 'without', 'negative', 'no '];
    if (negativeKeywords.some(kw => lower.includes(kw))) {
        return categories.NEGATIVE;
    }

    // 3. [Domain Category: SUBJECT (주제)]
    // In UI context, structural elements often belong to SUBJECT
    if (domain === 'UI') {
        const uiSubjectKeywords = ['thumbnail', 'corner', 'radii', 'button', 'icon', 'header', 'card', 'layout', 'ui', 'screen'];
        if (uiSubjectKeywords.some(kw => lower.includes(kw))) return categories.SUBJECT;
    }

    // 4. [Attribute Classification]
    const rules = [
        { category: categories.OUTFIT, keywords: ['wear', 'dress', 'outfit', 'shirt', 'jacket', 'armor', 'clothing', 'suit', 'garment', 'accessory', 'hat', 'shoes', 'boots', 'necktie', 'tie', 'knot', 'pinstripe', 'fabric', 'collar', 'glasses', 'spectacles'] },
        { category: categories.LIGHTING, keywords: ['light', 'sun', 'neon', 'glow', 'shadow', 'illumination', 'volumetric', 'flash', 'bright', 'dark', 'ray', 'beam', 'shine', 'highlight', 'exposure'] },
        { category: categories.CAMERA, keywords: ['angle', 'shot', 'view', 'close-up', 'closeup', 'wide', 'extreme', 'perspective', 'eye-level', 'low-angle', 'high-angle', 'fisheye', 'viewpoint', 'telephoto', 'macro'] },
        { category: categories.STYLE, keywords: ['style', 'art', 'render', 'cyberpunk', 'anime', 'photorealistic', 'oil painting', 'sketch', 'digital painting', 'cinematic', 'authentic', 'realistic', 'cgi', 'illustration'] },
        { category: categories.COLOR, keywords: ['color', 'tone', 'vibrant', 'warm', 'cool', 'palette', 'saturated', 'monochrome', 'black and white', 'pastel', 'vivid', 'gradient'] },
        { category: categories.POSE, keywords: ['pose', 'stand', 'sit', 'run', 'walk', 'jump', 'lean', 'lie', 'holding', 'gesturing', 'reaching', 'turned', 'looking'] },
        { category: categories.EMOTION, keywords: ['emotion', 'mood', 'smile', 'look', 'feel', 'angry', 'sad', 'happy', 'serious', 'expression', 'laugh', 'calm', 'neutral', 'vibe'] },
        { category: categories.MATERIAL, keywords: ['material', 'texture', 'metal', 'skin', 'wood', 'plastic', 'glass', 'glossy', 'matte', 'rough', 'smooth', 'fur', 'porcelain', 'sheen', 'moisture', 'frosted', 'reflective'] },
        { category: categories.COMPOSITION, keywords: ['frame', 'composition', 'background', 'foreground', 'layout', 'cinema', 'anamorphic', 'letterbox', 'bokeh', 'depth of field', 'scene', 'framing', 'visible', 'center', 'spatial', 'structure'] },
        { category: categories.SUBJECT, keywords: ['subject', 'woman', 'girl', 'face', 'eyes', 'hair', 'skin', 'makeup', 'lip', 'cheeks', 'nose', 'bangs', 'updo', 'strand', 'forehead', 'chin', 'complexion', 'blush', 'eyeliner', 'lashes'] },
    ];

    for (const rule of rules) {
        if (rule.keywords.some(kw => lower.includes(kw))) return rule.category;
    }

    // Default to SUBJECT
    return hintCategory && CATEGORIES.includes(hintCategory) ? hintCategory : categories.SUBJECT;
};

