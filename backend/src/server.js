import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { sim, start, pause, reset, setSpeed } from "./simulator.js";

const app = express();

// Enable cross-origin requests and JSON request body parsing.
app.use(cors(), express.json());


// ---------------- SIMULATION CONTROL APIs ----------------

// Return the current simulation state.
app.get("/api/simulation/status", (_, res) => res.json(sim.state));

// Start or resume simulation, optionally accepting a custom delay in milliseconds.
app.post("/api/simulation/start", (req, res) => { start(req.body?.delay); res.json(sim.state); });

// Pause simulation without clearing previously generated readings.
app.post("/api/simulation/pause", (_, res) => { pause(); res.json(sim.state); });

// Reset both the local simulation and the ML API prediction history.
app.post("/api/simulation/reset", async (_, res) => { await reset(); res.json(sim.state); });

// Update the interval between consecutive simulation cuts.
app.post("/api/simulation/speed", (req, res) => { setSpeed(req.body?.delay); res.json(sim.state); });


// ---------------- SENSOR READING APIs ----------------

// Return the latest N readings. If limit is omitted, return the complete history.
app.get("/api/readings", (req, res) => {
  const n = Number(req.query.limit) || sim.readings.length;
  res.json(sim.readings.slice(-n));
});

// Return the most recent reading, or null if no readings exist.
app.get("/api/readings/latest", (_, res) => res.json(sim.readings.at(-1) ?? null));


// ---------------- MOBILE APP SNAPSHOT API ----------------

// Mobile app uses the "since" index to fetch only newly generated readings,
// avoiding the need to download the complete reading history on every poll.
app.get("/api/snapshot", (req, res) => {
  const since = Number(req.query.since) || 0;
  res.json({ state: sim.state, count: sim.readings.length, readings: sim.readings.slice(since) });
});


// ---------------- REAL-TIME DATA STREAM (SSE) ----------------

// Server-Sent Events allow the dashboard to receive readings and state updates
// directly from the backend without repeatedly polling the API.
app.get("/api/stream", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();

  // Send the initial state and reading history when a client connects.
  res.write(`event: init\ndata: ${JSON.stringify({ state: sim.state, readings: sim.readings })}\n\n`);

  // Register this connection so the simulator can broadcast future events.
  sim.clients.add(res);

  // Heartbeat prevents hosting platforms and proxies from closing idle connections.
  const hb = setInterval(() => res.write(": ping\n\n"), 25000);

  // Clean up the connection and heartbeat when the client disconnects.
  req.on("close", () => { clearInterval(hb); sim.clients.delete(res); });
});


// ---------------- FRONTEND PRODUCTION SERVING ----------------

// Resolve the location of the built React frontend.
const dist = fileURLToPath(new URL("../../frontend/dist", import.meta.url));

// Serve static frontend assets such as JavaScript, CSS, and images.
app.use(express.static(dist));

// Return index.html for frontend routes so React Router can handle navigation.
// API requests are passed forward instead of receiving the frontend HTML.
app.get("*", (req, res, next) => (req.path.startsWith("/api") ? next() : res.sendFile(dist + "/index.html")));


// Start the backend using the hosting platform's port or port 4000 locally.
app.listen(process.env.PORT || 4000, () => console.log("ToolSense backend on :" + (process.env.PORT || 4000)));
