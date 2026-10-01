export type OperationType =
  | "START_MACHINE"
  | "STOP_MACHINE"
  | "PAUSE_MACHINE"
  | "COMPLETE_MAINTENANCE";

export type OperationStatus =
  | "PENDING"
  | "APPLIED"
  | "REJECTED";

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

export interface OperationEvent extends OperationRequest {
  sequence: number;
  serverCreatedAt: string;
  status: OperationStatus;
}

export interface Machine {
  id: string;
  name: string;
  status: "RUNNING" | "STOPPED" | "PAUSED";
  version: number;
  updatedAt: string;
}

export interface SyncState {
  serverSequence: number;
  machines: Machine[];
}