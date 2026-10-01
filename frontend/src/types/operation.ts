export type MachineStatus =
  | "RUNNING"
  | "STOPPED"
  | "PAUSED";

export type OperationType =
  | "START_MACHINE"
  | "STOP_MACHINE"
  | "PAUSE_MACHINE"
  | "COMPLETE_MAINTENANCE";

export interface Machine {
  id: string;
  name: string;
  status: MachineStatus;
  version: number;
  updatedAt: string;
}

export interface OperationPayload {
  machineId: string;
  operatorId: string;
  reason?: string;
}

export interface OperationRequest {
  operationId: string;
  type: OperationType;
  payload: OperationPayload;
  clientCreatedAt: string;
  baseVersion: number;
}

export interface OperationEvent
  extends OperationRequest {
  sequence: number;
  serverCreatedAt: string;
  status: "PENDING" | "APPLIED" | "REJECTED";
}

export interface SyncState {
  serverSequence: number;
  machines: Machine[];
  missingEvents?: OperationEvent[];
}