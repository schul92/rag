"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Sentry Example Page</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Click the button below to trigger a test error. If Sentry is configured
        correctly, you will see the error in your Sentry dashboard.
      </p>
      <button
        type="button"
        className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
        onClick={() => {
          Sentry.captureException(new Error("Sentry Test Error - Button Click"));
          throw new Error("Sentry Frontend Test Error");
        }}
      >
        Trigger Test Error
      </button>
      <p className="text-xs text-muted-foreground">
        After clicking, check your Sentry dashboard at{" "}
        <a
          href="https://zoe-studio-llc.sentry.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-500 hover:underline"
        >
          zoe-studio-llc.sentry.io
        </a>
      </p>
    </div>
  );
}
