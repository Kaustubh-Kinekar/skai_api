require("dotenv").config();

const express = require("express");
const cors = require("cors");

const reflectRoutes = require("./routes/reflect");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/reflect", reflectRoutes);

app.get("/", (req, res) => {
    res.send("🚀 Skai API is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Skai API running on port ${PORT}`);
});