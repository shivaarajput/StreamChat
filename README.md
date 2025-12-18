# StreamChat – Real-time Messaging Application

A modern, high-performance real-time chat application built with React and native WebSockets. Features a sleek dark-mode UI, private messaging, and instant updates without the overhead of heavy socket libraries.

---

## 🚀 Features

* **Real-time Messaging**: Instant message delivery using native WebSockets.
* **Channels & DMs**: Support for a public **#general** channel and private Direct Messages between users.
* **Live User Presence**: See who is online in real time.
* **Typing Indicators**: Visual cues when other users are typing.
* **Message History**: Chat history is preserved (in-memory) for new connections.
* **Responsive Design**: Fully responsive UI with a mobile-friendly sidebar and adaptive layouts.
* **Connection Handling**: Automatic reconnection logic and status indicators.
* **Modern UI**: Built with Tailwind CSS for a professional, dark-themed aesthetic.

---

## 🛠️ Tech Stack

### Frontend

* **React** – Functional components and Hooks
* **Tailwind CSS** – Utility-first styling
* **Native WebSocket API** – Lightweight, standard protocol (no Socket.IO client)
* **Lucide React** – Beautiful, consistent iconography
* **Vite** – Fast build tool and development server

### Backend

* **Node.js** – Runtime environment
* **ws** – Lightweight WebSocket client/server library
* **In-Memory Storage** – State management for users and messages (no database required)

---

## 📦 Installation & Local Setup

### 1. Backend Setup

The backend handles WebSocket connections and broadcasting.

```bash
mkdir chat-server
cd chat-server

npm init -y
npm install ws
```

Add the `server.js` code and run:

```bash
node server.js
```

The server will start on port **8080** by default.

---

### 2. Frontend Setup

Navigate to the client directory:

```bash
cd chat-client
```

Install dependencies:

```bash
npm install
```

Update `src/App.jsx` to point to your local server:

```js
const USE_MOCK_SERVER = false;
const WS_URL = 'ws://localhost:8080';
```

Start the development server:

```bash
npm run dev
```

---

## ⚙️ Configuration

In `App.jsx`, you can toggle between a real backend connection and a built-in simulation mode for UI testing.

```js
// Toggle this to FALSE to connect to the real Node.js server.
// Set to TRUE to use the in-browser simulation.
const USE_MOCK_SERVER = false;

// WebSocket URL (Use 'ws://' for local, 'wss://' for production)
const WS_URL = 'wss://your-app.onrender.com';
```

---

## 🚀 Deployment

### Backend (Render / Heroku / Railway)

* Deploy `server.js` as a Node.js web service.
* Ensure the `PORT` environment variable is respected (handled in the provided code).

### Frontend (Vercel / Netlify)

* Deploy as a standard Vite + React application.
* Update `WS_URL` in `App.jsx` to your production backend URL.
* Use **`wss://`** for secure connections on HTTPS sites.

---

## 👤 Author

**Shiva Rajput**
Senior Full-Stack Engineer & UI Designer

---

> ⚠️ **Note:** This project uses in-memory storage. All data resets when the server restarts.
