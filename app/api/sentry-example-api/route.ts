import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

export function GET() {
  try {
    throw new SentryExampleAPIError("Sentry Server-Side Test Error");
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      {
        success: false,
        message: "Test error captured and sent to Sentry",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
