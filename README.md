# FS-303 — Real-Time Operations Platform Design

## ForgeLine Manufacturing

A TypeScript + React real-time manufacturing operations prototype designed to keep factory dashboards consistent with backend state during network disconnections and reconnections.

---

## 1. Problem Statement

ForgeLine Manufacturing operates real-time factory dashboards where operators perform actions such as starting, stopping, and pausing machines.

During network interruptions, the dashboard can become temporarily disconnected from the backend. The system must ensure that operator actions are not silently lost and that the client can reconcile its state after reconnecting.

The prototype demonstrates:

* Real-time WebSocket communication
* Local pending-operation tracking
* Operation idempotency
* Optimistic concurrency using machine versions
* Server event sequencing
* Reconnection and synchronization
* Conflict detection
* Operator-visible conflict recovery

---

## 2. Technology Stack

### Frontend

* React
* TypeScript
* Vite
* WebSocket API
* CSS

### Backend

* Node.js
* Express
* TypeScript
* WebSocket (`ws`)
* In-memory operation/event state

### Testing

* Vitest
* TypeScript

---

## 3. Project Structure

```text
FS-303-Real-Time-Operations-Platform-Design/
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── operationsRoutes.ts
│   │   ├── services/
│   │   │   ├── operationService.ts
│   │   │   └── websocketService.ts
│   │   ├── types/
│   │   │   └── operation.ts
│   │   ├── validation/
│   │   │   └── operationValidation.ts
│   │   └── server.ts
│   │
│   ├── tests/
│   │   └── operationService.test.ts
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   │   └── websocketService.ts
│   │   ├── types/
│   │   │   └── operation.ts
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── main.tsx
│   └── package.json
│
└── README.md
```

---

## 4. Architecture

```text
                         ┌─────────────────────┐
                         │   React Dashboard   │
                         │                     │
                         │ Machine State       │
                         │ Pending Queue       │
                         │ Connection Status   │
                         └──────────┬──────────┘
                                    │
                              WebSocket
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Node.js WebSocket   │
                         │       Server        │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Operation Service   │
                         │                     │
                         │ Version checking    │
                         │ Idempotency         │
                         │ Event sequencing    │
                         │ State transitions   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ In-Memory State     │
                         │                     │
                         │ Machines            │
                         │ Operations          │
                         │ Event sequence      │
                         └─────────────────────┘
```

---

## 5. Operation Flow

### Connected operation

```text
Operator Action
      ↓
Create operationId
      ↓
Add to local pending queue
      ↓
Send WebSocket operation
      ↓
Backend validates operation
      ↓
Check machine version
      ↓
Apply operation
      ↓
Increment machine version
      ↓
Increment event sequence
      ↓
ACK + EVENT
      ↓
Remove operation from pending queue
```

### Disconnected operation

```text
Operator Action
      ↓
Create operationId
      ↓
Add to local pending queue
      ↓
WebSocket unavailable
      ↓
Operation remains queued
      ↓
Connection restored
      ↓
Synchronize server state
      ↓
Retry pending operation
      ↓
ACK / CONFLICT
```

---

## 6. Reconnect Semantics

The client maintains:

* Connection status
* Last known server sequence
* Pending operator operations
* Processed operation IDs

When the connection is restored, the client requests synchronization from the server using the last known event sequence.

Pending operations are retained until an acknowledgement is received.

This prevents an operator action from disappearing simply because the network was temporarily unavailable.

---

## 7. Event Ordering

Every accepted server operation receives an increasing sequence number:

```text
sequence: 1
sequence: 2
sequence: 3
...
```

The client tracks the latest known sequence.

During synchronization, the client can request events after its last known sequence.

This provides a deterministic ordering mechanism for the prototype.

---

## 8. Idempotency

Every operation contains a unique:

```text
operationId
```

The backend stores processed operations.

If the same operation is received again after a retry, the backend returns the previously processed event instead of executing the operation twice.

Example:

```text
First request
operationId = abc123
      ↓
Operation applied
sequence = 10

Retry
operationId = abc123
      ↓
Existing operation found
      ↓
Original event returned
```

This is important because network failures can occur after the server processes an operation but before the client receives the acknowledgement.

---

## 9. Conflict Detection

Each operation contains:

```text
baseVersion
```

The value represents the machine version known by the client when the operation was created.

The backend compares:

```text
client baseVersion
        vs
server machine version
```

If they do not match, the operation is rejected as a conflict.

Example:

```text
Client A knows machine version = 2

Client A → STOP_MACHINE
             ↓
Server accepts
             ↓
Machine version = 3

Client B still has version = 2

Client B → START_MACHINE
             ↓
Server detects:
2 != 3
             ↓
CONFLICT
```

The frontend presents the conflict to the operator and provides an option to accept the current server state.

---

## 10. Validation Test Cases

| ID   | Scenario                                      | Expected Result                                   |
| ---- | --------------------------------------------- | ------------------------------------------------- |
| TC01 | Connected operator performs machine operation | Operation is applied                              |
| TC02 | Same operation is submitted twice             | Operation is applied only once                    |
| TC03 | Client submits stale machine version          | Conflict is returned                              |
| TC04 | Accepted operation changes machine version    | Version increments                                |
| TC05 | Operator acts while disconnected              | Action remains in local pending queue             |
| TC06 | Client reconnects                             | Server state is synchronized                      |
| TC07 | Pending operation is retried                  | Operation is acknowledged or surfaced as conflict |

---

## 11. Automated Tests

Backend unit tests are located at:

```text
backend/tests/operationService.test.ts
```

Run:

```bash
cd backend
npm test
```

The automated tests verify:

1. Valid operations are applied.
2. Duplicate operation IDs are handled idempotently.
3. Stale machine versions produce conflicts.
4. Machine versions increment after successful operations.

The browser disconnect/reconnect flow is additionally validated manually because it involves actual WebSocket connection state and frontend interaction.

---

## 12. Manual Acceptance Test

### Scenario: Operator action during network failure

1. Start the backend.
2. Start the React frontend.
3. Confirm the dashboard shows `CONNECTED`.
4. Click `Simulate Disconnect`.
5. Confirm the dashboard shows `DISCONNECTED`.
6. Perform a machine action.
7. Confirm the action appears under `Pending Operator Actions`.
8. Confirm the action has not been silently discarded.
9. Click `Reconnect`.
10. Confirm the dashboard returns to `CONNECTED`.
11. Confirm the pending operation is retried.
12. Confirm the server acknowledges the operation.
13. Confirm the machine state is updated.
14. Confirm the pending queue returns to zero.

Acceptance condition:

```text
Operator action
      ↓
Network failure
      ↓
Action retained
      ↓
Reconnect
      ↓
Action recovered
      ↓
Server acknowledgement
      ↓
Final state reconciled
```

---

## 13. Three Core Demonstration Cases

### Normal Case

A connected operator stops a running machine.

Expected:

* Operation reaches backend immediately.
* Machine state changes.
* Machine version increments.
* Server sequence increments.
* Pending queue becomes empty after acknowledgement.

### Boundary Case

An operator performs an action while disconnected.

Expected:

* WebSocket transmission fails.
* Operation remains in the local queue.
* Operator can see the pending action.
* No action is silently lost.

### Failure/Recovery Case

The network is disconnected after an operator action and then restored.

Expected:

* Client reconnects.
* Client synchronizes server state.
* Pending operation is retried.
* Backend either acknowledges it or returns a visible conflict.
* Final state is reflected on the dashboard.

---

## 14. Assumptions

* The prototype represents a single factory dashboard environment.
* Machine state is represented by an in-memory backend store.
* Operator identity is represented by a synthetic demo identifier.
* Authentication and authorization are outside the scope of this prototype.
* WebSocket communication is assumed to use a trusted application environment.
* Persistent database storage is not implemented in this assessment prototype.
* Event history is stored only for the lifetime of the backend process.

---

## 15. Production Considerations

For production deployment, the in-memory state should be replaced with persistent storage.

Potential production components include:

* Persistent database for machine state
* Durable operation/event store
* Authentication and authorization
* Durable client operation queue
* WebSocket connection management
* Observability and structured logging
* Metrics for reconnects and conflicts
* Dead-letter handling for repeatedly failing operations
* Horizontal scaling with shared event distribution
* Backup and recovery mechanisms

Sensitive values should not be included in synthetic fixtures or logs.

---

## 16. Service Objectives

The prototype focuses on correctness during connectivity failures.

Suggested production objectives include:

| Objective            | Target                                           |
| -------------------- | ------------------------------------------------ |
| Operator action loss | 0 silently dropped acknowledged/queued actions   |
| Duplicate execution  | 0 duplicate executions for the same operation ID |
| Event ordering       | Monotonic server sequence                        |
| Conflict visibility  | 100% of detected conflicts surfaced to operator  |
| Reconnection         | Automatic reconnect with bounded retry           |
| Recovery             | Pending operations reconciled after reconnect    |

These are proposed engineering objectives for the production design, not measured production SLAs.

---

## 17. Architecture Trade-offs

### Design A — Client Queue + WebSocket + Version Validation

Advantages:

* Relatively simple implementation
* Clear operator feedback
* Supports offline actions
* Idempotency protects against duplicate retries
* Version validation provides explicit conflict detection

Trade-offs:

* Client queue durability must be addressed for production
* Conflict resolution requires operator interaction
* Scaling WebSocket infrastructure requires shared state/event distribution

### Design B — Server-Durable Command Queue

Advantages:

* Commands can survive client restarts
* Centralized command processing
* Stronger durability model

Trade-offs:

* Higher infrastructure complexity
* Additional queue/storage components
* More operational ownership
* Greater implementation and maintenance cost

For this prototype, the client queue + WebSocket + version validation model is implemented because it demonstrates the required reconciliation behavior with a smaller architecture.

---

## 18. Ownership

| Area                     | Primary Responsibility   |
| ------------------------ | ------------------------ |
| React dashboard          | Frontend team            |
| WebSocket client         | Frontend team            |
| Operation API            | Backend team             |
| Operation validation     | Backend team             |
| Machine state            | Backend/platform team    |
| Conflict handling UX     | Frontend + Operations    |
| WebSocket infrastructure | Platform team            |
| Monitoring               | Platform/SRE             |
| Production rollout       | Engineering + Operations |

---

## 19. Rollout Approach

### Phase 1 — Prototype

* Validate operation model.
* Validate reconnect behavior.
* Validate conflict handling.
* Collect operator feedback.

### Phase 2 — Limited rollout

* Enable for a small set of dashboards.
* Monitor reconnect frequency.
* Monitor pending operations.
* Monitor conflict rate.
* Verify recovery behavior.

### Phase 3 — Wider rollout

* Expand to additional factory dashboards.
* Monitor service objectives.
* Maintain rollback capability.

### Rollback Gates

Rollback should be considered if monitoring identifies:

* Unexpected duplicate machine operations
* Increasing unreconciled pending operations
* Incorrect machine state after reconnect
* Significant conflict-resolution failures
* WebSocket instability affecting normal operations

---

## 20. Known Limitations

This is an assessment prototype and intentionally does not implement:

* Persistent database storage
* User authentication
* Role-based authorization
* Distributed WebSocket infrastructure
* Durable browser storage for pending operations
* Production monitoring
* Multi-server event distribution

These should be addressed before production deployment.

---

## 21. How to Run

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend:

```text
http://localhost:5050
```

Health endpoint:

```text
http://localhost:5050/api/health
```

WebSocket:

```text
ws://localhost:5050
```

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

### Tests

```bash
cd backend
npm test
```

### Production build

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

---

## 22. Final Acceptance Criteria

### AC01 — Reconciliation

A disconnection exercise must reconcile state without silently dropping operator actions.

### AC02 — Reproducible Examples

At least three scenarios are demonstrated:

* Normal
* Boundary
* Failure/recovery

### AC03 — Handover

The solution documents:

* Assumptions
* Risks
* Recovery behavior
* Limitations
* Synthetic test data

### AC04 — Architecture Decision

The solution compares viable architectural approaches and identifies:

* Cost considerations
* Reliability considerations
* Ownership
* Rollout gates
* Rollback considerations

---

## 23. Assessment Outcome

The prototype demonstrates a real-time operations workflow in which:

```text
Operator
   ↓
React Dashboard
   ↓
WebSocket
   ↓
Operation Service
   ↓
Version Validation
   ↓
Event Sequence
   ↓
ACK / EVENT
   ↓
Dashboard Reconciliation
```

During connectivity loss:

```text
Operator
   ↓
Local Pending Queue
   ↓
Reconnect
   ↓
Synchronization
   ↓
Retry
   ↓
ACK / CONFLICT
   ↓
Reconciled State
```

The implementation prioritizes explicit operator visibility, idempotent operation handling, version-based conflict detection, and reproducible validation scenarios.
