const express = require("express");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3300;

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

// GET /api/comments            → every comment (the reader loads the book at once)
// GET /api/comments?imageId=... → comments for one page
app.get("/api/comments", async (req, res) => {
  try {
    const imageId = req.query.imageId;
    const allComments = await readComments();

    res.json(imageId ? allComments.filter((c) => c.imageId === imageId) : allComments);
  } catch (err) {
    console.error("Error in GET /api/comments:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const MAX_AUTHOR = 40;
const MAX_TEXT = 2000;
const trimmed = (v) => (typeof v === "string" ? v.trim() : "");

// POST /api/comments
// Body: { imageId, xPct, yPct, text, author, cls?, chapter? }
// cls is the writer's own class, free text (e.g. "L1922"); createdAt is set here.
app.post("/api/comments", async (req, res) => {
  try {
    const { imageId, xPct, yPct } = req.body;
    const text = trimmed(req.body.text);
    const author = trimmed(req.body.author);
    const cls = trimmed(req.body.cls);
    const chapter = trimmed(req.body.chapter);

    if (!imageId || typeof imageId !== "string") {
      return res.status(400).json({ error: "imageId is required" });
    }
    if (typeof xPct !== "number" || typeof yPct !== "number") {
      return res
        .status(400)
        .json({ error: "xPct and yPct must be numbers between 0 and 1" });
    }
    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }
    if (!author) {
      return res.status(400).json({ error: "author is required" });
    }
    if (text.length > MAX_TEXT || author.length > MAX_AUTHOR) {
      return res.status(400).json({ error: `author is limited to ${MAX_AUTHOR} characters and text to ${MAX_TEXT}` });
    }
    if (cls.length > MAX_AUTHOR) {
      return res.status(400).json({ error: `cls is limited to ${MAX_AUTHOR} characters` });
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
      text,
      author,
      ...(cls && { cls }),
      createdAt: new Date().toISOString(),
      chapter
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

// "Liên hệ" messages. Kept out of git (they hold readers' emails) and
// never served back: read them in the file.
const MESSAGES_FILE = path.join(__dirname, "data", "messages.json");
const MAX_EMAIL = 254;

// POST /api/messages
// Body: { name, email?, text }; createdAt is set here.
app.post("/api/messages", async (req, res) => {
  try {
    const name = trimmed(req.body.name);
    const email = trimmed(req.body.email);
    const text = trimmed(req.body.text);

    if (!name || !text) {
      return res.status(400).json({ error: "name and text are required" });
    }
    if (name.length > MAX_AUTHOR || text.length > MAX_TEXT || email.length > MAX_EMAIL) {
      return res.status(400).json({ error: `name is limited to ${MAX_AUTHOR} characters, email to ${MAX_EMAIL} and text to ${MAX_TEXT}` });
    }
    if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "email is not valid" });
    }

    let messages = [];
    try {
      const data = await fs.readFile(MESSAGES_FILE, "utf8");
      if (data.trim()) messages = JSON.parse(data);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }

    const message = {
      id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2),
      name,
      ...(email && { email }),
      text,
      createdAt: new Date().toISOString()
    };
    messages.push(message);
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2), "utf8");

    res.status(201).json({ id: message.id, createdAt: message.createdAt });
  } catch (err) {
    console.error("Error in POST /api/messages:", err);
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
