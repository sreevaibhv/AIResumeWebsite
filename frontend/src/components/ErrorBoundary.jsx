import React from "react";
import { ErrorState, Button } from "../design-system";

/**
 * ErrorBoundary — catches render errors so one broken panel does not
 * blank the whole application.
 *
 * The message follows the product's error rule: what happened, what
 * happened to the user's data, and what to do now. A render crash
 * never touches the resume — it is already on the server — and saying
 * so is the only thing the user actually wants to know.
 *
 * In development the stack is shown; in production it is not, because
 * a stack trace tells a user nothing and can leak internals.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Phase 11 wires this to real error monitoring.
    // eslint-disable-next-line no-console
    console.error("Render error:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{ padding: "var(--s-7) var(--page-pad)", maxWidth: 640, margin: "0 auto" }}>
        <ErrorState
          title="Something on this page stopped working"
          description="We hit an unexpected problem while rendering this view."
          reassurance="Your resume and your analyses are stored on our servers and are unaffected."
          action={<Button onClick={() => this.setState({ error: null })}>Try again</Button>}
          secondaryAction={
            <Button variant="ghost" onClick={() => { window.location.href = "/app"; }}>
              Back to dashboard
            </Button>
          }
        />
        {import.meta.env.DEV ? (
          <pre
            className="ds-data ds-scroll-x"
            style={{
              marginTop: "var(--s-4)", padding: "var(--s-3)", background: "var(--surface-2)",
              border: "1px solid var(--rule)", borderRadius: "var(--r-md)", color: "var(--critical)",
            }}
          >
            {String(error?.stack ?? error)}
          </pre>
        ) : null}
      </div>
    );
  }
}
