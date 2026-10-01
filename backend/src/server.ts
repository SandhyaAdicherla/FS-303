
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";

import operationsRoutes from "./routes/operationsRoutes";
import { initializeWebSocket } from "./services/websocketService";

const app = express();

const PORT = 5050;

app.use(cors());

app.use(express.json());

app.get(
  "/api/health",
  (_req, res) => {

    res.json({
      status: "ok",
      service:
        "ForgeLine Realtime Operations API"
    });
  }
);

app.use(
  "/api/operations",
  operationsRoutes
);

const server =
  http.createServer(app);

/*
 * WebSocket server shares the same HTTP server.
 */
const websocketServer =
  new WebSocketServer({
    server
  });

initializeWebSocket(
  websocketServer
);

server.listen(
  PORT,
  () => {

    console.log(
      `ForgeLine backend running on http://localhost:${PORT}`
    );

    console.log(
      `WebSocket running on ws://localhost:${PORT}`
    );
  }
);
