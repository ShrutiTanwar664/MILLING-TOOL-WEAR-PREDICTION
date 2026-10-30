import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { sim, start, pause, reset } from "./simulator.js";

const app = express();
app.use(cors(), express.json());

app.get("/api/simulation/status", (_, res) => res.json(sim.state));
app.post("/api/simulation/start", (req, res) => { start(req.body?.delay); res.json(sim.state); });
app.post("/api/simulation/pause", (_, res) => { pause(); res.json(sim.state); });
app.post("/api/simulation/reset", async (_, res) => { await reset(); res.json(sim.state); });
app.post("/api/simulation/speed", (req, res) => {
  sim.state.delay = Number(req.body.delay) || 800; res.json(sim.state);
});

app.get("/api/readings", (req, res) => {
  const n = Number(req.query.limit) || sim.readings.length;
  res.json(sim.readings.slice(-n));
});
app.get("/api/readings/latest", (_, res) => res.json(sim.readings.at(-1) ?? null));

// Mobile app polls this: state plus only the readings after index `since`.
app.get("/api/snapshot", (req, res) => {
  const since = Number(req.query.since) || 0;
  res.json({ state: sim.state, count: sim.readings.length, readings: sim.readings.slice(since) });
});

// Live push (Server-Sent Events): dashboard gets each cut as it happens.
app.get("/api/stream", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  res.write(`event: init\ndata: ${JSON.stringify({ state: sim.state, readings: sim.readings })}\n\n`);
  sim.clients.add(res);
  const hb = setInterval(() => res.write(": ping\n\n"), 25000); // keeps proxies from closing idle streams
  req.on("close", () => { clearInterval(hb); sim.clients.delete(res); });
});

// Production: serve the built React app from the same server.
const dist = fileURLToPath(new URL("../../frontend/dist", import.meta.url));
app.use(express.static(dist));
app.get("*", (req, res, next) => (req.path.startsWith("/api") ? next() : res.sendFile(dist + "/index.html")));

app.listen(process.env.PORT || 4000, () => console.log("ToolSense backend on :" + (process.env.PORT || 4000)));