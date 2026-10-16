/**
 * Inline email helpers have been retired. Persist notification intent with
 * emitEvent(tx, input) from services/automation/events inside the domain transaction.
 * The independently deployed notification worker renders and delivers email.
 */
export {};
