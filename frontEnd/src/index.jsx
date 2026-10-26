import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./theme.css";

// 1. Root DOM element ko locate karna (public/index.html se)
const rootElement = document.getElementById("root");

// 2. React 18+ Root Create karna
const root = ReactDOM.createRoot(rootElement);

// 3. Main App Component render karna
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
