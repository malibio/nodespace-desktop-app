import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { DateNavigationBar } from "./components/DateNavigationBar";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());

  async function greet() {
    try {
      setGreetMsg(await invoke("greet", { name }));
    } catch (error) {
      console.error("Failed to greet:", error);
      setGreetMsg("Error: Failed to greet. Please try again.");
    }
  }

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    // TODO: Connect to core-logic date navigation services when NS-32 is complete
    console.log("Date changed to:", date.toDateString());
  };

  return (
    <div className="container">
      <DateNavigationBar 
        selectedDate={selectedDate} 
        onDateChange={handleDateChange} 
      />
      
      <h1>Welcome to NodeSpace!</h1>
      <p>Currently viewing: {selectedDate.toDateString()}</p>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>

      <p>{greetMsg}</p>
    </div>
  );
}

export default App;