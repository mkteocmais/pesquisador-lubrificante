import React from "react";
import { AlertOctagon } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Erro não tratado capturado pelo ErrorBoundary:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand flex items-center justify-center p-8 text-center text-white">
          <div className="max-w-md w-full">
            <div className="w-16 h-16 bg-rose-500/10 rounded-lg flex items-center justify-center mx-auto mb-6">
              <AlertOctagon className="text-rose-500" size={32} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight mb-2">Algo deu errado</h1>
            <p className="text-slate-400 text-sm font-semibold mb-8">
              Ocorreu um erro inesperado. Tente recarregar a página; se o problema continuar, avise quem cuida do
              app.
            </p>
            <button
              onClick={this.handleReload}
              className="bg-[#002B5C] text-white py-4 px-8 rounded-md font-semibold text-xs"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
