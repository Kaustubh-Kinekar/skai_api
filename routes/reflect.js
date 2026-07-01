const { reflect } = require("../services/gemini");

const db = require("../config/firebase");

const express = require("express");

const router = express.Router();

router.post("/", async (req, res) => {

    try {

        console.log("1. Request received");

        const { conversationId, message } = req.body;

        let currentConversationId = conversationId;

        console.log("2. Message:", message);

        //await db.collection("test").add({
        //    message: message,
        //    createdAt: new Date(),
        //});

        if (!currentConversationId) {

            const conversationRef = await db.collection("conversations").add({
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            currentConversationId = conversationRef.id;
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

        console.log("3. Saved to Firestore");

        const response = await reflect(message);

        await db
            .collection("conversations")
            .doc(currentConversationId)
            .collection("messages")
            .add({
                role: "skai",
                content: response,
                createdAt: new Date(),
            });

        console.log("4. Gemini replied");

        res.json({
            conversationId: currentConversationId,
            response,
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Something went wrong.",
        });

    }

});

module.exports = router;