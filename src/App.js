import React, { useState, useEffect } from "react";
import { addData, updateData, getAllGuests, syncData,getSystemInfo,setSystemInfo } from "./indexedDB.js";
import axios from "axios";
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
    console.log(systemInfo)
    if (!systemInfo || !systemInfo.live_backup_stored) {
      console.log("First-time sync: Fetching live data...");
      try {
        const response = await server_post_data(
          "http://192.168.1.7:8000/api/super_admin_link/get_all_guests",
          null
        );
        // const response = await fetch("http://192.168.1.13:8000/api/super_admin_link/get_all_guests");
        const liveData = await response.json();
        console.log(liveData)
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
  const server_post_data = async (url_for, form_data) => {
    let packageName = "uprestro_crm";
    if (form_data === null) {
      form_data = new FormData();
    }
    form_data.append("admin_id", "dsfgdfg");
    console.log('package',packageName)
    return axios.post(url_for, form_data, {
      headers: {
        "X-Package-Name": packageName,
      },
    });
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
