const { GoogleGenAI } = require("@google/genai");
const db = require("../config/firebase");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const UPDATE_EVERY_N_MESSAGES = 6;

const PROFILE_PROMPT_INSTRUCTIONS = `
You maintain a quiet, evolving understanding of a person based on their reflective conversations — the way a caring, attentive friend would slowly get to know someone over many conversations, not a clinical file.

Rules:
- Never diagnose or name a condition, disorder, or clinical pattern.
- Only include things with real evidence from what they've actually said — no speculation dressed up as insight.
- Revise and correct the existing profile using new evidence; don't just pile on more text. If something in the old profile no longer seems to hold up, soften or remove it.
- Write in plain, warm language — like describing a friend to another friend, not writing a report.
- Keep it compact. This is a living sketch, not an exhaustive record.
- Never record anything the person said in a moment of crisis as a "pattern" — treat crisis moments as situational, not identity.

Return ONLY valid JSON in this exact shape:
{
  "summary": "2-4 warm, plain sentences describing this person, grounded in what they've actually shared",
  "patterns": ["short phrases naming recurring behavioral or emotional patterns actually observed"],
  "drawsEnergy": ["things that seem to genuinely light this person up, based on how they talk about them"],
  "drainsEnergy": ["things that seem to wear this person down, based on how they talk about them"],
  "openThreads": ["things mentioned but not yet explored — labels used without explanation, topics touched then dropped"]
}
`;

async function maybeUpdateProfile(userId, conversationId, wasSuccessfulMessage = true) {
if (!wasSuccessfulMessage) {
        console.log(`Skipping profile count for ${userId} — message failed`);
        return;
    }
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const existing = userDoc.exists ? userDoc.data() : {};
    const currentProfile = existing.profile || null;

    const messageCountSince = (existing.messageCountSinceProfileUpdate || 0) + 1;

    if (messageCountSince < UPDATE_EVERY_N_MESSAGES) {
        await userRef.set({ messageCountSinceProfileUpdate: messageCountSince }, { merge: true });
        console.log(`Profile update skipped for ${userId} (${messageCountSince}/${UPDATE_EVERY_N_MESSAGES} messages)`);
        return;
    }

    const recentSnap = await db
        .collection("conversations")
        .doc(conversationId)
        .collection("messages")
        .orderBy("createdAt", "desc")
        .limit(UPDATE_EVERY_N_MESSAGES)
        .get();

    const recentMessages = recentSnap.docs.map((doc) => doc.data()).reverse();
    const transcript = recentMessages
        .map((m) => `${m.role === "user" ? "User" : "Skai"}: ${m.content}`)
        .join("\n");

    const prompt = `
${PROFILE_PROMPT_INSTRUCTIONS}

Existing profile (may be empty if this is the first update):
${JSON.stringify(currentProfile || {})}

Recent conversation:
${transcript}
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
        });

        const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
        const updatedProfile = JSON.parse(cleaned);

        await userRef.set(
            { profile: updatedProfile, messageCountSinceProfileUpdate: 0 },
            { merge: true }
        );

        console.log("Profile updated for user:", userId, JSON.stringify(updatedProfile, null, 2));
    } catch (err) {
        console.error("Profile update failed:", err);
        // Leave existing profile untouched, just reset the counter so we don't retry-storm
        await userRef.set({ messageCountSinceProfileUpdate: 0 }, { merge: true });
    }
}

module.exports = { maybeUpdateProfile };