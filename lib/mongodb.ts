import { MongoClient, type Db } from "mongodb";

interface MongoGlobals {
  clientPromise?: Promise<MongoClient>;
  warned?: boolean;
  retryAfter?: number;
}

const globals = globalThis as typeof globalThis & { __voltMindMongo?: MongoGlobals };
globals.__voltMindMongo ??= {};
const state = globals.__voltMindMongo;

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export async function getMongoDatabase(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return null;
  if (state.retryAfter && Date.now() < state.retryAfter) return null;

  state.clientPromise ??= new MongoClient(uri, {
    maxPoolSize: 5,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5_000,
  }).connect();

  try {
    const client = await state.clientPromise;
    state.warned = false;
    state.retryAfter = undefined;
    return client.db("voltmind");
  } catch (error) {
    state.clientPromise = undefined;
    state.retryAfter = Date.now() + 30_000;
    if (!state.warned) {
      state.warned = true;
      console.error(
        "[MongoDB] History persistence unavailable:",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }
}
