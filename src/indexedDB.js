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
  // datatostore.idp = id
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




// const clearSyncTableBeforeId = (idThreshold ) => {
//   return new Promise((resolve, reject) => {
//     const openRequest = indexedDB.open(DB_NAME); // Replace with your actual DB name

//     openRequest.onerror = (event) => {
//       reject(`Database error: ${event.target.error}`);
//     };

//     openRequest.onsuccess = (event) => {
//       const db = event.target.result;
//       const tx = db.transaction(SYNC_STORE, "readwrite");
//       const store = tx.objectStore(SYNC_STORE);
//       let deletedCount = 0;

//       // const range = IDBKeyRange.bound(idThreshold, idThreshold1, false, false);
//       // const cursorRequest = store.openCursor(range);
//       const range = IDBKeyRange.upperBound(idThreshold);
//       const cursorRequest = store.openCursor(range);

//       cursorRequest.onsuccess = (event) => {
//         const cursor = event.target.result;

//         if (cursor) {
//           cursor.delete();
//           deletedCount++;
//           cursor.continue();
//         }

//       };

//       cursorRequest.onerror = (event) => {
//         reject(`Cursor error: ${event.target.error}`);
//       };

//       // Handle transaction completion
//       tx.oncomplete = () => {
//         console.log(`Transaction completed. Deleted ${deletedCount} records.`);
//         resolve(deletedCount);
//       };

//       tx.onerror = (event) => {
//         reject(`Transaction error: ${event.target.error}`);
//       };
//     };
//   });
// };

const clearSyncTableBeforeId = (idThreshold) => {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(DB_NAME);

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
  if (!navigator.onLine) {
    console.log("Device is offline. Sync aborted.");
    return;
  }

  const syncData = await getAllSyncData(); // Get all unsynced data
  console.log("Sync Data:", syncData);

  if (syncData.length === 0) {
    console.log("No data to sync.");
    return;
  }

  const CHUNK_SIZE = 5; // Process 5 records at a time
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < syncData.length; i += CHUNK_SIZE) {
    const chunk = syncData.slice(i, i + CHUNK_SIZE);
    const fd = new FormData();
    console.log('Processing chunk:', chunk);
    fd.append("datatosync", JSON.stringify(chunk));

    try {
      const response = await server_post_data(
        "http://192.168.1.7:8000/api/super_admin_link/syncdata",
        fd
      );
      
      // Get the last ID that was successfully processed
      const lastSyncedId = response.data.last_id;
      
      if (response.status === 200) {
        // Check if there was an error during processing
        if (response.data.error === true) {
          console.error("Sync error:", response.data.message);
          failCount++;
          
          // If there's an error but we have a lastSyncedId, clear up to that point
          if (lastSyncedId > 0) {
            // await clearSyncTableBeforeId(lastSyncedId);
            console.log(`Cleared records with ID ≤ ${lastSyncedId}`);
          }
          
          // Break the loop to prevent processing more chunks
          break;
        } else {
          // Sync was successful
          console.log("Chunk synced successfully!");
          successCount++;
          
          // Clear successfully synced records
          if (lastSyncedId > 0) {
            // await clearSyncTableBeforeId(lastSyncedId);
            console.log(`Cleared records with ID ≤ ${lastSyncedId}`);
          }
        }
      } else {
        console.error("Failed to sync, server response:", response);
        failCount++;
        break; // Stop processing more chunks if this chunk failed
      }
    } catch (error) {
      console.error("Error syncing data:", error);
      failCount++;
      break; // Stop processing more chunks if there was an exception
    }
  }
  
  console.log(`Sync complete. Successful chunks: ${successCount}, Failed chunks: ${failCount}`);
  
  // Return sync status for UI notification
  // return {
  //   success: failCount === 0,
  //   successCount,
  //   failCount
  // };
};


