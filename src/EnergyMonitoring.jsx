import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Energy Monitoring Component
const EnergyMonitoring = ({ client, darkMode, currentUser }) => {
  const [powerData, setPowerData] = useState([]);
  const [totalConsumption, setTotalConsumption] = useState(0);
  const [savingsGoal, setSavingsGoal] = useState(currentUser?.preferences?.energySavingsGoal || 15);
  const [currentUsage, setCurrentUsage] = useState(0);
  const [devices, setDevices] = useState([
    { id: 1, name: 'Living Room Light', power: 0, connected: true },
    { id: 2, name: 'Kitchen Appliances', power: 0, connected: true },
    { id: 3, name: 'Thermostat', power: 0, connected: true },
    { id: 4, name: 'Entertainment System', power: 0, connected: false },
  ]);

  // Subscribe to energy topics when component mounts
  useEffect(() => {
    if (client && client.connected) {
      console.log('Subscribing to energy topics');
      client.subscribe('home/energy/#');
      
      // Handle incoming energy data
      const messageHandler = (topic, message) => {
        if (!topic.startsWith('home/energy')) return;
        
        try {
          const payload = JSON.parse(message.toString());
          
          if (topic === 'home/energy/current') {
            setCurrentUsage(payload.watts);
            
            // Update devices with new power data
            if (payload.devices) {
              setDevices(prevDevices => 
                prevDevices.map(device => {
                  const updatedDevice = payload.devices.find(d => d.id === device.id);
                  return updatedDevice ? { ...device, ...updatedDevice } : device;
                })
              );
            }
          }
        } catch (error) {
          console.error('Error processing energy message:', error);
        }
      };
      
      client.on('message', messageHandler);
      
      // Clean up subscription when component unmounts
      return () => {
        client.unsubscribe('home/energy/#');
        client.removeListener('message', messageHandler);
      };
    }
  }, [client]);

  // Simulate energy data for demonstration
  useEffect(() => {
    // Generate initial historical data (last 24 hours)
    const initialData = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date();
      hour.setHours(hour.getHours() - 24 + i);
      
      // Create some variation in power usage
      let basePower;
      const hourOfDay = hour.getHours();
      
      if (hourOfDay >= 22 || hourOfDay < 6) {
        // Night time - lower usage
        basePower = 100 + Math.random() * 100;
      } else if (hourOfDay >= 17 && hourOfDay < 22) {
        // Evening - peak usage
        basePower = 300 + Math.random() * 150;
      } else {
        // Day time - medium usage
        basePower = 200 + Math.random() * 100;
      }
      
      return {
        time: hour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        power: Math.round(basePower),
        date: hour.toLocaleDateString()
      };
    });
    
    setPowerData(initialData);
    
    // Calculate total consumption from historical data
    const total = initialData.reduce((sum, dataPoint) => sum + dataPoint.power, 0) / 60; // kWh approximation
    setTotalConsumption(Math.round(total * 10) / 10);
    
    // Set up interval to update current usage
    const interval = setInterval(() => {
      if (client && client.connected) {
        // Simulate current power reading
        const now = new Date();
        const hourOfDay = now.getHours();
        
        let basePower;
        if (hourOfDay >= 22 || hourOfDay < 6) {
          basePower = 100 + Math.random() * 100;
        } else if (hourOfDay >= 17 && hourOfDay < 22) {
          basePower = 300 + Math.random() * 150;
        } else {
          basePower = 200 + Math.random() * 100;
        }
        
        const currentPower = Math.round(basePower);
        setCurrentUsage(currentPower);
        
        // Simulate device power distribution
        const devicePowers = [
          Math.round(currentPower * 0.15), // Living Room Light
          Math.round(currentPower * 0.4),  // Kitchen Appliances
          Math.round(currentPower * 0.2),  // Thermostat
          Math.round(currentPower * 0.25)  // Entertainment System
        ];
        
        const updatedDevices = devices.map((device, index) => ({
          ...device,
          power: devicePowers[index]
        }));
        
        // Publish simulated energy data
        client.publish('home/energy/current', JSON.stringify({
          watts: currentPower,
          devices: updatedDevices
        }));
        
        setDevices(updatedDevices);
        
        // Add new data point every minute
        if (now.getSeconds() === 0) {
          const newDataPoint = {
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            power: currentPower,
            date: now.toLocaleDateString()
          };
          
          setPowerData(prevData => {
            const newData = [...prevData.slice(1), newDataPoint];
            // Update total consumption
            const total = newData.reduce((sum, point) => sum + point.power, 0) / 60;
            setTotalConsumption(Math.round(total * 10) / 10);
            return newData;
          });
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [client, devices]);

  // Save energy goal to user preferences
  useEffect(() => {
    if (currentUser) {
      const updatedPrefs = {
        ...currentUser.preferences,
        energySavingsGoal: savingsGoal
      };
      
      localStorage.setItem(`prefs_${currentUser.username}`, JSON.stringify(updatedPrefs));
      
      // Update the current user object as well
      const updatedUser = {
        ...currentUser,
        preferences: updatedPrefs
      };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
  }, [savingsGoal, currentUser]);

  // Calculate progress towards savings goal
  const calculateSavingsProgress = () => {
    // Using a baseline of 5kWh as a reference for a typical day
    const baseline = 5;
    const current = totalConsumption;
    const targetReduction = baseline * (savingsGoal / 100);
    const targetUsage = baseline - targetReduction;
    
    // If we're using less than target, 100% complete
    if (current <= targetUsage) return 100;
    
    // If we're using more than baseline, 0% complete
    if (current >= baseline) return 0;
    
    // Otherwise, calculate percentage
    const savedAmount = baseline - current;
    const progress = (savedAmount / targetReduction) * 100;
    return Math.round(progress);
  };

  const savingsProgress = calculateSavingsProgress();

  return (
    <div className="space-y-6">
      <h2 className={`text-xl font-semibold transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
        ⚡ Energy Monitoring
      </h2>
      
      {/* Current Usage Display */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <div className="flex justify-between items-center">
          <div>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Current Power Usage</p>
            <p className="text-2xl font-bold">{currentUsage} W</p>
          </div>
          <div>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Consumption Today</p>
            <p className="text-2xl font-bold">{totalConsumption} kWh</p>
          </div>
        </div>
      </div>
      
      {/* Power Usage Graph */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <h3 className={`text-md font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Power Usage Over Time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={powerData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#4B5563' : '#E5E7EB'} />
              <XAxis 
                dataKey="time" 
                stroke={darkMode ? '#9CA3AF' : '#6B7280'} 
                tick={{ fill: darkMode ? '#9CA3AF' : '#6B7280' }} 
              />
              <YAxis 
                stroke={darkMode ? '#9CA3AF' : '#6B7280'} 
                tick={{ fill: darkMode ? '#9CA3AF' : '#6B7280' }} 
                label={{ 
                  value: 'Watts', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fill: darkMode ? '#9CA3AF' : '#6B7280' }
                }} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: darkMode ? '#374151' : '#FFFFFF',
                  color: darkMode ? '#F9FAFB' : '#111827',
                  border: `1px solid ${darkMode ? '#4B5563' : '#E5E7EB'}`
                }} 
              />
              <Legend wrapperStyle={{ color: darkMode ? '#F9FAFB' : '#111827' }} />
              <Line 
                type="monotone" 
                dataKey="power" 
                stroke="#10B981" 
                activeDot={{ r: 8 }} 
                strokeWidth={2}
                name="Power (W)" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Energy Saving Goal */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <h3 className={`text-md font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Energy Saving Goal</h3>
        <div className="flex items-center space-x-2 mb-2">
          <input
            type="range"
            min="5"
            max="30"
            step="5"
            className="w-full"
            value={savingsGoal}
            onChange={(e) => setSavingsGoal(parseInt(e.target.value))}
          />
          <span>{savingsGoal}%</span>
        </div>
        
        {/* Progress Bar */}
        <div className={`h-6 rounded-full overflow-hidden bg-gray-200 ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
          <div 
            className="h-full rounded-full bg-green-500" 
            style={{ width: `${savingsProgress}%` }}
          ></div>
        </div>
        <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {savingsProgress}% towards your {savingsGoal}% energy reduction goal
        </p>
      </div>
      
      {/* Device Power Consumption */}
      <div className={`p-4 rounded-lg transition-colors duration-300 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <h3 className={`text-md font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Device Power Consumption</h3>
        <div className="space-y-3">
          {devices.map(device => (
            <div key={device.id} className="flex justify-between items-center">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${device.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{device.name}</span>
              </div>
              <span className="font-medium">{device.power} W</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnergyMonitoring;