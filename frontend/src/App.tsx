import { useEffect, useState } from "react";

import {
  connectWebSocket,
  disconnectWebSocket,
  reconnectWebSocket,
  requestSync,
  sendOperation,
  type ConnectionStatus
} from "./services/websocketService";

import type {
  Machine,
  OperationEvent,
  OperationRequest,
  OperationType,
  SyncState
} from "./types/operation";

import "./App.css";

function App() {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("CONNECTING");

  const [machines, setMachines] =
    useState<Machine[]>([]);

  const [lastSequence, setLastSequence] =
    useState(0);

  const [pendingOperations, setPendingOperations] =
    useState<OperationRequest[]>([]);

  const [conflict, setConflict] =
    useState<{
      operationId: string;
      message: string;
      serverState: SyncState;
    } | null>(null);
   const [processedOperations, setProcessedOperations] =
  useState<Set<string>>(new Set());

  useEffect(() => {
    connectWebSocket({
      onStatusChange: status => {
        setConnectionStatus(status);
      },

      onSync: state => {
        console.log("SYNC received:", state);

        setMachines(state.machines);

        setLastSequence(
          state.serverSequence
        );
      },

      onEvent: event => {
        console.log("EVENT received:", event);

        applyEvent(event);
      },

      onAck: event => {
        console.log("ACK received:", event);

        applyEvent(event);

        removePendingOperation(
          event.operationId
        );
      },

      onConflict: data => {
        console.log(
          "CONFLICT received:",
          data
        );

        setConflict(data);
      }
    });

    return () => {
      disconnectWebSocket();
    };
  }, []);

  useEffect(() => {
  if (
    connectionStatus !==
    "CONNECTED"
  ) {
    return;
  }

  /*
   * First ask the server for events that
   * happened after our last known sequence.
   */
  requestSync(lastSequence);

  /*
   * Give the sync request a moment to arrive,
   * then retry any operator actions that were
   * queued during the outage.
   */
  const timer =
    window.setTimeout(() => {

      pendingOperations.forEach(
        operation => {
          sendOperation(operation);
        }
      );

    }, 300);

  return () => {
    window.clearTimeout(timer);
  };

}, [
  connectionStatus
]);

  function applyEvent(
  event: OperationEvent
) {
  /*
   * Prevent the same operation from being
   * applied twice when the client receives
   * both ACK and EVENT.
   */
  if (processedOperations.has(event.operationId)) {
    return;
  }

  setProcessedOperations(current => {
    const updated = new Set(current);

    updated.add(event.operationId);

    return updated;
  });

  setMachines(currentMachines =>
    currentMachines.map(machine => {

      if (
        machine.id !==
        event.payload.machineId
      ) {
        return machine;
      }

      return {
        ...machine,

        status:
          getStatusFromOperation(
            event.type
          ),

        version:
          event.baseVersion + 1,

        updatedAt:
          event.serverCreatedAt
      };
    })
  );

  setLastSequence(currentSequence =>
    Math.max(
      currentSequence,
      event.sequence
    )
  );
}
  function removePendingOperation(
    operationId: string
  ) {
    setPendingOperations(
      operations =>
        operations.filter(
          operation =>
            operation.operationId !==
            operationId
        )
    );
  }

  function handleOperation(
    machine: Machine,
    type: OperationType
  ) {
    const operation: OperationRequest = {
      operationId:
        crypto.randomUUID(),

      type,

      payload: {
        machineId: machine.id,
        operatorId: "operator-demo"
      },

      clientCreatedAt:
        new Date().toISOString(),

      baseVersion:
        machine.version
    };

    /*
     * Always add the operation to the local
     * pending queue first.
     *
     * This prevents operator actions from
     * disappearing during a network failure.
     */
    setPendingOperations(
      current => [
        ...current,
        operation
      ]
    );

    const sent =
      sendOperation(operation);

    if (sent) {
      console.log(
        "Operation sent:",
        operation
      );
    } else {
      console.log(
        "Offline - operation queued:",
        operation
      );
    }
  }

  function handleReconnect() {
  reconnectWebSocket();
}
  function getStatusFromOperation(
    type: OperationType
  ): Machine["status"] {

    switch (type) {
      case "START_MACHINE":
        return "RUNNING";

      case "STOP_MACHINE":
        return "STOPPED";

      case "PAUSE_MACHINE":
        return "PAUSED";

      case "COMPLETE_MAINTENANCE":
        return "RUNNING";
    }
  }

  return (
    <div className="app">

      <header className="header">

        <div>
          <h1>
            ForgeLine Operations
          </h1>

          <p>
            Real-Time Manufacturing Dashboard
          </p>
        </div>

        <div
          className={`connection ${connectionStatus.toLowerCase()}`}
        >
          <span className="status-dot" />

          {connectionStatus}
        </div>

      </header>

      <main className="content">

        <section className="control-panel">

          <div>
            <strong>
              Server Sequence:
            </strong>{" "}
            {lastSequence}
          </div>

          <div>
            <strong>
              Pending Actions:
            </strong>{" "}
            {pendingOperations.length}
          </div>

          <button
            onClick={() => {
              disconnectWebSocket();
            }}
            disabled={
              connectionStatus ===
              "DISCONNECTED"
            }
          >
            Simulate Disconnect
          </button>

          <button
            onClick={handleReconnect}
            disabled={
              connectionStatus ===
              "CONNECTED"
            }
          >
            Reconnect
          </button>


        </section>

        {conflict && (
          <section
            className="conflict-panel"
            role="alert"
          >
            <h2>
              Conflict Detected
            </h2>

            <p>
              {conflict.message}
            </p>

            <p>
              Operation:
              {" "}
              <code>
                {conflict.operationId}
              </code>
            </p>

            <button
              onClick={() => {
                setMachines(
                  conflict.serverState.machines
                );

                setLastSequence(
                  conflict.serverState
                    .serverSequence
                );

                setConflict(null);
              }}
            >
              Accept Server State
            </button>
          </section>
        )}

        <section>

          <h2>
            Machines
          </h2>

          <div className="machine-grid">

            {machines.map(machine => (

              <article
                className="machine-card"
                key={machine.id}
              >

                <div className="machine-header">

                  <div>
                    <h3>
                      {machine.name}
                    </h3>

                    <span>
                      {machine.id}
                    </span>
                  </div>

                  <strong
                    className={`machine-status ${machine.status.toLowerCase()}`}
                  >
                    {machine.status}
                  </strong>

                </div>

                <div className="machine-info">

                  <p>
                    Version:
                    {" "}
                    {machine.version}
                  </p>

                  <p>
                    Last updated:
                    {" "}
                    {new Date(
                      machine.updatedAt
                    ).toLocaleTimeString()}
                  </p>

                </div>

                <div className="actions">

                  <button
                    onClick={() =>
                      handleOperation(
                        machine,
                        "START_MACHINE"
                      )
                    }
                  >
                    Start
                  </button>

                  <button
                    onClick={() =>
                      handleOperation(
                        machine,
                        "STOP_MACHINE"
                      )
                    }
                  >
                    Stop
                  </button>

                  <button
                    onClick={() =>
                      handleOperation(
                        machine,
                        "PAUSE_MACHINE"
                      )
                    }
                  >
                    Pause
                  </button>

                </div>

              </article>

            ))}

          </div>

        </section>

        <section className="queue-section">

          <h2>
            Pending Operator Actions
          </h2>

          {pendingOperations.length === 0 ? (

            <p>
              No pending actions.
            </p>

          ) : (

            <div className="queue">

              {pendingOperations.map(
                operation => (

                  <div
                    className="queue-item"
                    key={
                      operation.operationId
                    }
                  >

                    <div>
                      <strong>
                        {operation.type}
                      </strong>

                      <span>
                        Machine:
                        {" "}
                        {operation.payload.machineId}
                      </span>
                    </div>

                    <span>
                      Base version:
                      {" "}
                      {operation.baseVersion}
                    </span>

                  </div>

                )
              )}

            </div>
          )}

        </section>

      </main>

    </div>
  );
}

export default App;