import type { Prisma, PrismaClient } from '@prisma/client';
import type { ShippingConfig } from './pricing';

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = { flatShippingFee: 50, freeShippingThreshold: 999 };

/** Store shipping settings (row id 1), or the defaults when none have been saved. Works inside a transaction. */
export async function getShippingConfig(
  db: Pick<PrismaClient, 'storeSettings'> | Prisma.TransactionClient,
): Promise<ShippingConfig> {
  const settings = await db.storeSettings.findUnique({ where: { id: 1 } });
  if (!settings) return DEFAULT_SHIPPING_CONFIG;
  return { flatShippingFee: settings.flatShippingFee, freeShippingThreshold: settings.freeShippingThreshold };
}
