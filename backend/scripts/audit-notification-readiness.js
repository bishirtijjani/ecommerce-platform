#!/usr/bin/env node
/**
 * Read-only notification readiness audit.
 *
 * Lists the data conditions that silently break notification delivery:
 *   - vendors with no linked User (cannot receive anything)
 *   - vendors with missing / placeholder (0,0) coordinates (excluded from
 *     NEARBY radius matching unless the fallback tiers engage)
 *   - device-token and web-push coverage
 *   - duplicate web-push endpoints per user
 *
 * Usage (inside the backend container):
 *   node scripts/audit-notification-readiness.js
 */

const { prisma } = require('../src/config/database');
const { isConfigured } = require('../src/services/webpush.service');

(async () => {
  const [users, usersWithToken, vendors, subs, latestNotifications] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { fcmToken: { not: null } } }),
    prisma.vendor.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, name: true, userId: true, lat: true, lng: true, state: true },
      orderBy: { name: 'asc' },
    }),
    prisma.pushSubscription.findMany({ select: { userId: true, endpoint: true } }),
    prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, userId: true, type: true, title: true, createdAt: true },
    }),
  ]);

  const orphanVendors = vendors.filter((v) => !v.userId);
  const badCoords = vendors.filter(
    (v) => v.lat == null || v.lng == null || (Number(v.lat) === 0 && Number(v.lng) === 0),
  );

  const subsByUser = new Map();
  for (const s of subs) {
    subsByUser.set(s.userId, (subsByUser.get(s.userId) || 0) + 1);
  }
  const multiSubUsers = [...subsByUser.entries()].filter(([, n]) => n > 1);

  console.log('=== Notification readiness audit ===');
  console.log(`Web push configured:        ${isConfigured()}`);
  console.log(`Users:                      ${users}`);
  console.log(`Users with device token:    ${usersWithToken}`);
  console.log(`Web push subscriptions:     ${subs.length} across ${subsByUser.size} user(s)`);
  console.log(`Users with >1 subscription: ${multiSubUsers.length}`);

  console.log('\n--- APPROVED vendors with no linked user (cannot be notified) ---');
  if (!orphanVendors.length) console.log('  none');
  for (const v of orphanVendors) {
    console.log(`  ${v.id}  ${v.name}  (state: ${v.state || 'unknown'})`);
  }

  console.log('\n--- APPROVED vendors with missing / 0,0 coordinates ---');
  if (!badCoords.length) console.log('  none');
  for (const v of badCoords) {
    console.log(`  ${v.id}  ${v.name}  lat=${v.lat} lng=${v.lng}`);
  }

  console.log('\n--- Duplicate subscriptions per user ---');
  if (!multiSubUsers.length) console.log('  none');
  for (const [userId, count] of multiSubUsers) {
    console.log(`  user ${userId}: ${count} endpoints (likely multiple devices/tabs)`);
  }

  console.log('\n--- Latest notifications ---');
  if (!latestNotifications.length) console.log('  none');
  for (const n of latestNotifications) {
    console.log(`  ${n.createdAt.toISOString()}  ${n.type.padEnd(16)} ${n.title}`);
  }

  await prisma.$disconnect();
})().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
