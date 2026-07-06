const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

let serviceAccount;

if (process.env.RENDER) {
  // Running on Render
  serviceAccount = require("/etc/secrets/serviceAccountKey.json");
} else {
  // Running loc=ally
  serviceAccount = require("./serviceAccountKey.json");
}

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

module.exports = db;