/**
 * Request queue worker - top-up fan-out and expiry for reverse-marketplace
 * Requests. The service is required lazily inside the handler so this module
 * (loaded by queues/index at boot) doesn't create a require cycle with
 * request.service, which schedules these very jobs.
 */

const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, REQUEST_JOBS } = require('../jobs');
const { logger } = require('../../utils/logger');

const startRequestWorker = () => {
  const worker = new Worker(
    QUEUES.REQUEST,
    async (job) => {
      const service = require('../../modules/request/request.service');
      switch (job.name) {
        case REQUEST_JOBS.TOPUP:
          return service.processTopUp(job.data.requestId);
        case REQUEST_JOBS.EXPIRY:
          return service.processExpiry(job.data.requestId);
        default:
          logger.warn(`Unknown request job: ${job.name}`);
      }
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, error) => {
    logger.error(`Request job failed: ${job?.name}`, {
      jobId: job?.id,
      error: error.message,
    });
    const { captureError } = require('../../utils/sentry');
    captureError(error, {
      queue: 'request-queue',
      jobName: job?.name,
      jobId: job?.id,
    });
  });

  return worker;
};

module.exports = { startRequestWorker };
