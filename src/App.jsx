import React, { useState, useEffect } from "react";
import mqtt from "mqtt";
import EnergyMonitoring from "./EnergyMonitoring";
import WeatherIntegration from "./WeatherIntegration";
import SecurityFeatures from "./SecurityFeatures";

// Main App Component with Auth
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Check if user is already logged in on component mount
  useEffect(() => {
    const loggedInUser = localStorage.getItem("currentUser");
    if (loggedInUser) {
      setCurrentUser(JSON.parse(loggedInUser));
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  return (
    <div>
      {isAuthenticated ? (
        <Dashboard currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <AuthForm
          onAuthenticated={(user) => {
            setCurrentUser(user);
            setIsAuthenticated(true);
            localStorage.setItem("currentUser", JSON.stringify(user));
          }}
        />
      )}
    </div>
  );
};

// Authentication Form Component
const AuthForm = ({ onAuthenticated }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Username and password are required");
      return;
    }

    if (isLogin) {
      // Login logic
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      const user = users.find(
        (u) => u.username === username && u.password === password
      );

      if (user) {
        // Load user preferences if they exist
        const userPrefs = JSON.parse(
          localStorage.getItem(`prefs_${username}`) || "{}"
        );
        const userWithPrefs = { ...user, preferences: userPrefs };
        onAuthenticated(userWithPrefs);
      } else {
        setError("Invalid username or password");
      }
    } else {
      // Register logic
      const users = JSON.parse(localStorage.getItem("users") || "[]");

      if (users.some((user) => user.username === username)) {
        setError("Username already exists");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      const newUser = {
        username,
        password,
        preferences: {
          darkMode: false,
          defaultTemperature: 22,
        },
      };

      users.push(newUser);
      localStorage.setItem("users", JSON.stringify(users));

      // Also create user preferences
      localStorage.setItem(
        `prefs_${username}`,
        JSON.stringify({
          darkMode: false,
          defaultTemperature: 22,
        })
      );

      onAuthenticated(newUser);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-indigo-600">
            🏠 Smart Home Dashboard
          </h1>
          <h2 className="mt-6 text-center text-xl font-bold text-gray-900">
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </h2>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isLogin ? "Sign in" : "Sign up"}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-indigo-600 hover:text-indigo-500"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard = ({ currentUser, onLogout }) => {
  const [lightOn, setLightOn] = useState(false);
  const [temperature, setTemperature] = useState(
    currentUser?.preferences?.defaultTemperature || 22
  );
  const [doorLocked, setDoorLocked] = useState(true);
  const [motionDetected, setMotionDetected] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [client, setClient] = useState(null);
  const [darkMode, setDarkMode] = useState(
    currentUser?.preferences?.darkMode || false
  );

  // Save user preferences whenever they change
  useEffect(() => {
    if (currentUser) {
      const updatedPrefs = {
        ...currentUser.preferences,
        darkMode,
        defaultTemperature: temperature,
      };

      localStorage.setItem(
        `prefs_${currentUser.username}`,
        JSON.stringify(updatedPrefs)
      );

      // Update the current user object as well
      const updatedUser = {
        ...currentUser,
        preferences: updatedPrefs,
      };
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    }
  }, [darkMode, temperature, currentUser]);

  // Connect to MQTT broker when component mounts
  useEffect(() => {
    // Use WebSocket connection for browser environment
    const mqttClient = mqtt.connect("wss://test.mosquitto.org:8081");

    mqttClient.on("connect", () => {
      console.log("Connected to MQTT broker");
      setConnectionStatus("Connected");
      mqttClient.subscribe("home/motion");
      mqttClient.subscribe("home/temperature");
    });

    mqttClient.on("error", (err) => {
      console.error("MQTT connection error:", err);
      setConnectionStatus(`Error: ${err.message}`);
    });

    mqttClient.on("message", (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        console.log(`Received message on ${topic}:`, payload);

        if (topic === "home/motion" && payload.motion !== undefined) {
          if (payload.motion) {
            setMotionDetected(true);
            setTimeout(() => setMotionDetected(false), 5000);
          }
        }

        if (topic === "home/temperature" && payload.temperature !== undefined) {
          setTemperature(payload.temperature);
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    });

    setClient(mqttClient);

    // Clean up MQTT connection when component unmounts
    return () => {
      if (mqttClient) {
        mqttClient.end();
      }
    };
  }, []);

  // Schedule light toggle
  useEffect(() => {
    if (!scheduleTime || !client) return;

    const now = new Date();
    const scheduled = new Date(scheduleTime);
    const diff = scheduled - now;

    if (diff > 0) {
      console.log(`Light scheduled to toggle in ${diff}ms`);
      const timer = setTimeout(() => {
        const newState = !lightOn;
        setLightOn(newState);
        if (client.connected) {
          client.publish("home/light", JSON.stringify({ light: newState }));
          alert("Light toggled at scheduled time!");
        }
      }, diff);
      return () => clearTimeout(timer);
    }
  }, [scheduleTime, client, lightOn]);

  const toggleLight = () => {
    if (!client || !client.connected) {
      alert("MQTT connection not available");
      return;
    }

    const newState = !lightOn;
    setLightOn(newState);
    client.publish("home/light", JSON.stringify({ light: newState }));
    console.log("Light toggled to:", newState);
  };

  const handleTemperatureChange = (e) => {
    if (!client || !client.connected) {
      alert("MQTT connection not available");
      return;
    }

    const newTemp = parseInt(e.target.value);
    setTemperature(newTemp);
    client.publish(
      "home/temperature",
      JSON.stringify({ temperature: newTemp })
    );
    console.log("Temperature set to:", newTemp);
  };

  const toggleDoorLock = () => {
    if (!client || !client.connected) {
      alert("MQTT connection not available");
      return;
    }

    const newState = !doorLocked;
    setDoorLocked(newState);
    client.publish("home/door", JSON.stringify({ locked: newState }));
    console.log("Door lock toggled to:", newState ? "Locked" : "Unlocked");
  };

  // Simulate receiving motion data (for testing purposes)
  const simulateMotion = () => {
    if (client && client.connected) {
      client.publish("home/motion", JSON.stringify({ motion: true }));
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div
      className={`min-h-screen py-10 px-6 transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"
      }`}
    >
      <div
        className={`max-w-3xl mx-auto shadow-lg rounded-xl p-8 space-y-10 transition-colors duration-300 ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="flex justify-between items-center">
          <div>
            <h1
              className={`text-3xl font-bold ${
                darkMode ? "text-indigo-400" : "text-indigo-600"
              }`}
            >
              🏠 Smart Home Dashboard
            </h1>
            <p
              className={`text-sm mt-1 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Welcome, {currentUser.username}!
            </p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-full ${
                darkMode
                  ? "bg-gray-700 text-yellow-300"
                  : "bg-gray-200 text-gray-800"
              }`}
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button
              onClick={onLogout}
              className={`px-3 py-1 rounded text-sm ${
                darkMode
                  ? "bg-red-700 hover:bg-red-800"
                  : "bg-red-500 hover:bg-red-600"
              } text-white`}
            >
              Logout
            </button>
          </div>
        </div>

        <div
          className={`p-3 rounded-lg transition-colors duration-300 ${
            darkMode ? "bg-gray-700" : "bg-gray-50"
          }`}
        >
          <p className="text-sm">
            MQTT Status:{" "}
            <span
              className={
                connectionStatus === "Connected"
                  ? "text-green-500"
                  : "text-red-500"
              }
            >
              {connectionStatus}
            </span>
          </p>
        </div>

        {/* Light Control */}
        <div className="space-y-2">
          <h2
            className={`text-xl font-semibold transition-colors duration-300 ${
              darkMode ? "text-gray-200" : "text-gray-800"
            }`}
          >
            💡 Light Control
          </h2>
          <p>
            Status:{" "}
            <span className={lightOn ? "text-green-500" : "text-red-500"}>
              {lightOn ? "ON" : "OFF"}
            </span>
          </p>
          <button
            onClick={toggleLight}
            className={`px-4 py-2 rounded transition-colors duration-300 ${
              darkMode
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-500 hover:bg-blue-600"
            } text-white`}
            disabled={!client || !client.connected}
          >
            Turn {lightOn ? "OFF" : "ON"}
          </button>
          <div className="mt-2">
            <label className="block text-sm font-medium">
              Schedule Light Toggle:
            </label>
            <input
              type="datetime-local"
              className={`mt-1 border rounded px-2 py-1 w-full transition-colors duration-300 ${
                darkMode
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "border-gray-300"
              }`}
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
          </div>
        </div>

        <hr
          className={`transition-colors duration-300 ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}
        />

        {/* Thermostat */}
        <div className="space-y-2">
          <h2
            className={`text-xl font-semibold transition-colors duration-300 ${
              darkMode ? "text-gray-200" : "text-gray-800"
            }`}
          >
            🌡️ Thermostat
          </h2>
          <input
            type="range"
            min="16"
            max="30"
            className="w-full"
            value={temperature}
            onChange={handleTemperatureChange}
            disabled={!client || !client.connected}
          />
          <p
            className={`transition-colors duration-300 ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Current Temperature: <strong>{temperature}°C</strong>
          </p>
        </div>

        <hr
          className={`transition-colors duration-300 ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}
        />

        {/* Door Lock */}
        <div className="space-y-2">
          <h2
            className={`text-xl font-semibold transition-colors duration-300 ${
              darkMode ? "text-gray-200" : "text-gray-800"
            }`}
          >
            🔒 Door Lock
          </h2>
          <p>
            Status:{" "}
            <span className={doorLocked ? "text-green-500" : "text-red-500"}>
              {doorLocked ? "Locked" : "Unlocked"}
            </span>
          </p>
          <button
            onClick={toggleDoorLock}
            className={`px-4 py-2 rounded transition-colors duration-300 ${
              darkMode
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-purple-500 hover:bg-purple-600"
            } text-white`}
            disabled={!client || !client.connected}
          >
            {doorLocked ? "Unlock Door" : "Lock Door"}
          </button>
        </div>

        <hr
          className={`transition-colors duration-300 ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}
        />

        {/* Motion Detection */}
        <div className="space-y-2">
          <h2
            className={`text-xl font-semibold transition-colors duration-300 ${
              darkMode ? "text-gray-200" : "text-gray-800"
            }`}
          >
            🎯 Motion Detection
          </h2>
          {motionDetected ? (
            <p className="text-red-600 font-bold animate-pulse">
              ⚠️ Motion Detected!
            </p>
          ) : (
            <p
              className={`transition-colors duration-300 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              No motion detected.
            </p>
          )}
          <button
            onClick={simulateMotion}
            className={`px-4 py-2 rounded text-sm transition-colors duration-300 ${
              darkMode
                ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                : "bg-gray-300 hover:bg-gray-400 text-gray-800"
            }`}
            disabled={!client || !client.connected}
          >
            Simulate Motion
          </button>
        </div>
        <hr
          className={`transition-colors duration-300 ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}
        />

        {/* Energy Monitoring */}
        <EnergyMonitoring
          client={client}
          darkMode={darkMode}
          currentUser={currentUser}
        />
        <hr
          className={`transition-colors duration-300 ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}
        />
        {/* Weather Integration */}
        <WeatherIntegration
          client={client}
          darkMode={darkMode}
          currentUser={currentUser}
        />
        <hr
          className={`transition-colors duration-300 ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}
        />
        <SecurityFeatures
          client={client}
          darkMode={darkMode}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
};

export default App;
