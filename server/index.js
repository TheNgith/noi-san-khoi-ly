const express = require("express");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = 3000;

// Path to your JSON "database"
const DATA_FILE = path.join(__dirname, "data", "comments.json");

// Serve frontend from ../client
const CLIENT_DIR = path.join(__dirname, "..", "client");

// Middleware to parse JSON bodies
app.use(express.json());

// (Optional) Simple CORS if you serve frontend from another port
// If you're serving index.html from the same Express app, you can remove this.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Serve static frontend
app.use(express.static(CLIENT_DIR));

// Utility: read all comments from file
async function readComments() {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (err) {
    // If file doesn't exist, start with empty array
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

// Utility: write all comments to file
async function writeComments(comments) {
  const json = JSON.stringify(comments, null, 2);
  await fs.writeFile(DATA_FILE, json, "utf8");
}

// GET /api/comments?imageId=...
// Returns list of comments for that image
app.get("/api/comments", async (req, res) => {
  try {
    const imageId = req.query.imageId;

    if (!imageId) {
      return res
        .status(400)
        .json({ error: "Missing required query parameter: imageId" });
    }

    const allComments = await readComments();
    const filtered = allComments.filter(
      (c) => c.imageId === imageId
    );

    res.json(filtered);
  } catch (err) {
    console.error("Error in GET /api/comments:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/comments
// Body: { imageId, xPct, yPct, text, author, createdAt? }
app.post("/api/comments", async (req, res) => {
  try {
    const { imageId, xPct, yPct, text, author, createdAt, chapter } = req.body;
    console.log("Server received:", req.body);

    if (!imageId || typeof imageId !== "string") {
      return res.status(400).json({ error: "imageId is required" });
    }
    if (typeof xPct !== "number" || typeof yPct !== "number") {
      return res
        .status(400)
        .json({ error: "xPct and yPct must be numbers between 0 and 1" });
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }

    const clampedX = Math.min(Math.max(xPct, 0), 1);
    const clampedY = Math.min(Math.max(yPct, 0), 1);

    const newComment = {
      id:
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2),
      imageId,
      xPct: clampedX,
      yPct: clampedY,
      text: text.trim(),
      author: author.trim(),
      createdAt: createdAt || new Date().toISOString(),
      chapter: chapter.trim()
    };

    const comments = await readComments();
    comments.push(newComment);
    await writeComments(comments);

    res.status(201).json(newComment);
  } catch (err) {
    console.error("Error in POST /api/comments:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fallback: send index.html for any other route (SPA style)
app.get("*", (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
