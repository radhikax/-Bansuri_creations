import { prisma } from '../db';

export async function cancelAbandonedOrders(olderThanHours = 24, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanHours * 60 * 60 * 1000);
  const result = await prisma.order.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data: { status: 'CANCELLED' },
  });
  return result.count;
}

if (require.main === module) {
  cancelAbandonedOrders()
    .then((count) => {
      console.log(`Cancelled ${count} abandoned orders`);
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
