import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Design system: self-hosted fonts, tokens, base layer, component styles.
// Loaded once, before anything renders.
import "./design-system/index.css";
import { ToastProvider } from "./design-system";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);
