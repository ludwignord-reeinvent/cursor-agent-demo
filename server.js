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

function mapTodo(row) {
  return {
    id: row.id,
    text: row.text,
    completed: Boolean(row.completed),
    createdAt: row.createdAt
  };
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = await all("PRAGMA table_info(todos)");
  const hasCompletedColumn = columns.some((column) => column.name === "completed");

  if (!hasCompletedColumn) {
    await run("ALTER TABLE todos ADD COLUMN completed INTEGER NOT NULL DEFAULT 0");
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/todos", async (_req, res) => {
  try {
    const rows = await all(
      "SELECT id, text, completed, created_at AS createdAt FROM todos ORDER BY id DESC"
    );

    res.json(rows.map(mapTodo));
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
    const row = await get(
      "SELECT id, text, completed, created_at AS createdAt FROM todos WHERE id = ?",
      [result.lastID]
    );

    return res.status(201).json(mapTodo(row));
  } catch (error) {
    console.error("Could not save todo.", error);
    return res.status(500).json({ error: "Could not save todo." });
  }
});

app.patch("/api/todos/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const completed = req.body.completed;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Todo id is invalid." });
  }

  if (typeof completed !== "boolean") {
    return res.status(400).json({ error: "Todo completed value is invalid." });
  }

  try {
    const result = await run("UPDATE todos SET completed = ? WHERE id = ?", [
      completed ? 1 : 0,
      id
    ]);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Todo not found." });
    }

    const row = await get(
      "SELECT id, text, completed, created_at AS createdAt FROM todos WHERE id = ?",
      [id]
    );

    return res.json(mapTodo(row));
  } catch (error) {
    console.error("Could not update todo.", error);
    return res.status(500).json({ error: "Could not update todo." });
  }
});

app.delete("/api/todos/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Todo id is invalid." });
  }

  try {
    const result = await run("DELETE FROM todos WHERE id = ?", [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Todo not found." });
    }

    return res.status(204).end();
  } catch (error) {
    console.error("Could not delete todo.", error);
    return res.status(500).json({ error: "Could not delete todo." });
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
