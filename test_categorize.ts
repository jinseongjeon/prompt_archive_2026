import { categorizeSentence } from './utils/promptUtils';

const testCases = [
    "The subject must wear the exact same outfit from the uploaded source image.",
    "Maintain original composition.",
    "Do not center the subject.",
    "Handheld perspective.",
    "The 3:4 ratio must be preserved."
];

testCases.forEach(text => {
    console.log(`Text: "${text}" --> Category: ${categorizeSentence(text)}`);
});
