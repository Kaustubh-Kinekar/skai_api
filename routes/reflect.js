const { reflect } = require("../services/angel");
const { maybeUpdateProfile } = require("../services/userMemory");
const db = require("../config/firebase");
const express = require("express");

const router = express.Router();

const HISTORY_LIMIT = 20; // last N messages sent to Gemini as context

router.post("/", async (req, res) => {
    try {
        const { conversationId, userId, message, persona } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Message is required." });
        }

        let currentConversationId = conversationId;
        const isNewConversation = !currentConversationId;

        if (!currentConversationId) {
            const conversationRef = await db.collection("conversations").add({
                userId: userId || null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            currentConversationId = conversationRef.id;
        }

        // --- fetch prior messages for context (empty array if new) ---
        let history = [];
        if (!isNewConversation) {
            const historySnap = await db
                .collection("conversations")
                .doc(currentConversationId)
                .collection("messages")
                .orderBy("createdAt", "desc")
                .limit(HISTORY_LIMIT)
                .get();

            history = historySnap.docs
                .map((doc) => doc.data())
                .reverse() // back to chronological order
                .map((m) => ({ role: m.role, content: m.content }));
        }

        // --- fetch user profile summary + demographic fields, if any ---
                let userProfile = null;
                let demographics = null;
                if (userId) {
                    const profileDoc = await db.collection("users").doc(userId).get();
                    if (profileDoc.exists) {
                        const userData = profileDoc.data();
                        userProfile = userData.profile || null;
                        demographics = {
                            birthDate: userData.birthDate || null,
                            gender: userData.gender || null,
                            occupation: userData.occupation || null,
                            relationshipStatus: userData.relationshipStatus || null,
                        };
                        console.log("Fetched demographics:", demographics);

                    }
                }

        const geminiModule = persona === "skai" ? require("../services/skai") : require("../services/angel");
        const result = await geminiModule.reflect(message, isNewConversation, history, userProfile, demographics);

        if (isNewConversation) {
            await db.collection("conversations").doc(currentConversationId).update({
                title: result.title,
                updatedAt: new Date(),
            });
        } else {
            await db.collection("conversations").doc(currentConversationId).update({
                updatedAt: new Date(),
            });
        }

        await db
            .collection("conversations")
            .doc(currentConversationId)
            .collection("messages")
            .add({ role: "user", content: message, createdAt: new Date() });

        await db
            .collection("conversations")
            .doc(currentConversationId)
            .collection("messages")
            .add({ role: "skai", content: result.response, createdAt: new Date() });

        res.json({
            conversationId: currentConversationId,
            title: isNewConversation ? result.title : null,
            response: result.response,
            crisisResources: result.crisisResources || false,
        });

        // Fire-and-forget: update the user's long-term profile in the background.
        // Doesn't block the response, doesn't affect this reply.
        if (userId) {
            maybeUpdateProfile(userId, currentConversationId).catch((err) =>
                console.error("Profile update failed:", err)
            );
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Something went wrong.",
            crisisResources: true, // see note below on why this is safer as a default
        });
    }
});

// Link a guest conversation to a signed-in user
router.post("/claimConversation", async (req, res) => {
    try {
        const { conversationId, userId } = req.body;

        if (!conversationId || !userId) {
            return res.status(400).json({ error: "conversationId and userId are required." });
        }

        await db.collection("conversations").doc(conversationId).update({
            userId,
            updatedAt: new Date(),
        });

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong." });
    }
});

// Truncate a conversation after an edited message, then re-send
router.post("/editMessage", async (req, res) => {
    try {
        const { conversationId, editedFromCreatedAt, newMessage, userId } = req.body;

        if (!conversationId || !editedFromCreatedAt || !newMessage) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        const messagesRef = db
            .collection("conversations")
            .doc(conversationId)
            .collection("messages");

        // Delete every message from the edited point onward
        const toDelete = await messagesRef
            .where("createdAt", ">=", new Date(editedFromCreatedAt))
            .get();

        const batch = db.batch();
        toDelete.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        // Now behave exactly like a normal send, reusing the same logic
        req.body = { conversationId, userId, message: newMessage };
        return router.handle(req, res); // re-run the POST / handler
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong." });
    }
});

module.exports = router;