import {
  OperationRequest,
  OperationType
} from "../types/operation";

const allowedTypes: OperationType[] = [
  "START_MACHINE",
  "STOP_MACHINE",
  "PAUSE_MACHINE",
  "COMPLETE_MAINTENANCE"
];

export function validateOperation(
  operation: OperationRequest
): { valid: boolean; error?: string } {
  if (!operation.operationId) {
    return {
      valid: false,
      error: "operationId is required"
    };
  }

  if (!allowedTypes.includes(operation.type)) {
    return {
      valid: false,
      error: "Unsupported operation type"
    };
  }

  if (!operation.payload?.machineId) {
    return {
      valid: false,
      error: "machineId is required"
    };
  }

  if (!operation.payload?.operatorId) {
    return {
      valid: false,
      error: "operatorId is required"
    };
  }

  if (
    !Number.isInteger(operation.baseVersion) ||
    operation.baseVersion < 0
  ) {
    return {
      valid: false,
      error: "baseVersion must be a non-negative integer"
    };
  }

  return {
    valid: true
  };
}