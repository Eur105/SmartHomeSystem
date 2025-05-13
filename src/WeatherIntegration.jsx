import React, { useState, useEffect } from 'react';

// Weather Integration Component
const WeatherIntegration = ({ client, darkMode, currentUser }) => {
  const [weather, setWeather] = useState({
    current: {
      temp: 0,
      condition: 'unknown',
      icon: '❓',
      humidity: 0,
      windSpeed: 0
    },
    forecast: []
  });
  
  const [automations, setAutomations] = useState([
    { 
      id: 1, 
      name: 'Close blinds on sunny days', 
      condition: 'sunny', 
      action: 'closeBlinds', 
      enabled: true,
      time: '09:00'
    },
    { 
      id: 2, 
      name: 'Turn on lights when cloudy', 
      condition: 'cloudy', 
      action: 'lightsOn', 
      enabled: true,
      time: 'immediate'
    },
    { 
      id: 3, 
      name: 'Increase temperature when cold', 
      condition: 'cold', 
      action: 'increaseTemp', 
      enabled: false,
      time: 'immediate'
    }
  ]);
  
  const [newAutomation, setNewAutomation] = useState({
    name: '',
    condition: 'sunny',
    action: 'closeBlinds',
    enabled: true,
    time: 'immediate'
  });
  
  const [location, setLocation] = useState(currentUser?.preferences?.weatherLocation || 'New York');
  const [automationLog, setAutomationLog] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // Conditions and possible actions
  const conditions = ['sunny', 'cloudy', 'rainy', 'windy', 'cold', 'hot'];
  const actions = [
    {id: 'lightsOn', name: 'Turn Lights On'},
    {id: 'lightsOff', name: 'Turn Lights Off'},
    {id: 'closeBlinds', name: 'Close Blinds'},
    {id: 'openBlinds', name: 'Open Blinds'},
    {id: 'increaseTemp', name: 'Increase Temperature'},
    {id: 'decreaseTemp', name: 'Decrease Temperature'}
  ];

  // Weather condition icons
  const weatherIcons = {
    sunny: '☀️',
    partly_cloudy: '⛅',
    cloudy: '☁️',
    rainy: '🌧️',
    stormy: '⛈️',
    snowy: '❄️',
    foggy: '🌫️',
    windy: '💨',
    cold: '🥶',
    hot: '🥵',
    unknown: '❓'
  };

  // Save user preferences when location changes
  useEffect(() => {
    if (currentUser) {
      const updatedPrefs = {
        ...currentUser.preferences,
        weatherLocation: location
      };
      
      localStorage.setItem(`prefs_${currentUser.username}`, JSON.stringify(updatedPrefs));
      
      // Update the current user object as well
      const updatedUser = {
        ...currentUser,
        preferences: updatedPrefs
      };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
  }, [location, currentUser]);

  // Subscribe to weather topics when component mounts
  useEffect(() => {
    if (client && client.connected) {
      console.log('Subscribing to weather topics');
      client.subscribe('home/weather/#');
      
      // Handle incoming weather data
      const messageHandler = (topic, message) => {
        if (!topic.startsWith('home/weather')) return;
        
        try {
          const payload = JSON.parse(message.toString());
          
          if (topic === 'home/weather/current') {
            setWeather(prev => ({
              ...prev,
              current: payload
            }));
          } else if (topic === 'home/weather/forecast') {
            setWeather(prev => ({
              ...prev,
              forecast: payload
            }));
          }
        } catch (error) {
          console.error('Error processing weather message:', error);
        }
      };
      
      client.on('message', messageHandler);
      
      // Clean up subscription when component unmounts
      return () => {
        client.unsubscribe('home/weather/#');
        client.removeListener('message', messageHandler);
      };
    }
  }, [client]);

  // Simulate weather data and check automations
  useEffect(() => {
    // Generate simulated weather data
    const simulateWeather = () => {
      // Random temperature between 0 and 35
      const temp = Math.floor(Math.random() * 36);
      
      // Choose a condition based on temperature
      let condition;
      if (temp > 30) condition = 'hot';
      else if (temp > 25) condition = 'sunny';
      else if (temp > 18) condition = 'partly_cloudy';
      else if (temp > 12) condition = 'cloudy';
      else if (temp > 5) condition = 'rainy';
      else condition = 'cold';
      
      // Random humidity and wind speed
      const humidity = Math.floor(Math.random() * 100);
      const windSpeed = Math.floor(Math.random() * 30);
      
      // Create current weather object
      const currentWeather = {
        temp,
        condition,
        icon: weatherIcons[condition] || '❓',
        humidity,
        windSpeed
      };
      
      // Create 5-day forecast
      const forecast = Array.from({ length: 5 }, (_, i) => {
        const forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + i + 1);
        
        const forecastTemp = temp + Math.floor(Math.random() * 10) - 5;
        let forecastCondition;
        
        if (forecastTemp > 30) forecastCondition = 'hot';
        else if (forecastTemp > 25) forecastCondition = 'sunny';
        else if (forecastTemp > 18) forecastCondition = 'partly_cloudy';
        else if (forecastTemp > 12) forecastCondition = 'cloudy';
        else if (forecastTemp > 5) forecastCondition = 'rainy';
        else forecastCondition = 'cold';
        
        return {
          date: forecastDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          temp: forecastTemp,
          condition: forecastCondition,
          icon: weatherIcons[forecastCondition] || '❓'
        };
      });
      
      // Publish weather data to MQTT topics
      if (client && client.connected) {
        client.publish('home/weather/current', JSON.stringify(currentWeather));
        client.publish('home/weather/forecast', JSON.stringify(forecast));
      }
      
      // Update component state
      setWeather({
        current: currentWeather,
        forecast
      });
      
      // Check automations
      checkAutomations(currentWeather);
    };
    
    // Initial simulation
    simulateWeather();
    
    // Set up interval to update weather every minute
    const interval = setInterval(simulateWeather, 60000);
    
    return () => clearInterval(interval);
  }, [client, automations]);

  // Check if any automations should be triggered based on current weather
  const checkAutomations = (currentWeather) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    automations.forEach(automation => {
      if (!automation.enabled) return;
      
      let shouldTrigger = false;
      
      // Check if weather condition matches
      if (automation.condition === 'sunny' && ['sunny', 'hot'].includes(currentWeather.condition)) {
        shouldTrigger = true;
      } else if (automation.condition === 'cloudy' && ['cloudy', 'partly_cloudy'].includes(currentWeather.condition)) {
        shouldTrigger = true;
      } else if (automation.condition === 'rainy' && currentWeather.condition === 'rainy') {
        shouldTrigger = true;
      } else if (automation.condition === 'windy' && currentWeather.windSpeed > 20) {
        shouldTrigger = true;
      } else if (automation.condition === 'cold' && currentWeather.temp < 10) {
        shouldTrigger = true;
      } else if (automation.condition === 'hot' && currentWeather.temp > 30) {
        shouldTrigger = true;
      }
      
      // Check time constraint
      if (automation.time !== 'immediate') {
        const autoTimeHour = parseInt(automation.time.split(':')[0]);
        const autoTimeMinute = parseInt(automation.time.split(':')[1]);
        const nowHour = now.getHours();
        const nowMinute = now.getMinutes();
        
        // Only trigger if the current time is within 5 minutes of the scheduled time
        if (nowHour !== autoTimeHour || Math.abs(nowMinute - autoTimeMinute) > 5) {
          shouldTrigger = false;
        }
      }
      
      // Trigger automation action
      if (shouldTrigger) {
        triggerAutomation(automation);
      }
    });
  };

  // Trigger an automation action
  const triggerAutomation = (automation) => {
    console.log(`Triggering automation: ${automation.name}`);
    
    // Publish action to MQTT topic
    if (client && client.connected) {
      switch (automation.action) {
        case 'lightsOn':
          client.publish('home/light', JSON.stringify({ light: true }));
          break;
        case 'lightsOff':
          client.publish('home/light', JSON.stringify({ light: false }));
          break;
        case 'closeBlinds':
          client.publish('home/blinds', JSON.stringify({ closed: true }));
          break;
        case 'openBlinds':
          client.publish('home/blinds', JSON.stringify({ closed: false }));
          break;
        case 'increaseTemp':
          client.publish('home/temperature', JSON.stringify({ temperature: 24 }));
          break;
        case 'decreaseTemp':
          client.publish('home/temperature', JSON.stringify({ temperature: 20 }));
          break;
        default:
          break;
      }
    }
    
    // Add to automation log
    const logEntry = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      message: `Triggered: ${automation.name}`
    };
    
    setAutomationLog(prev => [logEntry, ...prev].slice(0, 5));
  };

  // Toggle automation enabled state
  const toggleAutomation = (id) => {
    setAutomations(automations.map(auto => 
      auto.id === id ? { ...auto, enabled: !auto.enabled } : auto
    ));
  };

  // Add new automation
  const addAutomation = (e) => {
    e.preventDefault();
    
    if (!newAutomation.name) {
      alert('Please provide a name for the automation');
      return;
    }
    
    const automation = {
      ...newAutomation,
      id: Date.now()
    };
    
    setAutomations([...automations, automation]);
    setNewAutomation({
      name: '',
      condition: 'sunny',
      action: 'closeBlinds',
      enabled: true,
      time: 'immediate'
    });
    setShowAddForm(false);
  };

  // Delete automation
  const deleteAutomation = (id) => {
    setAutomations(automations.filter(auto => auto.id !== id));
  };

  // Get action name from ID
  const getActionName = (actionId) => {
    const action = actions.find(a => a.id === actionId);
    return action ? action.name : actionId;
  };

  return (
    <div className="space-y-6">
      <h2 className={`text-xl font-semibold transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
        🌤️ Weather Integration
      </h2>
      
      {/* Location Selection */}
      <div className={`flex items-center space-x-2 transition-colors duration-300 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        <label className="text-sm font-medium">Location:</label>
        <input
          type="text"
          className={`border rounded px-2 py-1 transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Enter city name"
        />
      </div>
      
      {/* Current Weather */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className={`text-md font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Current Weather in {location}</h3>
            <div className="flex items-center mt-2">
              <span className="text-4xl mr-3">{weather.current.icon}</span>
              <div>
                <p className="text-2xl font-bold">{weather.current.temp}°C</p>
                <p className="capitalize">{weather.current.condition?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
          <div>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Humidity: {weather.current.humidity}%</p>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Wind: {weather.current.windSpeed} km/h</p>
          </div>
        </div>
      </div>
      
      {/* Weather Forecast */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <h3 className={`text-md font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>5-Day Forecast</h3>
        <div className="grid grid-cols-5 gap-2">
          {weather.forecast.map((day, index) => (
            <div key={index} className={`text-center p-2 rounded transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{day.date}</p>
              <p className="text-lg">{day.icon}</p>
              <p className="font-bold">{day.temp}°C</p>
              <p className={`text-xs capitalize ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{day.condition?.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Weather Automations */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className={`text-md font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Weather Automations</h3>
          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            className={`px-3 py-1 rounded text-sm transition-colors duration-300 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
          >
            {showAddForm ? 'Cancel' : '+ Add Automation'}
          </button>
        </div>
        
        {/* Add Automation Form */}
        {showAddForm && (
          <form onSubmit={addAutomation} className={`p-3 mb-4 rounded transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="space-y-3">
              <div>
                <label className={`block text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Name</label>
                <input
                  type="text"
                  className={`w-full border rounded px-2 py-1 transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                  value={newAutomation.name}
                  onChange={(e) => setNewAutomation({...newAutomation, name: e.target.value})}
                  placeholder="Automation name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Weather Condition</label>
                  <select
                    className={`w-full border rounded px-2 py-1 transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                    value={newAutomation.condition}
                    onChange={(e) => setNewAutomation({...newAutomation, condition: e.target.value})}
                  >
                    {conditions.map(condition => (
                      <option key={condition} value={condition}>{condition.charAt(0).toUpperCase() + condition.slice(1)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Action</label>
                  <select
                    className={`w-full border rounded px-2 py-1 transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                    value={newAutomation.action}
                    onChange={(e) => setNewAutomation({...newAutomation, action: e.target.value})}
                  >
                    {actions.map(action => (
                      <option key={action.id} value={action.id}>{action.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Time</label>
                  <select
                    className={`w-full border rounded px-2 py-1 transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                    value={newAutomation.time}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'custom') {
                        setNewAutomation({...newAutomation, time: '12:00'});
                      } else {
                        setNewAutomation({...newAutomation, time: value});
                      }
                    }}
                  >
                    <option value="immediate">Immediate</option>
                    <option value="custom">Specific Time</option>
                  </select>
                </div>
                
                {newAutomation.time !== 'immediate' && (
                  <div>
                    <label className={`block text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Set Time</label>
                    <input
                      type="time"
                      className={`w-full border rounded px-2 py-1 transition-colors duration-300 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                      value={newAutomation.time}
                      onChange={(e) => setNewAutomation({...newAutomation, time: e.target.value})}
                    />
                  </div>
                )}
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enabledCheckbox"
                  checked={newAutomation.enabled}
                  onChange={(e) => setNewAutomation({...newAutomation, enabled: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="enabledCheckbox" className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                  Enable automation
                </label>
              </div>
              
              <button 
                type="submit" 
                className={`w-full px-3 py-2 rounded transition-colors duration-300 ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
              >
                Save Automation
              </button>
            </div>
          </form>
        )}
        
        {/* Automation List */}
        <div className="space-y-2">
          {automations.length === 0 ? (
            <p className={`text-center py-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No automations configured</p>
          ) : (
            automations.map(auto => (
              <div 
                key={auto.id} 
                className={`p-3 rounded flex justify-between items-center transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
              >
                <div>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${auto.enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <h4 className="font-medium">{auto.name}</h4>
                  </div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    When <span className="capitalize">{auto.condition}</span> → {getActionName(auto.action)}
                    {auto.time !== 'immediate' ? ` at ${auto.time}` : ''}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => toggleAutomation(auto.id)} 
                    className={`px-2 py-1 rounded text-xs ${auto.enabled ? 
                      (darkMode ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-yellow-500 hover:bg-yellow-600') : 
                      (darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600')
                    } text-white`}
                  >
                    {auto.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button 
                    onClick={() => deleteAutomation(auto.id)} 
                    className={`px-2 py-1 rounded text-xs transition-colors duration-300 ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Automation Logs */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <h3 className={`text-md font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Recent Automation Activity</h3>
        {automationLog.length === 0 ? (
          <p className={`text-center py-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No recent activity</p>
        ) : (
          <div className="space-y-1">
            {automationLog.map(log => (
              <div key={log.id} className={`py-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{log.time}</span> - {log.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherIntegration;