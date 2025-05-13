import React, { useState, useEffect } from "react";

// Security Features Component for Smart Home Dashboard
const SecurityFeatures = ({ client, darkMode, currentUser }) => {
  const [cameraOn, setCameraOn] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const [alarmArmed, setAlarmArmed] = useState(false);
  const [alarmTriggered, setAlarmTriggered] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("frontDoor");

  // Camera locations
  const cameraLocations = {
    frontDoor: "Front Door",
    backyard: "Backyard",
    livingRoom: "Living Room",
    garage: "Garage"
  };

  // Initialize security preferences from user data
  useEffect(() => {
    if (currentUser?.preferences?.securityPrefs) {
      setCameraOn(currentUser.preferences.securityPrefs.cameraOn || false);
      setAlarmArmed(currentUser.preferences.securityPrefs.alarmArmed || false);
    }

    // Load activity log from localStorage
    const savedLog = localStorage.getItem(`security_log_${currentUser?.username}`);
    if (savedLog) {
      setActivityLog(JSON.parse(savedLog));
    } else {
      // Initialize with sample data if no log exists
      const initialLog = [
        { type: "system", timestamp: Date.now() - 86400000, message: "Security system initialized" }
      ];
      setActivityLog(initialLog);
      localStorage.setItem(`security_log_${currentUser?.username}`, JSON.stringify(initialLog));
    }
  }, [currentUser]);

  // Save security preferences when they change
  useEffect(() => {
    if (currentUser) {
      const updatedPrefs = {
        ...currentUser.preferences,
        securityPrefs: {
          cameraOn,
          alarmArmed
        }
      };

      localStorage.setItem(
        `prefs_${currentUser.username}`,
        JSON.stringify(updatedPrefs)
      );
    }
  }, [cameraOn, alarmArmed, currentUser]);

  // MQTT subscription for security events
  useEffect(() => {
    if (client && client.connected) {
      client.subscribe("home/security/motion");
      client.subscribe("home/security/door");
      client.subscribe("home/security/alarm");

      client.on("message", (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          
          if (topic === "home/security/motion" && payload.detected) {
            logActivity("motion", `Motion detected at ${payload.location || "unknown location"}`);
            
            // If alarm is armed, trigger it on motion
            if (alarmArmed && !alarmTriggered) {
              setAlarmTriggered(true);
              client.publish("home/security/alarm", JSON.stringify({ triggered: true }));
            }
          }
          
          if (topic === "home/security/door" && payload.action) {
            logActivity("door", `Door ${payload.action} at ${payload.location || "main entrance"}`);
            
            // If alarm is armed and door is opened, trigger alarm
            if (alarmArmed && payload.action === "opened" && !alarmTriggered) {
              setAlarmTriggered(true);
              client.publish("home/security/alarm", JSON.stringify({ triggered: true }));
            }
          }
          
          if (topic === "home/security/alarm" && payload.reset) {
            setAlarmTriggered(false);
          }
        } catch (error) {
          console.error("Error processing security message:", error);
        }
      });
    }
    
    return () => {
      if (client && client.connected) {
        client.unsubscribe("home/security/motion");
        client.unsubscribe("home/security/door");
        client.unsubscribe("home/security/alarm");
      }
    };
  }, [client, alarmArmed, alarmTriggered]);

  // Take camera snapshot
  const takeSnapshot = () => {
    if (!cameraOn) {
      alert("Camera is turned off. Please turn it on first.");
      return;
    }
    
    // Simulate taking a snapshot with timestamp
    const timestamp = new Date().toLocaleString();
    const newSnapshot = {
      id: Date.now(),
      timestamp,
      location: selectedCamera,
      imagePlaceholder: `/api/placeholder/640/480`
    };
    
    setLastSnapshot(newSnapshot);
    logActivity("camera", `Snapshot taken from ${cameraLocations[selectedCamera]}`);
  };

  // Toggle camera on/off
  const toggleCamera = () => {
    const newState = !cameraOn;
    setCameraOn(newState);
    
    if (client && client.connected) {
      client.publish("home/security/camera", JSON.stringify({ enabled: newState }));
    }
    
    logActivity("system", `Camera ${newState ? "activated" : "deactivated"}`);
  };

  // Arm/disarm alarm system
  const toggleAlarm = () => {
    const newState = !alarmArmed;
    setAlarmArmed(newState);
    setAlarmTriggered(false);
    
    if (client && client.connected) {
      client.publish("home/security/alarm", JSON.stringify({ 
        armed: newState,
        triggered: false 
      }));
    }
    
    logActivity("system", `Alarm system ${newState ? "armed" : "disarmed"}`);
  };

  // Reset triggered alarm
  const resetAlarm = () => {
    setAlarmTriggered(false);
    
    if (client && client.connected) {
      client.publish("home/security/alarm", JSON.stringify({ 
        reset: true,
        triggered: false 
      }));
    }
    
    logActivity("system", "Alarm reset");
  };

  // Simulate door/motion events for testing
  const simulateEvent = (type) => {
    if (client && client.connected) {
      if (type === "motion") {
        client.publish("home/security/motion", JSON.stringify({ 
          detected: true,
          location: cameraLocations[selectedCamera]
        }));
      } else if (type === "door") {
        client.publish("home/security/door", JSON.stringify({ 
          action: "opened",
          location: "Front Door"
        }));
      }
    }
  };

  // Log security activity
  const logActivity = (type, message) => {
    const newEntry = {
      id: Date.now(),
      type,
      timestamp: Date.now(),
      message
    };
    
    const updatedLog = [newEntry, ...activityLog].slice(0, 50); // Keep last 50 entries
    setActivityLog(updatedLog);
    
    // Save to localStorage
    if (currentUser) {
      localStorage.setItem(`security_log_${currentUser.username}`, JSON.stringify(updatedLog));
    }
  };

  // Format timestamp for display
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get activity log icon based on type
  const getActivityIcon = (type) => {
    switch (type) {
      case "motion": return "🔍";
      case "door": return "🚪";
      case "camera": return "📷";
      case "alarm": return "🚨";
      case "system": return "⚙️";
      default: return "ℹ️";
    }
  };

  return (
    <div className="space-y-6">
      <h2 className={`text-xl font-semibold transition-colors duration-300 ${
        darkMode ? "text-gray-200" : "text-gray-800"
      }`}>
        🔐 Security System
      </h2>

      {/* Alarm Status & Controls */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${
        darkMode ? "bg-gray-700" : "bg-gray-50"
      }`}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className={`font-medium ${darkMode ? "text-gray-200" : "text-gray-800"}`}>
              Alarm System
            </h3>
            <p className={alarmTriggered ? "text-red-500 font-bold animate-pulse" : ""}>
              Status: {alarmTriggered ? "⚠️ TRIGGERED!" : (alarmArmed ? "Armed" : "Disarmed")}
            </p>
          </div>
          <div className="space-x-2">
            <button
              onClick={toggleAlarm}
              className={`px-3 py-1 rounded transition-colors duration-300 ${
                alarmArmed
                  ? (darkMode ? "bg-red-700 hover:bg-red-800" : "bg-red-500 hover:bg-red-600")
                  : (darkMode ? "bg-green-700 hover:bg-green-800" : "bg-green-500 hover:bg-green-600")
              } text-white`}
              disabled={!client || !client.connected || alarmTriggered}
            >
              {alarmArmed ? "Disarm" : "Arm"} System
            </button>
            {alarmTriggered && (
              <button
                onClick={resetAlarm}
                className={`px-3 py-1 rounded transition-colors duration-300 ${
                  darkMode ? "bg-yellow-600 hover:bg-yellow-700" : "bg-yellow-500 hover:bg-yellow-600"
                } text-white`}
              >
                Reset Alarm
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Camera Controls */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${
        darkMode ? "bg-gray-700" : "bg-gray-50"
      }`}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className={`font-medium ${darkMode ? "text-gray-200" : "text-gray-800"}`}>
              Security Cameras
            </h3>
            <p>Status: <span className={cameraOn ? "text-green-500" : "text-red-500"}>
              {cameraOn ? "Active" : "Inactive"}
            </span></p>
          </div>
          <button
            onClick={toggleCamera}
            className={`px-3 py-1 rounded transition-colors duration-300 ${
              cameraOn
                ? (darkMode ? "bg-red-700 hover:bg-red-800" : "bg-red-500 hover:bg-red-600")
                : (darkMode ? "bg-green-700 hover:bg-green-800" : "bg-green-500 hover:bg-green-600")
            } text-white`}
            disabled={!client || !client.connected}
          >
            {cameraOn ? "Turn Off" : "Turn On"}
          </button>
        </div>

        <div className="mb-4">
          <label className={`block text-sm font-medium mb-1 ${
            darkMode ? "text-gray-300" : "text-gray-700"
          }`}>
            Select Camera:
          </label>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className={`w-full p-2 border rounded transition-colors duration-300 ${
              darkMode 
                ? "bg-gray-800 border-gray-600 text-white" 
                : "bg-white border-gray-300"
            }`}
            disabled={!cameraOn}
          >
            {Object.entries(cameraLocations).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>
        </div>

        <div className="flex space-x-2 mb-4">
          <button
            onClick={takeSnapshot}
            className={`px-3 py-1 rounded transition-colors duration-300 ${
              darkMode
                ? "bg-blue-700 hover:bg-blue-800"
                : "bg-blue-500 hover:bg-blue-600"
            } text-white flex-1`}
            disabled={!cameraOn || !client || !client.connected}
          >
            Take Snapshot
          </button>
          <button
            onClick={() => simulateEvent("motion")}
            className={`px-3 py-1 rounded text-sm transition-colors duration-300 ${
              darkMode
                ? "bg-gray-800 hover:bg-gray-900"
                : "bg-gray-200 hover:bg-gray-300"
            } flex-1`}
            disabled={!client || !client.connected}
          >
            Simulate Motion
          </button>
          <button
            onClick={() => simulateEvent("door")}
            className={`px-3 py-1 rounded text-sm transition-colors duration-300 ${
              darkMode
                ? "bg-gray-800 hover:bg-gray-900"
                : "bg-gray-200 hover:bg-gray-300"
            } flex-1`}
            disabled={!client || !client.connected}
          >
            Simulate Door
          </button>
        </div>

        {/* Camera Feed / Snapshot */}
        <div className={`border rounded-lg overflow-hidden transition-colors duration-300 ${
          darkMode ? "border-gray-600" : "border-gray-300"
        }`}>
          {lastSnapshot ? (
            <div className="relative">
              <img
                src={lastSnapshot.imagePlaceholder}
                alt={`Security snapshot from ${cameraLocations[lastSnapshot.location]}`}
                className="w-full h-64 object-cover bg-black"
              />
              <div className={`absolute bottom-0 left-0 right-0 p-2 text-sm ${
                darkMode ? "bg-black bg-opacity-70" : "bg-white bg-opacity-70"
              }`}>
                <p>{cameraLocations[lastSnapshot.location]} - {lastSnapshot.timestamp}</p>
              </div>
            </div>
          ) : (
            <div className={`flex items-center justify-center h-64 ${
              darkMode ? "bg-gray-800" : "bg-gray-200"
            }`}>
              <p className="text-center">
                {cameraOn ? "No snapshot taken yet" : "Camera is turned off"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${
        darkMode ? "bg-gray-700" : "bg-gray-50"
      }`}>
        <h3 className={`font-medium mb-3 ${darkMode ? "text-gray-200" : "text-gray-800"}`}>
          Security Activity Log
        </h3>
        <div className={`max-h-60 overflow-y-auto border rounded transition-colors duration-300 ${
          darkMode ? "border-gray-600" : "border-gray-300"
        }`}>
          {activityLog.length > 0 ? (
            <table className="w-full">
              <thead className={`sticky top-0 transition-colors duration-300 ${
                darkMode ? "bg-gray-800" : "bg-gray-100"
              }`}>
                <tr>
                  <th className="py-2 px-3 text-left">Type</th>
                  <th className="py-2 px-3 text-left">Time</th>
                  <th className="py-2 px-3 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {activityLog.map((entry) => (
                  <tr key={entry.id} className={`border-t transition-colors duration-300 ${
                    darkMode ? "border-gray-700 hover:bg-gray-800" : "border-gray-200 hover:bg-gray-50"
                  }`}>
                    <td className="py-2 px-3">
                      {getActivityIcon(entry.type)}
                    </td>
                    <td className="py-2 px-3 text-sm">
                      {formatTime(entry.timestamp)}
                    </td>
                    <td className="py-2 px-3">
                      {entry.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-4 text-center text-gray-500">No activity recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityFeatures;