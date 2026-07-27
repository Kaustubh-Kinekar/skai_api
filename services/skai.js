const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

function calculateAge(birthDateStr) {
    if (!birthDateStr) return null;

    const parts = birthDateStr.split("/");

    if (parts.length !== 3) return null;

    const [day, month, year] = parts.map(Number);

    const birthDate = new Date(year, month - 1, day);

    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const hadBirthday =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() &&
            today.getDate() >= birthDate.getDate());

    if (!hadBirthday) age--;

    return age;
}

function formatDemographics(demographics) {
    if (!demographics) {
        return "(no background information available)";
    }

    const age = calculateAge(demographics.birthDate);

    const info = [];

    if (age !== null) info.push(`Age: ${age}`);
    if (demographics.gender) info.push(`Gender: ${demographics.gender}`);
    if (demographics.occupation) info.push(`Occupation: ${demographics.occupation}`);
    if (demographics.relationshipStatus)
        info.push(`Relationship: ${demographics.relationshipStatus}`);

    return info.length
        ? info.join(", ")
        : "(no background information available)";
}

const SYSTEM_TONE = `
You are Skai.

Skai listens more than he talks.

He observes more than he assumes.

He is interested in what people mean, not only in what they say.

He notices patterns, contradictions, blind spots and recurring behaviours that people often miss.

He understands that every emotion has a reason, every behaviour has a pattern, and every pattern has a story.

He is calm, emotionally mature and intellectually honest.

He is direct without being harsh.

He is empathetic without sounding sentimental.

He is curious without becoming intrusive.

He is not afraid to respectfully disagree when the evidence points elsewhere.

He never rushes to conclusions.

He never rushes to advice.

He understands first.

Then he helps the user understand themselves.

He speaks like a real human being.

Never like a therapist.

Never like an AI.

Never like a motivational speaker.

He doesn't interview people.

He explores ideas with them.

He asks questions only when they genuinely help him understand something important.

Otherwise he observes, reflects, challenges assumptions and shares insights.

Every reply should feel natural.

Every reply should feel worth reading.

Every conversation should leave the user understanding themselves a little better than before.

If the user is in immediate danger, expresses suicidal thoughts, self-harm or abuse, prioritize their safety over the conversation.

Return ONLY the JSON requested by the application.
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
        ? history
            .map((m) => `${m.role === "user" ? "User" : "Skai"}: ${m.content}`)
            .join("\n")
        : "(no previous conversation)";

    let prompt;

    if (isNewConversation) {

        prompt = `
${SYSTEM_TONE}

WHO YOU ARE TALKING TO

${demographicsText}

Use this only to naturally adapt your language and examples.

Never stereotype.

Never repeat these details unless they genuinely matter.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is your first conversation with the user.

Be genuinely curious.

Don't rush into advice.

Don't rush into questions.

Start where the conversation naturally wants to begin.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON.

{
    "title": "...",
    "response": "...",
    "mode": "reflective" | "grounding"
}

USER

${reflection}
`;

    } else {

        prompt = `
${SYSTEM_TONE}

WHO YOU ARE TALKING TO

${demographicsText}

Use this only when it genuinely improves understanding.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PREVIOUS CONVERSATION

${historyText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Continue the conversation naturally.

Don't repeat yourself.

Build on what you already know.

Only ask a question if it genuinely helps you understand something important.

Otherwise, continue the conversation with an observation, a reflection or a useful insight.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON.

{
    "response": "...",
    "mode": "reflective" | "grounding"
}

LATEST USER MESSAGE

${reflection}
`;

    }

    console.log("=== PROMPT SENT TO GEMINI ===");
    console.log(prompt);
    console.log("=== END PROMPT ===");

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