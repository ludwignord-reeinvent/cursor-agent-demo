const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

const todos = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/todos", (_req, res) => {
  res.json(todos);
});

app.post("/api/todos", (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

  if (!text) {
    return res.status(400).json({ error: "Todo text is required." });
  }

  const todo = {
    id: Date.now(),
    text
  };

  todos.unshift(todo);
  return res.status(201).json(todo);
});

app.listen(port, () => {
  console.log(`Todo app running at http://localhost:${port}`);
});
