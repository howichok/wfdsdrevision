import Dexie, { type EntityTable } from "dexie";

interface LocalDocument {
  id: string;
  title: string;
  content: string;
  contentJson: object | null;
  syncedAt: number | null;
  isDirty: boolean;
  updatedAt: number;
}

interface LocalEmbeddingCache {
  id: string;
  documentId: string;
  chunkIndex: number;
  chunkText: string;
  embedding: number[];
  createdAt: number;
}

class AppDatabase extends Dexie {
  documents!: EntityTable<LocalDocument, "id">;
  embeddingCache!: EntityTable<LocalEmbeddingCache, "id">;

  constructor() {
    super("AppDatabase");
    this.version(1).stores({
      documents: "id, isDirty, updatedAt",
      embeddingCache: "id, documentId, chunkIndex",
    });
  }
}

let _db: AppDatabase | null = null;

export function getLocalDb(): AppDatabase {
  if (typeof window === "undefined")
    throw new Error("Dexie is only available in browser environments");
  if (!_db) _db = new AppDatabase();
  return _db;
}
