const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const BOOK_PATH = path.join(
    __dirname,
    "../docs/THE_BOOK_OF_SKAI.md"
);

const SKAI_BOOK = fs.readFileSync(
    BOOK_PATH,
    "utf8"
);

function calculateAge(birthDateStr) {
    if (!birthDateStr) return null;
    const parts = birthDateStr.split("/"); // format: "day/month/year"
    if (parts.length !== 3) return null;

    const [day, month, year] = parts.map(Number);
    const birthDate = new Date(year, month - 1, day);
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const hasHadBirthdayThisYear =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
    if (!hasHadBirthdayThisYear) age--;

    return age;
}

function formatDemographics(demographics) {
    if (!demographics) return "(no background info available yet)";

    const age = calculateAge(demographics.birthDate);
    const parts = [];
    if (age !== null) parts.push(`Age: ${age}`);
    if (demographics.gender) parts.push(`Gender: ${demographics.gender}`);
    if (demographics.occupation) parts.push(`Occupation: ${demographics.occupation}`);
    if (demographics.relationshipStatus) parts.push(`Relationship status: ${demographics.relationshipStatus}`);

    return parts.length ? parts.join(", ") : "(no background info available yet)";
}

const SYSTEM_TONE = `
The following document defines who you are.

It is not reference material.

It is your mind.

Before every observation, question, deduction, conclusion and response, silently think through these principles.

Do not quote this document.

Do not summarize this document.

Do not mention this document.

Let every observation, deduction, question, conclusion and guidance naturally emerge from it.

${SKAI_BOOK}
`;

async function reflect(
    reflection,
    isNewConversation,
    history = [],
    userProfile = null,
    demographics = null,
) {

    const demographicsText = formatDemographics(demographics);

    const historyText = history.length
        ? history.map((m) => `${m.role === "user" ? "User" : "Skai"}: ${m.content}`).join("\n")
        : "(no prior messages)";

    let prompt;

    if (isNewConversation) {
        prompt = `
${SYSTEM_TONE}

Who you're talking with: ${demographicsText}
Calibrate your tone, assumptions, and the kind of language you use to fit someone with this background — the way a genuinely thoughtful person naturally adjusts based on who they're talking to. Don't state these details back to them directly unless it's clearly relevant to what they're saying.

This is the start of a new reflection.

Return ONLY valid JSON:

{
  "title": "...",       // 3-6 words
  "response": "...",    // per the mode you selected
  "mode": "reflective" | "grounding"
}

User Reflection:

${reflection}
`;
    } else {
        prompt = `
        You are Skai.

        Everything below defines who you are.

        Do not treat it as instructions to quote.

        Do not summarize it.

        Do not explain it.

        Silently adopt it before you think.

        Every observation, question, deduction, conclusion and response must naturally emerge from it.

${SYSTEM_TONE}

Who you're talking with: ${demographicsText}
Calibrate your thinking, language and examples naturally to this person's background. Never stereotype or over-rely on demographic information. Use it only when it genuinely improves understanding.
Conversation so far:
${historyText}

Continue the reflection, using the conversation above for context. Respond to the latest message below.

Return ONLY valid JSON:

{
  "response": "...",
  "mode": "reflective" | "grounding"
}

Latest message:

${reflection}
`;
    }

    console.log("=== PROMPT SENT TO GEMINI ===\n", prompt, "\n=== END PROMPT ===");

    let result;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        console.log(response.text);
        const cleaned = response.text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        result = JSON.parse(cleaned);
    } catch (err) {
        console.error("Gemini call/parse failed:", err);
        result = {
            title: "Reflection",
            response:
            "I’m having trouble responding right now. I don’t want to guess or give you a careless answer. If what you’re dealing with is urgent or you're in immediate danger, please reach out to someone you trust or a crisis service while I’m unavailable.",
            mode: "grounding",
            failed: true,
        };
    }

    if (result.mode === "grounding") {
        result.crisisResources = true;
    }

    return result;
}

module.exports = {
    reflect,
};