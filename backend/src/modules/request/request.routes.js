/**
 * Request routes - /requests
 *
 * The reverse-marketplace surface: a customer posts a need, matched sellers
 * are pushed it, and they reply. Customer-side routes are scoped to the
 * caller's own requests in the service; vendor-side routes resolve the
 * caller's seller profile and scope to pings/threads they belong to.
 */

const { Router } = require('express');
const controller = require('./request.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { idempotency } = require('../../middlewares/idempotency.middleware');
const { requestCreationLimiter, requestResponseLimiter } = require('../../middlewares/rate-limit.middleware');
const {
  createRequestSchema,
  respondRequestSchema,
  acceptResponseSchema,
  listRequestsQuerySchema,
  inboxQuerySchema,
} = require('./request.validator');

const router = Router();

router.use(authenticate);

// Customer: post a need. Idempotent so a flaky retry can't double-post.
router.post(
  '/',
  authorize('CUSTOMER'),
  requestCreationLimiter,
  idempotency,
  validate(createRequestSchema),
  controller.create,
);

router.get('/', validate(listRequestsQuerySchema, 'query'), controller.listMine);

// Vendor inbox - declared BEFORE /:requestId so "inbox" isn't read as an id.
router.get('/inbox', authorize('VENDOR'), validate(inboxQuerySchema, 'query'), controller.inbox);
router.post('/inbox/seen', authorize('VENDOR'), controller.markSeen);

router.get('/:requestId', controller.getById);

// Vendor: reply / decline.
router.post(
  '/:requestId/responses',
  authorize('VENDOR'),
  requestResponseLimiter,
  idempotency,
  validate(respondRequestSchema),
  controller.respond,
);
router.post('/:requestId/decline', authorize('VENDOR'), controller.decline);

// Customer: pick one, cancel, or repost.
router.post('/:requestId/accept', authorize('CUSTOMER'), validate(acceptResponseSchema), controller.accept);
router.post('/:requestId/cancel', authorize('CUSTOMER'), controller.cancel);
router.post('/:requestId/repost', authorize('CUSTOMER'), controller.repost);

module.exports = router;
