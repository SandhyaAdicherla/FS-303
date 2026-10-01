import { describe, expect, it } from "vitest";

import {
  getSyncState,
  processOperation
} from "../src/services/operationService";

describe("ForgeLine Operation Service", () => {

  it("applies a valid machine operation", () => {
    const state = getSyncState();

    const machine = state.machines.find(
      item => item.id === "M-100"
    );

    expect(machine).toBeDefined();

    const operation = {
      operationId: `test-normal-${Date.now()}`,
      type: "STOP_MACHINE" as const,
      payload: {
        machineId: "M-100",
        operatorId: "test-operator"
      },
      clientCreatedAt: new Date().toISOString(),
      baseVersion: machine!.version
    };

    const result =
      processOperation(operation);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.event.status).toBe("APPLIED");
      expect(result.event.sequence).toBeGreaterThan(0);
      expect(result.event.payload.machineId).toBe("M-100");
    }
  });


  it("does not execute the same operation twice", () => {
    const state = getSyncState();

    const machine = state.machines.find(
      item => item.id === "M-200"
    );

    expect(machine).toBeDefined();

    const operationId =
      `test-idempotency-${Date.now()}`;

    const operation = {
      operationId,
      type: "START_MACHINE" as const,
      payload: {
        machineId: "M-200",
        operatorId: "test-operator"
      },
      clientCreatedAt: new Date().toISOString(),
      baseVersion: machine!.version
    };

    const firstResult =
      processOperation(operation);

    expect(firstResult.success).toBe(true);

    if (!firstResult.success) {
      return;
    }

    const firstSequence =
      firstResult.event.sequence;

    const secondResult =
      processOperation(operation);

    expect(secondResult.success).toBe(true);

    if (!secondResult.success) {
      return;
    }

    expect(
      secondResult.event.sequence
    ).toBe(firstSequence);

    expect(
      secondResult.event.operationId
    ).toBe(operationId);
  });


  it("rejects an operation with a stale machine version", () => {
    const state = getSyncState();

    const machine = state.machines.find(
      item => item.id === "M-300"
    );

    expect(machine).toBeDefined();

    const staleVersion =
      machine!.version;

    const firstOperation = {
      operationId:
        `test-conflict-first-${Date.now()}`,

      type: "START_MACHINE" as const,

      payload: {
        machineId: "M-300",
        operatorId: "operator-a"
      },

      clientCreatedAt:
        new Date().toISOString(),

      baseVersion:
        staleVersion
    };

    const firstResult =
      processOperation(firstOperation);

    expect(firstResult.success).toBe(true);

    const conflictingOperation = {
      operationId:
        `test-conflict-second-${Date.now()}`,

      type: "STOP_MACHINE" as const,

      payload: {
        machineId: "M-300",
        operatorId: "operator-b"
      },

      clientCreatedAt:
        new Date().toISOString(),

      baseVersion:
        staleVersion
    };

    const conflictResult =
      processOperation(
        conflictingOperation
      );

    expect(conflictResult.success).toBe(false);

    if (!conflictResult.success) {
      expect(
        conflictResult.error
      ).toContain("Conflict");

      expect(
        conflictResult.error
      ).toContain("does not match server version");
    }
  });


  it("increments machine version after an accepted operation", () => {
    const state = getSyncState();

    const machine = state.machines.find(
      item => item.id === "M-100"
    );

    expect(machine).toBeDefined();

    const originalVersion =
      machine!.version;

    const operation = {
      operationId:
        `test-version-${Date.now()}`,

      type: "PAUSE_MACHINE" as const,

      payload: {
        machineId: "M-100",
        operatorId: "test-operator"
      },

      clientCreatedAt:
        new Date().toISOString(),

      baseVersion:
        originalVersion
    };

    const result =
      processOperation(operation);

    expect(result.success).toBe(true);

    const updatedState =
      getSyncState();

    const updatedMachine =
      updatedState.machines.find(
        item => item.id === "M-100"
      );

    expect(updatedMachine).toBeDefined();

    expect(
      updatedMachine!.version
    ).toBe(originalVersion + 1);

    expect(
      updatedMachine!.status
    ).toBe("PAUSED");
  });

});