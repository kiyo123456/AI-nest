import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
// React Flow's stylesheet goes first so our own rules win where they overlap.
import "@xyflow/react/dist/style.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
