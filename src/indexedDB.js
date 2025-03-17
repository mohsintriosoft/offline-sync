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
export const addData = async (datatostore,tablename,fromwhr=0) => {
  console.log(tablename);

  const db = await initDB();
  const tx = db.transaction(tablename, "readwrite");
  const store = tx.objectStore(tablename);
  const id = await store.put(datatostore);
  ///console.log(id);
  datatostore.id = id
  await tx.done;
  if(fromwhr==0){ //not working in live case
  await addToSyncTable({ table: tablename, data: datatostore, action: "insert"  });
  }
};



// Update Guest Data
export const updateData = async (datatostore,tablename) => {
  const db = await initDB();
  const tx = db.transaction(tablename, "readwrite");
  const store = tx.objectStore(tablename);
  await store.put(datatostore);
  await tx.done;

  // Track update in sync table
  await addToSyncTable({ table: tablename, data: datatostore, action: "update"  });
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

// Clear Sync Table after successful sync
const clearSyncTableBeforeId = async (idThreshold) => {
  const db = await initDB();
  const tx = db.transaction(SYNC_STORE, "readwrite");
  const store = tx.objectStore(SYNC_STORE);

  const cursorRequest = store.openCursor();
  
  cursorRequest.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const record = cursor.value;
      if (record.id < idThreshold) {
        cursor.delete();  // Delete record if condition matches
      }
      cursor.continue();
    }
  };

  cursorRequest.onerror = (event) => {
    console.error('Error while clearing old records:', event.target.error);
  };

  await tx.done;
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

  const fd = new FormData();
  fd.append("datatosync", JSON.stringify(syncData));

  try {
    const response = await server_post_data(
      "http://127.0.0.1:7998/api/super_admin_link/syncdata",
      fd
    );

    if (response.status === 200) {
      console.log("Guests synced successfully!");

      const db = await initDB();
      const tx = db.transaction(SYNC_STORE, "readwrite");
      const store = tx.objectStore(SYNC_STORE);
      await store.clear(); // Clear the sync table
      await tx.done; // Wait for the transaction to complete
      console.log("Sync table cleared successfully!");
      //await clearSyncTableBeforeId(); // Clear sync table after success
    } else {
      console.error("Failed to sync, server response:", response);
    }
  } catch (error) {
    console.error("Error syncing guests:", error);
  }
};

