const express = require("express");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = process.env.PORT || 3000;
const dataDirectory = path.join(__dirname, "data");
const databasePath = path.join(dataDirectory, "todos.db");

fs.mkdirSync(dataDirectory, { recursive: true });

const db = new sqlite3.Database(databasePath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function handleResult(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/todos", async (_req, res) => {
  try {
    const todos = await all(
      "SELECT id, text, created_at AS createdAt FROM todos ORDER BY id DESC"
    );

    res.json(todos);
  } catch (error) {
    console.error("Could not load todos.", error);
    res.status(500).json({ error: "Could not load todos." });
  }
});

app.post("/api/todos", async (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

  if (!text) {
    return res.status(400).json({ error: "Todo text is required." });
  }

  try {
    const result = await run("INSERT INTO todos (text) VALUES (?)", [text]);
    const todo = await get(
      "SELECT id, text, created_at AS createdAt FROM todos WHERE id = ?",
      [result.lastID]
    );

    return res.status(201).json(todo);
  } catch (error) {
    console.error("Could not save todo.", error);
    return res.status(500).json({ error: "Could not save todo." });
  }
});

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Todo app running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Could not start the app.", error);
    process.exit(1);
  });
