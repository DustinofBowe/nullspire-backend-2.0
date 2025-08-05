const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
const FRONTEND_URL = "https://nullspire-frontend-pi.vercel.app";

app.use(cors({
  origin: [
    FRONTEND_URL,
    "https://nullspire-frontend-ktmwv3kmz-dustinofbowes-projects.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Password"]
}));

app.use(bodyParser.json());

const ADMIN_PASSWORD = "ChatGPT123";
const dataFilePath = path.join(__dirname, "data.json");

let approvedCharacters = [];
let pendingCharacters = [];
let nextId = 1;

// Load data on server start
function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
    approvedCharacters = data.approvedCharacters || [];
    pendingCharacters = data.pendingCharacters || [];
    nextId = data.nextId || 1;
    console.log("✅ Data loaded from data.json");
  } catch (error) {
    console.warn("⚠️ Could not load data.json. Starting with empty data.");
  }
}

// Save data on every change
function saveData() {
  const data = {
    approvedCharacters,
    pendingCharacters,
    nextId
  };
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    console.log("💾 Data saved to data.json");
  } catch (error) {
    console.error("❌ Failed to save data:", error);
  }
}

loadData();

// === API ROUTES ===

// GET approved characters (search by partial name)
app.get("/api/characters", (req, res) => {
  const nameQuery = (req.query.name || "").toLowerCase();
  const matches = approvedCharacters.filter(c =>
    c.name.toLowerCase().includes(nameQuery)
  );
  if (matches.length > 0) {
    res.json(matches);
  } else {
    res.status(404).json({ error: "Character not found." });
  }
});

// SUBMIT new character
app.post("/api/submit", (req, res) => {
  const { name, level, organization, profession } = req.body;
  if (!name || !level || !organization || !profession) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const newChar = {
    id: nextId++,
    name,
    level,
    organization,
    profession
  };
  pendingCharacters.push(newChar);
  saveData();
  res.json({ message: "Submission received, pending approval." });
});

// === ADMIN AUTH MIDDLEWARE ===
function checkAdminPassword(req, res, next) {
  const password = req.headers["x-admin-password"];
  if (password === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// GET all pending
app.get("/api/pending", checkAdminPassword, (req, res) => {
  res.json(pendingCharacters);
});

// APPROVE character
app.post("/api/pending/approve", checkAdminPassword, (req, res) => {
  const { id } = req.body;
  const index = pendingCharacters.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ error: "Not found" });

  const [approved] = pendingCharacters.splice(index, 1);
  approvedCharacters.push(approved);
  saveData();
  res.json({ message: "Character approved", character: approved });
});

// REJECT character
app.post("/api/pending/reject", checkAdminPassword, (req, res) => {
  const { id } = req.body;
  const index = pendingCharacters.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ error: "Not found" });

  pendingCharacters.splice(index, 1);
  saveData();
  res.json({ message: "Character rejected" });
});

// GET all approved
app.get("/api/approved", checkAdminPassword, (req, res) => {
  res.json(approvedCharacters);
});

// DELETE character
app.post("/api/approved/delete", checkAdminPassword, (req, res) => {
  const { id } = req.body;
  const index = approvedCharacters.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ error: "Not found" });

  approvedCharacters.splice(index, 1);
  saveData();
  res.json({ message: "Character deleted" });
});

// EDIT character
app.post("/api/approved/edit", checkAdminPassword, (req, res) => {
  const { id, field, value } = req.body;
  const char = approvedCharacters.find(c => c.id === id);
  if (!char) return res.status(404).json({ error: "Not found" });

  if (!["name", "level", "organization", "profession"].includes(field)) {
    return res.status(400).json({ error: "Invalid field" });
  }

  char[field] = value;
  saveData();
  res.json({ message: "Character updated", character: char });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend API running on port ${PORT}`);
});
