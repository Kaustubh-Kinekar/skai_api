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

module.exports = router;