import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { installTheme } from "./theme";
import App from "./App";
import { MotionConfig } from "motion/react";

installTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>
);
