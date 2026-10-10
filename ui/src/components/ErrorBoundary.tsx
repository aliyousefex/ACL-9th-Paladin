import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Paladin interface failed to render", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center px-5 py-16">
        <section className="w-full max-w-2xl border-y border-line py-10">
          <p className="font-display text-[0.95rem] tracking-[0.08em] text-signal uppercase">Session interrupted</p>
          <h1 className="mt-3 max-w-[14ch] font-display text-[3rem] leading-[0.95] font-semibold tracking-[-0.03em]">
            The timing screen could not finish loading.
          </h1>
          <p className="mt-5 max-w-[58ch] text-[1.05rem] leading-relaxed text-steel">
            Reload the page to restart the local presentation. The analysis files and saved results are unaffected.
          </p>
          <button className="switch mt-7" type="button" onClick={() => window.location.reload()}>
            Reload the interface
          </button>
        </section>
      </main>
    );
  }
}
