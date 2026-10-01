import type {
  OperationEvent,
  OperationRequest,
  SyncState
} from "../types/operation";

const WS_URL = "ws://localhost:5050";

export type ConnectionStatus =
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTED";

export interface WebSocketHandlers {
  onStatusChange: (
    status: ConnectionStatus
  ) => void;

  onSync: (
    state: SyncState
  ) => void;

  onEvent: (
    event: OperationEvent
  ) => void;

  onAck: (
    event: OperationEvent
  ) => void;

  onConflict: (
    data: {
      operationId: string;
      message: string;
      serverState: SyncState;
    }
  ) => void;
}

let socket: WebSocket | null = null;

let handlers: WebSocketHandlers | null = null;

let reconnectTimer: number | null = null;

let manuallyDisconnected = false;

export function connectWebSocket(
  webSocketHandlers: WebSocketHandlers
): void {

  handlers = webSocketHandlers;

  manuallyDisconnected = false;

  createConnection();
}

function createConnection(): void {

  if (
    socket &&
    socket.readyState === WebSocket.OPEN
  ) {
    return;
  }

  handlers?.onStatusChange("CONNECTING");

  socket = new WebSocket(WS_URL);

  socket.onopen = () => {

    console.log(
      "WebSocket connected"
    );

    handlers?.onStatusChange(
      "CONNECTED"
    );
  };

  socket.onmessage = event => {

    try {

      const message =
        JSON.parse(event.data);

      handleServerMessage(message);

    } catch (error) {

      console.error(
        "Invalid server message:",
        error
      );
    }
  };

  socket.onclose = () => {

    console.log(
      "WebSocket disconnected"
    );

    handlers?.onStatusChange(
      "DISCONNECTED"
    );

    socket = null;

    if (!manuallyDisconnected) {
      scheduleReconnect();
    }
  };

  socket.onerror = error => {

    console.error(
      "WebSocket error:",
      error
    );
  };
}

function handleServerMessage(
  message: any
): void {

  switch (message.type) {

    case "SYNC_STATE":

      handlers?.onSync(
        message.data
      );

      break;

    case "EVENT":

      handlers?.onEvent(
        message.data
      );

      break;

    case "ACK":

      handlers?.onAck(
        message.data
      );

      break;

    case "CONFLICT":

      handlers?.onConflict(
        message.data
      );

      break;

    case "ERROR":

      console.error(
        "Server error:",
        message.data
      );

      break;

    default:

      console.warn(
        "Unknown server message:",
        message
      );
  }
}

export function sendOperation(
  operation: OperationRequest
): boolean {

  if (
    !socket ||
    socket.readyState !== WebSocket.OPEN
  ) {
    return false;
  }

  socket.send(
    JSON.stringify({
      type: "OPERATION",
      operation
    })
  );

  return true;
}

export function requestSync(
  lastSequence: number
): void {

  if (
    !socket ||
    socket.readyState !== WebSocket.OPEN
  ) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "SYNC",
      lastSequence
    })
  );
}

export function disconnectWebSocket(): void {

  manuallyDisconnected = true;

  if (reconnectTimer !== null) {

    window.clearTimeout(
      reconnectTimer
    );

    reconnectTimer = null;
  }

  socket?.close();

  socket = null;

  handlers?.onStatusChange(
    "DISCONNECTED"
  );
}

export function reconnectWebSocket(): void {

  manuallyDisconnected = false;

  if (
    socket?.readyState === WebSocket.OPEN
  ) {
    return;
  }

  createConnection();
}

function scheduleReconnect(): void {

  if (reconnectTimer !== null) {
    return;
  }

  reconnectTimer =
    window.setTimeout(() => {

      reconnectTimer = null;

      createConnection();

    }, 2000);
}