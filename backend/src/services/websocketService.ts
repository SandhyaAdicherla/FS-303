import { Server, WebSocket } from "ws";

import {
  OperationRequest
} from "../types/operation";

import {
  getSyncState,
  getEventsAfter,
  processOperation
} from "./operationService";

interface ClientMessage {
  type:
    | "SYNC"
    | "OPERATION";

  lastSequence?: number;

  operation?: OperationRequest;
}

interface ServerMessage {
  type:
    | "SYNC_STATE"
    | "EVENT"
    | "ACK"
    | "CONFLICT"
    | "ERROR";

  data?: unknown;
}

export function initializeWebSocket(
  websocketServer: Server
): void {

  websocketServer.on(
    "connection",
    (socket: WebSocket) => {

      console.log(
        "WebSocket client connected"
      );

      socket.send(
        JSON.stringify({
          type: "SYNC_STATE",
          data: getSyncState()
        } satisfies ServerMessage)
      );

      socket.on(
        "message",
        (message) => {

          try {

            const clientMessage =
              JSON.parse(
                message.toString()
              ) as ClientMessage;

            handleClientMessage(
              socket,
              clientMessage,
              websocketServer
            );

          } catch (error) {

            console.error(
              "Invalid WebSocket message:",
              error
            );

            sendMessage(
              socket,
              {
                type: "ERROR",
                data: {
                  message:
                    "Invalid message format"
                }
              }
            );
          }
        }
      );

      socket.on(
        "close",
        () => {

          console.log(
            "WebSocket client disconnected"
          );
        }
      );

      socket.on(
        "error",
        (error) => {

          console.error(
            "WebSocket error:",
            error
          );
        }
      );
    }
  );
}

function handleClientMessage(
  socket: WebSocket,
  message: ClientMessage,
  websocketServer: Server
): void {

  switch (message.type) {

    case "SYNC":
      handleSync(
        socket,
        message.lastSequence ?? 0
      );

      break;

    case "OPERATION":

      if (!message.operation) {

        sendMessage(
          socket,
          {
            type: "ERROR",
            data: {
              message:
                "Operation is required"
            }
          }
        );

        return;
      }

      handleOperation(
        socket,
        message.operation,
        websocketServer
      );

      break;

    default:

      sendMessage(
        socket,
        {
          type: "ERROR",
          data: {
            message:
              "Unsupported message type"
          }
        }
      );
  }
}

function handleSync(
  socket: WebSocket,
  lastSequence: number
): void {

  /*
   * Only send events that the client has not
   * already processed.
   */
  const missingEvents =
    getEventsAfter(lastSequence);

  sendMessage(
    socket,
    {
      type: "SYNC_STATE",
      data: {
        ...getSyncState(),
        missingEvents
      }
    }
  );
}

function handleOperation(
  socket: WebSocket,
  operation: OperationRequest,
  websocketServer: Server
): void {

  const result =
    processOperation(operation);

  if (!result.success) {

    sendMessage(
      socket,
      {
        type: "CONFLICT",
        data: {
          operationId:
            operation.operationId,

          message:
            result.error,

          serverState:
            getSyncState()
        }
      }
    );

    return;
  }

  /*
   * First acknowledge the operation to the
   * originating client.
   */
  sendMessage(
    socket,
    {
      type: "ACK",
      data: result.event
    }
  );

  /*
   * Broadcast the authoritative event to
   * every connected dashboard.
   */
  broadcast(
    websocketServer,
    {
      type: "EVENT",
      data: result.event
    }
  );
}

function broadcast(
  websocketServer: Server,
  message: ServerMessage
): void {

  const serialized =
    JSON.stringify(message);

  websocketServer.clients.forEach(
    client => {

      if (
        client.readyState === WebSocket.OPEN
      ) {
        client.send(serialized);
      }
    }
  );
}

function sendMessage(
  socket: WebSocket,
  message: ServerMessage
): void {

  if (
    socket.readyState === WebSocket.OPEN
  ) {
    socket.send(
      JSON.stringify(message)
    );
  }
}
