import React, { useState, useEffect } from "react";
import { addData, updateData, getAllGuests, syncData,getSystemInfo,setSystemInfo } from "./indexedDB.js";

const App = () => {
  const [main_guest_infos, setGuests] = useState([]);
  const [form, setForm] = useState({ id: null, guest_name: "", guest_email: "" });

  useEffect(() => {
    LiveToLocalFistSync();
    loadGuests();
    
    
    window.addEventListener("online", syncData);
    return () => window.removeEventListener("online", syncData);
  }, []);
  
  const ManualSync = async () => {
    syncData();
  }

  const LiveToLocalFistSync = async () => {
    const systemInfo = await getSystemInfo(); // Get system data
  
    if (!systemInfo || !systemInfo.live_backup_stored) {
      console.log("First-time sync: Fetching live data...");
      try {
        const response = await fetch("http://127.0.0.1:7998/api/super_admin_link/get_all_guests");
        const liveData = await response.json();
        
        if (response.ok) {
          if(liveData.length > 0){
          for (const guest of liveData) {
            try {
                const parsedGuest = JSON.parse(
                    guest.guest_name.replace(/'/g, '"') // Convert single quotes to double quotes (so JSON.parse works)
                );
                console.log(parsedGuest);
        
                // Remove the `id` if you want IndexedDB to auto-generate it
                ///delete parsedGuest.id; 
        
                await addData(parsedGuest, "GuestInformation","live"); // Insert live data
            } catch (error) {
                console.error("Failed to parse guest_name:", guest.guest_name, error);
            }
          }

          // Mark live backup as stored
          await setSystemInfo({ live_backup_stored: true });
        }
        else{
          // Mark live backup as stored
          await setSystemInfo({ live_backup_stored: true });
        }
  
          
        }
      } catch (error) {
        console.error("Failed to fetch live data:", error);
      }
    }
  
    // Load guests from IndexedDB
    const updatedData = await getAllGuests();
    setGuests(updatedData);
  };
  

  const loadGuests = async () => {
    const data = await getAllGuests();
    setGuests(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.id) {
      await updateData(form,"GuestInformation");
    } else {
      //console.log(form);
      //form.id = Date.now();
      delete form.id;
      //console.log(form);
      await addData(form,"GuestInformation");
    }
    setForm({ id: null, guest_name: "", guest_email: "" });
    loadGuests();
  };

  const handleEdit = (GuestInformation) => {
    setForm(GuestInformation);
  };

  return (
    <div>
      <h1>Guest Management  <button onClick={() => ManualSync()}>Manual Sync</button></h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={form.guest_name}
          onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Email"
          value={form.guest_email}
          onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
          required
        />
        <button type="submit">{form.id ? "Update" : "Add"} Guest</button>
      </form>

      <h3>Guest List</h3>
      <ul>
        {main_guest_infos.map((GuestInformation) => (
          <li key={GuestInformation.id}>
            {GuestInformation.guest_name} - {GuestInformation.guest_email}{" "}
            <button onClick={() => handleEdit(GuestInformation)}>Edit</button>
          </li>
        ))}
      </ul>
    </div>
  );
  
  
};

export default App;
