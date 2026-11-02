/**
 * Order status taxonomy and FSM helpers.
 *
 * Single source of truth for the order lifecycle across the platform. No
 * rider/dispatch leg here - a vendor accepts, processes, ships, and the
 * order is done. There is no payment step: PENDING means "placed, awaiting
 * vendor confirmation" and the vendor's accept action moves it straight to
 * PROCESSING. Cancellation just ends the order (CANCELLED) - there is no
 * escrow to refund from, so there is no separate REFUNDED status.
 */

const STATUS = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

const ALL_STATUSES = Object.values(STATUS);

/** States in which an order is still being worked on. */
const ACTIVE_STATUSES = Object.freeze([
  STATUS.PENDING,
  STATUS.PROCESSING,
  STATUS.SHIPPED,
]);

const TERMINAL_STATUSES = Object.freeze([STATUS.DELIVERED, STATUS.CANCELLED]);

const COMPLETED_STATUSES = Object.freeze([STATUS.DELIVERED]);

/** Allowed transitions for an Order. */
const TRANSITIONS = Object.freeze({
  [STATUS.PENDING]: [STATUS.PROCESSING, STATUS.CANCELLED],
  [STATUS.PROCESSING]: [STATUS.SHIPPED, STATUS.CANCELLED],
  [STATUS.SHIPPED]: [STATUS.DELIVERED],
  [STATUS.DELIVERED]: [],
  [STATUS.CANCELLED]: [],
});

const isValidStatus = (status) => ALL_STATUSES.includes(status);

const isActive = (status) => ACTIVE_STATUSES.includes(status);

const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

const isCompleted = (status) => COMPLETED_STATUSES.includes(status);

const canTransition = (from, to) => {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
};

const assertTransition = (from, to) => {
  if (!canTransition(from, to)) {
    const err = new Error(`Invalid status transition: ${from} → ${to}`);
    err.code = 'INVALID_STATUS_TRANSITION';
    throw err;
  }
};

module.exports = {
  STATUS,
  ALL_STATUSES,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  COMPLETED_STATUSES,
  TRANSITIONS,
  isValidStatus,
  isActive,
  isTerminal,
  isCompleted,
  canTransition,
  assertTransition,
};
