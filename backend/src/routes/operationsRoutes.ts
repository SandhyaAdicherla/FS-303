
import {
  Router,
  Request,
  Response
} from "express";

import {
  getSyncState,
  getEventsAfter,
  processOperation
} from "../services/operationService";

import {
  validateOperation
} from "../validation/operationValidation";

import {
  OperationRequest
} from "../types/operation";

const router = Router();

/*
 * Get current authoritative state.
 */
router.get(
  "/sync",
  (_req: Request, res: Response) => {

    res.json(
      getSyncState()
    );
  }
);

/*
 * Get events after a specific sequence number.
 */
router.get(
  "/events",
  (req: Request, res: Response) => {

    const sequence =
      Number(
        req.query.sequence || 0
      );

    const events =
      getEventsAfter(sequence);

    res.json({
      events
    });
  }
);

/*
 * Process an operator action.
 */
router.post(
  "/operations",
  (
    req: Request,
    res: Response
  ) => {

    const operation =
      req.body as OperationRequest;

    const validation =
      validateOperation(
        operation
      );

    if (!validation.valid) {

      return res.status(400).json({
        error: validation.error
      });
    }

    const result =
      processOperation(
        operation
      );

    if (!result.success) {

      return res.status(409).json({
        error: result.error
      });
    }

    return res.status(200).json({
      event: result.event
    });
  }
);

export default router;
