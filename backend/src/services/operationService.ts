import {
  Machine,
  OperationEvent,
  OperationRequest,
  SyncState
} from "../types/operation";

const machines = new Map<string, Machine>();

const operations = new Map<string, OperationEvent>();

const events: OperationEvent[] = [];

let sequence = 0;

function seedMachines(): void {
  const now = new Date().toISOString();

  machines.set("M-100", {
    id: "M-100",
    name: "Assembly Line A",
    status: "RUNNING",
    version: 1,
    updatedAt: now
  });

  machines.set("M-200", {
    id: "M-200",
    name: "Packaging Line B",
    status: "STOPPED",
    version: 1,
    updatedAt: now
  });

  machines.set("M-300", {
    id: "M-300",
    name: "Inspection Line C",
    status: "PAUSED",
    version: 1,
    updatedAt: now
  });
}

export function getSyncState(): SyncState {
  return {
    serverSequence: sequence,
    machines: Array.from(machines.values())
  };
}

export function getEventsAfter(
  lastSequence: number
): OperationEvent[] {
  return events.filter(
    event => event.sequence > lastSequence
  );
}

export function processOperation(
  request: OperationRequest
):
  | {
      success: true;
      event: OperationEvent;
    }
  | {
      success: false;
      error: string;
    } {

  /*
   * Idempotency:
   *
   * If the client retries the same operation after
   * reconnecting, don't execute it twice.
   */
  const existingOperation =
    operations.get(request.operationId);

  if (existingOperation) {
    return {
      success: true,
      event: existingOperation
    };
  }

  const machine =
    machines.get(request.payload.machineId);

  if (!machine) {
    return {
      success: false,
      error: "Machine not found"
    };
  }

  /*
   * Optimistic concurrency:
   *
   * The client tells the server which machine version
   * it was working with.
   */
  if (request.baseVersion !== machine.version) {
    return {
      success: false,
      error:
        `Conflict: client version ${request.baseVersion} ` +
        `does not match server version ${machine.version}`
    };
  }

  const nextStatus =
    getNextStatus(request.type);

  if (!nextStatus) {
    return {
      success: false,
      error: "Invalid machine operation"
    };
  }

  machine.status = nextStatus;

  machine.version += 1;

  machine.updatedAt =
    new Date().toISOString();

  sequence += 1;

  const event: OperationEvent = {
    ...request,
    sequence,
    serverCreatedAt:
      new Date().toISOString(),
    status: "APPLIED"
  };

  operations.set(
    request.operationId,
    event
  );

  events.push(event);

  return {
    success: true,
    event
  };
}

function getNextStatus(
  type: OperationRequest["type"]
): Machine["status"] | null {

  switch (type) {

    case "START_MACHINE":
      return "RUNNING";

    case "STOP_MACHINE":
      return "STOPPED";

    case "PAUSE_MACHINE":
      return "PAUSED";

    case "COMPLETE_MAINTENANCE":
      return "RUNNING";

    default:
      return null;
  }
}

seedMachines();
