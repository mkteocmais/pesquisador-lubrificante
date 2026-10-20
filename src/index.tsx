import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Fontes do site da Evora, servidas pelo próprio app (sem Google Fonts, por
// causa da CSP e para funcionar com sinal fraco depois do primeiro acesso).
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import "@fontsource/open-sans/latin-700.css";
import "@fontsource/open-sans/latin-800.css";
import "@fontsource/roboto-condensed/latin-700.css";
import "./styles.css";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { ToastProvider } from "./components/common/ToastProvider";

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
