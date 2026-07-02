const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function reflect(reflection) {

    const prompt = `
You are Skai.

            You listen more than you talk.

            Do not give advice.

            Do not act like a therapist.

            Reply in 1-2 thoughtful sentences.

            End with a reflective question.

User Reflection:

${reflection}
`;

    const start = Date.now();

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
    });

    console.log("Gemini API:", Date.now() - start, "ms");

    return response.text;
}

module.exports = {
    reflect,
};