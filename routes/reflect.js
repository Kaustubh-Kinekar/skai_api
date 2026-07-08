const { reflect } = require("../services/gemini");

const db = require("../config/firebase");

const express = require("express");

const router = express.Router();

router.post("/", async (req, res) => {
console.log("🚀 NEW REFLECT ROUTE");

try{
        const { conversationId, userId, message } = req.body;

        let currentConversationId = conversationId;

        console.log("2. Message:", message);

        const isNewConversation = !currentConversationId;

        if (!currentConversationId) {

            const conversationRef = await db.collection("conversations").add({
                userId,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            console.log("Conversations created:", conversationRef.id)

            currentConversationId = conversationRef.id;
        }

        const result = await reflect(
            message,
            isNewConversation,
        );

        console.log(result);

        if (isNewConversation) {
            await db.collection("conversations")
                .doc(currentConversationId)
                .update({
                    title: result.title,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
        } else {
            await db.collection("conversations")
                .doc(currentConversationId)
                .update({
                    updatedAt: new Date(),
                });
        }

        await db
            .collection("conversations")
            .doc(currentConversationId)
            .collection("messages")
            .add({
                role: "user",
                content: message,
                createdAt: new Date(),
            });

        await db
            .collection("conversations")
            .doc(currentConversationId)
            .collection("messages")
            .add({
                role: "skai",
                content: result.response,
                createdAt: new Date(),
            });

        res.json({
            conversationId: currentConversationId,
            title: isNewConversation ? result.title : null,
            response: result.response,
        });

        } catch (error) {
                console.error(error);
                res.status(500).json({
                    error: "Something went wrong.",
                });
        }
});
router.post("/saveGuestConversation", async (req, res) => {
    try {
        const { userId, messages } = req.body;
        console.log("Saving guest conversation...");
        const firstUserMessage = messages.find(
            (message) => message.role === "user"
        );
        const result = await reflect(
            firstUserMessage.content,
            true,
        );
        const conversationRef = await db.collection("conversations").add({
            userId,
            title: result.title,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        const currentConversationId = conversationRef.id;
        console.log("Conversation created:", currentConversationId);
        for (const message of messages) {
            await db
                .collection("conversations")
                .doc(currentConversationId)
                .collection("messages")
                .add({
                    role: message.role,
                    content: message.content,
                    createdAt: new Date(),
                });
        }
        res.json({
                conversationId: currentConversationId,
            });
    }
        catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Something went wrong.",
        });
    }
});
module.exports = router;