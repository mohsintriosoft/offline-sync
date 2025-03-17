import { openDB } from "idb";
import axios from "axios";
const DB_NAME = "offlineDB";
const DB_VERSION = 3; // Increment version when updating schema
const GUEST_STORE = "GuestInformation";
const SYNC_STORE = "sync";
const SYSTEM_TABLE = "systemtable";
// Initialize IndexedDB
const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(GUEST_STORE)) {
        db.createObjectStore(GUEST_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(SYSTEM_TABLE)) {
        db.createObjectStore(SYSTEM_TABLE, { keyPath: "id" }); // System settings table
      }
    },
  });
};


// Get System Info
export const getSystemInfo = async () => {
  const db = await initDB();
  return db.get(SYSTEM_TABLE, 1); // Assuming single entry with id = 1
};

// Set System Info
export const setSystemInfo = async (data) => {
  const db = await initDB();
  const tx = db.transaction(SYSTEM_TABLE, "readwrite");
  const store = tx.objectStore(SYSTEM_TABLE);
  await store.put({ id: 1, ...data }); // Always store under id=1
  await tx.done;
};

// Add Guest Data
export const addData = async (datatostore, tablename, fromwhr = 0) => {
  console.log(tablename);

  const db = await initDB();
  const tx = db.transaction(tablename, "readwrite");
  const store = tx.objectStore(tablename);
  const id = await store.put(datatostore);
  ///console.log(id);
  datatostore.id = id
  await tx.done;
  if (fromwhr == 0) { //not working in live case
    await addToSyncTable({ table: tablename, data: datatostore, action: "insert" });
  }
};



// Update Guest Data
export const updateData = async (datatostore, tablename) => {
  const db = await initDB();
  const tx = db.transaction(tablename, "readwrite");
  const store = tx.objectStore(tablename);
  await store.put(datatostore);
  await tx.done;

  // Track update in sync table
  await addToSyncTable({ table: tablename, data: datatostore, action: "update" });
};

// Get All Guests
export const getAllGuests = async () => {
  const db = await initDB();
  return db.getAll(GUEST_STORE);
};


export const getAllSyncData = async () => {
  const db = await initDB();
  return db.getAll(SYNC_STORE);
};

// Add to Sync Table
const addToSyncTable = async (data) => {
  const db = await initDB();
  const tx = db.transaction(SYNC_STORE, "readwrite");
  const store = tx.objectStore(SYNC_STORE);
  await store.add(data);
  await tx.done;
};




const clearSyncTableBeforeId = (idThreshold) => {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(DB_NAME); // Replace with your actual DB name

    openRequest.onerror = (event) => {
      reject(`Database error: ${event.target.error}`);
    };

    openRequest.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction(SYNC_STORE, "readwrite");
      const store = tx.objectStore(SYNC_STORE);
      let deletedCount = 0;

      const range = IDBKeyRange.upperBound(idThreshold);
      const cursorRequest = store.openCursor(range);

      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }

      };

      cursorRequest.onerror = (event) => {
        reject(`Cursor error: ${event.target.error}`);
      };

      // Handle transaction completion
      tx.oncomplete = () => {
        console.log(`Transaction completed. Deleted ${deletedCount} records.`);
        resolve(deletedCount);
      };

      tx.onerror = (event) => {
        reject(`Transaction error: ${event.target.error}`);
      };
    };
  });
};










const server_post_data = async (url_for, form_data) => {
  let packageName = "uprestro_crm";
  if (form_data === null) {
    form_data = new FormData();
  }
  form_data.append("admin_id", "dsfgdfg");
  return axios.post(url_for, form_data, {
    headers: {
      "X-Package-Name": packageName,
    },
  });
};

// Sync Data to Server
export const syncData = async () => {
  if (!navigator.onLine) return;

  const syncData = await getAllSyncData(); // Get all unsynced guests
  console.log("Sync Data:", syncData);

  if (syncData.length === 0) return;

  const CHUNK_SIZE = 2; // Adjust based on your server capabilities
  let lastSyncedId = 0;
  for (let i = 0; i < syncData.length; i += CHUNK_SIZE) {
    const chunk = syncData.slice(i, i + CHUNK_SIZE);
    const fd = new FormData();
    const highestIdInChunk = Math.max(...chunk.map(record => record.id));
    console.log('chunk', chunk)
    console.log('highestIdInChunk', highestIdInChunk)
    fd.append("datatosync", JSON.stringify(chunk));

    try {
      const response = await server_post_data(
        "http://192.168.1.13:8000/api/super_admin_link/syncdata",
        fd
      );
      if (response.data.error === true){
        lastSyncedId = response.data.last_id
      }
      if (response.status === 200) {
        console.log("Guests synced successfully!");
        lastSyncedId = highestIdInChunk;
        if (lastSyncedId > 0) {
          await clearSyncTableBeforeId(lastSyncedId);
          console.log(`Cleared all records with ID ≤ ${lastSyncedId}`);
        }
      } else {
        console.error("Failed to sync, server response:", response);
      }
    } catch (error) {
      console.error("Error syncing guests:", error);
    }
  }
};

// export const syncData = async () => {
//   if (!navigator.onLine) return;

//   const syncData = await getAllSyncData(); // Get all unsynced guests
//   console.log("Sync Data:", syncData);

//   if (syncData.length === 0) return;

//   const CHUNK_SIZE = 2; // Adjust based on server capability
//   const MAX_RETRIES = 3; // Max retry attempts per chunk
//   const CONCURRENT_REQUESTS = 2; // Number of parallel requests

//   let lastSyncedId = 0;
//   let failedChunks = [];

//   // Function to sync a single chunk with retry logic
//   async function syncChunk(chunk, attempt = 1) {
//     const fd = new FormData();
//     const highestIdInChunk = Math.max(...chunk.map(record => record.id));
//     fd.append("datatosync", JSON.stringify(chunk));

//     try {
//       const response = await server_post_data(
//         "http://192.168.1.13:8000/api/super_admin_link/syncdata",
//         fd
//       );

//       if (response.status === 200) {
//         console.log("Guests synced successfully!");
//         return highestIdInChunk;
//       } else if (response.data.error === true) {
//         console.warn("Server error:", response.data.message);
//         return response.data.last_id || null; // Use last_id if provided
//       } else {
//         throw new Error(`Unexpected response: ${JSON.stringify(response.data)}`);
//       }
//     } catch (error) {
//       console.error(`Sync failed (Attempt ${attempt}):`, error);

//       if (attempt < MAX_RETRIES) {
//         console.log(`Retrying in ${attempt * 2} seconds...`);
//         await new Promise(resolve => setTimeout(resolve, attempt * 2000)); // Exponential backoff
//         return syncChunk(chunk, attempt + 1);
//       } else {
//         console.error(`Failed after ${MAX_RETRIES} attempts.`);
//         failedChunks.push(chunk);
//         return null;
//       }
//     }
//   }

//   // Process chunks in parallel with concurrency control
//   async function processChunks() {
//     for (let i = 0; i < syncData.length; i += CHUNK_SIZE * CONCURRENT_REQUESTS) {
//       const chunkGroup = [];

//       for (let j = 0; j < CONCURRENT_REQUESTS; j++) {
//         const chunk = syncData.slice(i + j * CHUNK_SIZE, i + (j + 1) * CHUNK_SIZE);
//         if (chunk.length > 0) {
//           chunkGroup.push(syncChunk(chunk));
//         }
//       }

//       const results = await Promise.all(chunkGroup);
//       const successfulIds = results.filter(id => id !== null);

//       if (successfulIds.length > 0) {
//         lastSyncedId = Math.max(...successfulIds);
//         await clearSyncTableBeforeId(lastSyncedId);
//         console.log(`Cleared all records with ID ≤ ${lastSyncedId}`);
//       }
//     }

//     if (failedChunks.length > 0) {
//       console.warn("Some chunks failed to sync. Consider retrying later.");
//     }
//   }

//   await processChunks();
// };