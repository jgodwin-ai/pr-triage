import express from "express";
import configRouter from "./routes/config.js";

const app = express();
app.use(express.json());
app.use("/api/config", configRouter);

const PORT = parseInt(process.env.PORT || "9000", 10);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const server = app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

export { app, server };
