import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
// Third-party stylesheets go first so our own rules win where they overlap.
// The highlight.js theme is only wanted for its token colours; the frame and
// background it puts on `.hljs` are overridden in `styles.css`.
import "@xyflow/react/dist/style.css";
import "highlight.js/styles/atom-one-dark.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
