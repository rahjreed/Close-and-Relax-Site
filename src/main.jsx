import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { supabaseEndpoint } from "./lib/supabase";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {import.meta.env.VITE_APP_ENV === 'staging' &&
      new URLSearchParams(window.location.search).get('connection-check') === '1' && (
        <div role="status" style={{ padding: '12px', background: '#fff4cc', color: '#191816', overflowWrap: 'anywhere' }}>
          Staging diagnostic — configured Supabase endpoint: {supabaseEndpoint}
        </div>
      )}
    <App />
  </React.StrictMode>
);
