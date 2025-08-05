const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
const ADMIN_PASSWORD = "ChatGPT123";
const dataFilePath = path.join(__dirname, "data.json");

// === Allow frontends ===
const allowedOrigins = [
  "https://nullspire-frontend-pi.vercel.app",
  "https://nullspire-frontend-ktmwv3kmz-dustinofbowes-projects.vercel.app",
  "https://nullspire-frontend-v2-0.vercel.app"
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Password"]
}));

app.use(bodyParser.json());

// === Character Storage ===
let approvedCharacters = [];
let pendingCharacters = [];
let nextId = 1;

// === Load from data.json ===
function loadData() {
  try {
    const raw = fs.readFileSync(dataFilePath, "utf8");
    const data = JSON.parse(raw);
    approvedCharacters = data.approvedCharacters || [];
    pendingCharacters = data.pendingCharacters || [];
    nextId = data.nextId || 1;
    console.log("✅ Data loaded from data.json");
  } catch {
    console.warn("⚠️ Starting fresh. data.json missing or invalid.");
  }
}

// === Save to data.json ===
function saveData() {
  const data = { approvedCharacters, pendingCharacters, nextId };
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    console.log("💾 Data saved to data.json");
  } catch (err) {
    console.error("❌ Failed to write to data.json:", err);
  }
}

loadData();

// === Public: Lookup Characters ===
app.get("/api/characters", (req, res) => {
  const query = (req.query.name || "").toLowerCase();
  const matches = approvedCharacters.filter(c =>
    c.name.toLowerCase().includes(query)
  );
  if (matches.length) res.json(matches);
  else res.status(404).json({ error: "Character not found." });
});

// === Public: Submit New Character ===
app.post("/api/submit", (req, res) => {
  const { name, level, organization, profession } = req.body;
  if (!name || !level || !organization || !profession) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const newChar = { id: nextId++, name, level, organization, profession };
  pendingCharacters.push(newChar);
  saveData();
  res.json({ message: "Submission received, pending approval." });
});

// === Admin Middleware ===
function checkAdminPassword(req, res, next) {
  const pass = req.headers["x-admin-password"];
  if (pass === ADMIN_PASSWORD) next();
  else res.status(401).json({ error: "Unauthorized" });
}

// === Admin Routes ===
app.get("/api/pending", checkAdminPassword, (req, res) => {
  res.json(pendingCharacters);
});

app.post("/api/pending/approve", checkAdminPassword, (req, res) => {
  const { id } = req.body;
  const index = pendingCharacters.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ error: "Not found" });
  const [approved] = pendingCharacters.splice(index, 1);
  approvedCharacters.push(approved);
  saveData();
  res.json({ message: "Character approved", character: approved });
});

app.post("/api/pending/reject", checkAdminPassword, (req, res) => {
  const { id } = req.body;
  const index = pendingCharacters.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ error: "Not found" });
  pendingCharacters.splice(index, 1);
  saveData();
  res.json({ message: "Character rejected" });
});

app.get("/api/approved", checkAdminPassword, (req, res) => {
  res.json(approvedCharacters);
});

app.post("/api/approved/delete", checkAdminPassword, (req, res) => {
  const { id } = req.body;
  const index = approvedCharacters.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ error: "Not found" });
  approvedCharacters.splice(index, 1);
  saveData();
  res.json({ message: "Character deleted" });
});

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

// === Start Server ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
