# 🏠 Smart Home Simulation Dashboard

A fully interactive, frontend-only **Smart Home Simulation Dashboard** built using **React.js**, featuring real-time device control via **MQTT**, secure **role-based access**, **energy monitoring**, **weather-based automations**, and **security simulation** — all without the need for physical hardware or backend services.

---

## 👥 User Roles & Permissions

| Role         | Permissions                                      |
|--------------|--------------------------------------------------|
| Admin        | Full control of all devices and settings         |
| Family Member| Control lights and thermostat                    |
| Guest        | View-only access to the dashboard                |

---

🧠 Key Features
🔐 Authentication & Access Control
Register/login with localStorage (no backend required)

Three roles: Admin, Family Member, Guest

Dynamic UI based on role

⚡ Device Control (via MQTT)
Toggle lights and schedule usage

Adjust thermostat with slider

Lock/unlock smart door

Simulate motion detection via MQTT

📊 Energy Monitoring
Real-time power usage display

Daily consumption tracking (kWh)

Energy-saving goals (5–30%) with progress bar

Interactive 24-hour graphs using Recharts

🔒 Security Simulation
Toggle camera feeds (snapshots with timestamps)

Arm/disarm alarm system

Alarm triggers on motion/door events

Activity log with event type, icon, and timestamp

🌦️ Weather Integration
Real-time weather info (API-based)

5-day forecast with icons

Weather-based automation rules (e.g., turn on lights if cloudy)

Automation logs with timestamps

⚙️ Tech Stack
Layer	Technologies
Frontend	React.js, Tailwind CSS
MQTT Integration	mqtt.js (WebSockets)
Charts	Recharts
Data Persistence	localStorage
API Integration	OpenWeatherMap API

🌐 MQTT Broker
Uses public MQTT broker: test.mosquitto.org
You can publish/simulate messages from the dashboard or use any MQTT testing tool.

🚧 Limitations
Purely simulated – no physical device control

Uses public MQTT broker (may be unreliable)

LocalStorage-based security (not recommended for production)

💡 Future Improvements
Firebase/Express.js backend for real-time multi-user sync

Integration with actual IoT hardware (e.g., ESP32)

Notifications via email or push

Voice assistant integration (Google Assistant/Alexa)

