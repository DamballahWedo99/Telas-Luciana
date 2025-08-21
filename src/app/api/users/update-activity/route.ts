import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activityTracker } from "@/lib/activity-tracker";
import { invalidateUserActivityCache } from "@/lib/cache-middleware";

function isInternalRequest(req: NextRequest): boolean {
  const internalHeaders = [
    req.headers.get("x-internal-request"),
    req.headers.get("X-Internal-Request"),
    req.headers.get("X-INTERNAL-REQUEST"),
  ];

  const hasInternalHeader = internalHeaders.some((header) => header === "true");

  if (!hasInternalHeader) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const internalSecret = process.env.CRON_SECRET;

  if (!internalSecret || !authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  return token === internalSecret;
}

export async function POST(request: NextRequest) {
  try {
    if (!isInternalRequest(request)) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only internal requests allowed" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Bad Request", message: "userId is required" },
        { status: 400 }
      );
    }

    const shouldUpdate = activityTracker.shouldUpdateActivity(userId);

    if (!shouldUpdate) {
      const status = activityTracker.getActivityStatus(userId);
      const nextUpdateInMinutes = Math.ceil(
        (status.nextUpdateAvailable! - Date.now()) / (60 * 1000)
      );

      return NextResponse.json({
        success: false,
        message: "Update throttled",
        throttled: true,
        nextUpdateInMinutes,
        userId,
      });
    }

    const now = new Date();
    
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { lastLogin: now },
      select: {
        id: true,
        lastLogin: true,
        name: true,
        email: true,
      },
    });

    activityTracker.markActivityUpdated(userId);

    await invalidateUserActivityCache(userId);


    return NextResponse.json({
      success: true,
      message: "Activity updated successfully",
      userId: updatedUser.id,
      lastLogin: updatedUser.lastLogin,
      updatedAt: now.toISOString(),
      cacheInvalidated: true,
    });

  } catch (error) {
    console.error("Error updating user activity:", error);

    if (error instanceof Error && error.message.includes("Record to update not found")) {
      return NextResponse.json(
        { error: "User not found", message: "User does not exist" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to update user activity" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isInternalRequest(request)) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only internal requests allowed" },
        { status: 403 }
      );
    }

    const summary = activityTracker.getActivitySummary();
    const trackedCount = activityTracker.getTrackedUsersCount();

    return NextResponse.json({
      success: true,
      trackedUsersCount: trackedCount,
      activitySummary: summary,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error getting activity tracker status:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to get activity status" },
      { status: 500 }
    );
  }
}