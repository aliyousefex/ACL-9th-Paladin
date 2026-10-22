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
          <p className="eyebrow">Safety car</p>
          <h1 className="display mt-4 max-w-[14ch] text-[3.4rem]">The screen could not finish loading.</h1>
          <p className="mt-5 max-w-[58ch] text-[1.05rem] leading-relaxed text-steel">
            Something went wrong while drawing this page. The data files and the saved results are unaffected. Reload to restart, or go back to the
            season overview.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="btn" type="button" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="btn btn-ghost" href="#/">
              Season overview
            </a>
          </div>
        </section>
      </main>
    );
  }
}
