const DATABASE = "mymarket-workbooks";
const STORE = "workbooks";
const KEY = "last-import";
export type StoredWorkbook = {
  name: string;
  savedAt: string;
  buffer: ArrayBuffer;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error("Le stockage local n’est pas disponible dans ce navigateur."),
      );
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(
        new Error(
          "Le stockage local ne répond pas. Réessayez hors navigation privée ou dans un onglet direct.",
        ),
      );
    }, 5000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        request.error || new Error("Impossible d’ouvrir le stockage local."),
      );
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

// Toutes les mutations sont ordonnées ; une opération devenue obsolète est ignorée.
let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = pending.then(operation);
  pending = next.catch(() => undefined);
  return next;
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    let result: T;
    try {
      tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      request.onsuccess = () => {
        result = request.result;
      };
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    // request success alone is not enough: wait for the durable commit.
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("L’enregistrement local a été interrompu."));
    };
    tx.onerror = () => {
      /* L’échec abort suit et rejette la transaction atomique. */
    };
  });
}
export function readStoredWorkbook(): Promise<StoredWorkbook | null> {
  return serialize(async () => {
    const value: unknown = await transaction("readonly", (store) =>
      store.get(KEY),
    );
    if (value === undefined) return null;
    if (!value || typeof value !== "object")
      throw new Error("La sauvegarde locale est illisible.");
    const record = value as Partial<StoredWorkbook>;
    if (
      typeof record.name !== "string" ||
      typeof record.savedAt !== "string" ||
      !record.buffer ||
      typeof record.buffer.byteLength !== "number"
    )
      throw new Error("La sauvegarde locale est incompatible.");
    // IndexedDB fait un clone structuré : recréer le tampon dans le contexte
    // courant garantit la lecture XLSX, y compris en iframe ou autre realm.
    return {
      name: record.name,
      savedAt: record.savedAt,
      buffer: Uint8Array.from(new Uint8Array(record.buffer)).buffer,
    };
  });
}
export function saveStoredWorkbook(
  record: StoredWorkbook,
  isCurrent = () => true,
): Promise<boolean> {
  return serialize(async () => {
    if (!isCurrent()) return false;
    await transaction("readwrite", (store) => {
      if (!isCurrent())
        throw new Error("Import remplacé par une opération plus récente.");
      return store.put(record, KEY);
    });
    return true;
  });
}
export function clearStoredWorkbook(isCurrent = () => true): Promise<boolean> {
  return serialize(async () => {
    if (!isCurrent()) return false;
    await transaction("readwrite", (store) => {
      if (!isCurrent())
        throw new Error("Changement remplacé par une opération plus récente.");
      return store.delete(KEY);
    });
    return true;
  });
}
