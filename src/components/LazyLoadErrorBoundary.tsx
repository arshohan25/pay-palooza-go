import { Component, type ErrorInfo, type ReactNode } from "react";
import { recoverFromChunkLoadError, clearClientCache } from "@/lib/cacheReset";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  recovering: boolean;
  message: string;
}

const CHUNK_ERROR_SIGNATURES = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "chunkloaderror",
  "loading chunk",
  "unable to preload css",
];

function looksLikeChunkError(error: unknown): boolean {
  const msg = String(error instanceof Error ? `${error.name} ${error.message}` : error).toLowerCase();
  return CHUNK_ERROR_SIGNATURES.some((s) => msg.includes(s));
}

export default class LazyLoadErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false, recovering: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      isChunkError: looksLikeChunkError(error),
      recovering: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[LazyLoadErrorBoundary]", error, info.componentStack);

    // Auto-attempt one silent recovery for chunk errors (clears caches + reloads with bust param).
    if (looksLikeChunkError(error)) {
      this.setState({ recovering: true });
      void recoverFromChunkLoadError(error).then((recovered) => {
        // If recoverFromChunkLoadError already redirected, this won't run.
        // Otherwise it returned false (already attempted) — show the manual UI.
        if (!recovered) this.setState({ recovering: false });
      });
    }
  }

  private handleHardReload = async () => {
    this.setState({ recovering: true });
    try {
      await clearClientCache();
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("cache_bust", String(Date.now()));
    window.location.replace(url.toString());
  };

  private handleRetry = () => {
    this.setState({ hasError: false, isChunkError: false, recovering: false, message: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.state.recovering) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Recovering…</p>
          </div>
        </div>
      );
    }

    const isChunk = this.state.isChunkError;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-6 shadow-elevated text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">
              {isChunk ? "Update available" : "Something went wrong"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isChunk
                ? "A new version of the app is ready. Reload to continue."
                : "An unexpected error occurred while loading this screen."}
            </p>
            {!isChunk && this.state.message && (
              <p className="text-[10px] text-muted-foreground/70 mt-2 font-mono break-all">{this.state.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={this.handleHardReload}
              className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <RefreshCw className="w-4 h-4" />
              Reload app
            </button>
            {!isChunk && (
              <button
                onClick={this.handleRetry}
                className="w-full h-10 rounded-xl border border-border text-foreground text-sm font-medium active:scale-[0.98] transition-transform"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
