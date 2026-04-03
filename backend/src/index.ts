import express from "express";

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || "9000", 10);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const server = app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

export { app, server };
