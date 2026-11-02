/**
 * BullMQ queue initialization.
 *
 * Creates all queues and starts all workers.
 * This file is called once at server startup.
 */

const { Queue } = require('bullmq');
const { redis } = require('../config/redis');
const { QUEUES } = require('./jobs');
const { logger } = require('../utils/logger');
const { startNotificationWorker } = require('./workers/notification.worker');
const { startRequestWorker } = require('./workers/request.worker');

// Queue instances - import these in services to add jobs
const notificationQueue = new Queue(QUEUES.NOTIFICATION, { connection: redis });
const requestQueue = new Queue(QUEUES.REQUEST, { connection: redis });

/**
 * Initialize all queues and start workers.
 */
const initializeQueues = () => {
  startNotificationWorker();
  startRequestWorker();

  logger.info('All queue workers started', {
    queues: Object.values(QUEUES),
  });
};

module.exports = {
  initializeQueues,
  notificationQueue,
  requestQueue,
};
