"use client";

import React, { ErrorInfo } from "react";
import { ErrorFallback } from "@/components/errors/error-fallback";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  nonce: number;
};

export class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, nonce: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SectionErrorBoundary caught error", error, info);
  }

  reset = () => {
    this.setState((s) => ({ hasError: false, nonce: s.nonce + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          title="Something went wrong in this section"
          description="This part of the page failed to load. You can retry without losing the whole page."
          onRetry={this.reset}
          showHomeLink={false}
        />
      );
    }

    return <React.Fragment key={this.state.nonce}>{this.props.children}</React.Fragment>;
  }
}
