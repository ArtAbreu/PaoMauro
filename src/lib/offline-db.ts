"use client";

import Dexie, { Table } from "dexie";

export interface PendingOrder {
  id: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface PendingCashClose {
  id: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

class OfflineDatabase extends Dexie {
  orders!: Table<PendingOrder>;
  cashClosings!: Table<PendingCashClose>;

  constructor() {
    super("pao-do-mauro-offline");
    this.version(1).stores({
      orders: "id,createdAt",
      cashClosings: "id,createdAt",
    });
  }
}

export const offlineDb = new OfflineDatabase();

export async function queueOrder(payload: Record<string, unknown>) {
  const id = crypto.randomUUID();
  await offlineDb.orders.put({ id, payload, createdAt: Date.now() });
  return id;
}

export async function queueCashClosing(payload: Record<string, unknown>) {
  const id = crypto.randomUUID();
  await offlineDb.cashClosings.put({ id, payload, createdAt: Date.now() });
  return id;
}

export async function flushOrders(sync: (payload: Record<string, unknown>) => Promise<void>) {
  const pending = await offlineDb.orders.toArray();
  for (const item of pending) {
    await sync(item.payload);
    await offlineDb.orders.delete(item.id);
  }
}

export async function flushCashClosings(sync: (payload: Record<string, unknown>) => Promise<void>) {
  const pending = await offlineDb.cashClosings.toArray();
  for (const item of pending) {
    await sync(item.payload);
    await offlineDb.cashClosings.delete(item.id);
  }
}
