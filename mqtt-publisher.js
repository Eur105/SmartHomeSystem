const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://test.mosquitto.org');

client.on('connect', () => {
  console.log('Connected to MQTT broker');

  setInterval(() => {
    // Simulate temperature
    const temp = Math.floor(Math.random() * 6) + 20;
    client.publish('home/temperature', JSON.stringify({ temperature: temp }));

    // Simulate motion
    const motion = Math.random() > 0.5;
    client.publish('home/motion', JSON.stringify({ motion }));

    console.log('Published simulated data');
  }, 5000); // every 5 seconds
});



// For livr demonstration http://www.hivemq.com/demos/websocket-client/
