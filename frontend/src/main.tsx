import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/* Fonts must load before styles so the cascade has the faces ready. */
import "@fontsource/comfortaa/500.css";
import "@fontsource/comfortaa/700.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";

import "./styles/global.css";

import { App } from "./App.tsx";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
