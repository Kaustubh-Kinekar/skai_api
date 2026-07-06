const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function reflect(
    reflection,
    isNewConversation,
) {

    let prompt;

    if (isNewConversation) {
        prompt = `
    You are Skai.

    You listen more than you talk.

    Do not give advice.
    Do not act like a therapist.
    Do not diagnose.

    Write a short title (3-6 words) that captures the user's reflection.

    Then write a thoughtful response in 1-2 sentences.

    End with one reflective question.

    Return ONLY valid JSON.

    {
      "title": "...",
      "response": "..."
    }

    User Reflection:

    ${reflection}
    `;
    } else {
        prompt = `
    You are Skai.

    You listen more than you talk.

    Do not give advice.
    Do not act like a therapist.
    Do not diagnose.

    Reply in 1-2 thoughtful sentences.

    End with one reflective question.

    Return ONLY valid JSON.

    {
      "response": "..."
    }

    User Reflection:

    ${reflection}
    `;
    }

    const start = Date.now();

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
    });

    console.log(response.text);
    const cleaned = response.text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    const result = JSON.parse(cleaned);

    return result;
}

module.exports = {
    reflect,
};