import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pushSubscriptionSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";

export const POST = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;
    const body = await request.json();

    const parsed = pushSubscriptionSchema.safeParse(body.subscription ?? body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid subscription", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      create: {
        userId,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
      update: {
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
    });

    return NextResponse.json(sub, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});
