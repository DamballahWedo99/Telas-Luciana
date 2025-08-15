interface UserActivity {
  userId: string;
  lastUpdate: number;
  pendingUpdate: boolean;
}

class ActivityTracker {
  private static instance: ActivityTracker;
  private userActivityMap: Map<string, UserActivity> = new Map();
  private readonly THROTTLE_WINDOW = 5 * 60 * 1000; // 5 minutos

  private constructor() {}

  public static getInstance(): ActivityTracker {
    if (!ActivityTracker.instance) {
      ActivityTracker.instance = new ActivityTracker();
    }
    return ActivityTracker.instance;
  }

  public shouldUpdateActivity(userId: string): boolean {
    const now = Date.now();
    const userActivity = this.userActivityMap.get(userId);

    if (!userActivity) {
      this.userActivityMap.set(userId, {
        userId,
        lastUpdate: now,
        pendingUpdate: true,
      });
      return true;
    }

    const timeSinceLastUpdate = now - userActivity.lastUpdate;
    
    if (timeSinceLastUpdate >= this.THROTTLE_WINDOW) {
      userActivity.lastUpdate = now;
      userActivity.pendingUpdate = true;
      return true;
    }

    return false;
  }

  public markActivityUpdated(userId: string): void {
    const userActivity = this.userActivityMap.get(userId);
    if (userActivity) {
      userActivity.pendingUpdate = false;
    }
  }

  public getActivityStatus(userId: string): {
    lastUpdate: number | null;
    isPending: boolean;
    nextUpdateAvailable: number | null;
  } {
    const userActivity = this.userActivityMap.get(userId);
    
    if (!userActivity) {
      return {
        lastUpdate: null,
        isPending: false,
        nextUpdateAvailable: Date.now(),
      };
    }

    const nextAvailable = userActivity.lastUpdate + this.THROTTLE_WINDOW;
    
    return {
      lastUpdate: userActivity.lastUpdate,
      isPending: userActivity.pendingUpdate,
      nextUpdateAvailable: nextAvailable > Date.now() ? nextAvailable : Date.now(),
    };
  }

  public getTrackedUsersCount(): number {
    return this.userActivityMap.size;
  }

  public clearUserActivity(userId: string): void {
    this.userActivityMap.delete(userId);
  }

  public clearAllActivity(): void {
    this.userActivityMap.clear();
  }

  public getActivitySummary(): Array<{
    userId: string;
    lastUpdate: number;
    isPending: boolean;
    minutesSinceLastUpdate: number;
  }> {
    const now = Date.now();
    return Array.from(this.userActivityMap.entries()).map(([userId, activity]) => ({
      userId,
      lastUpdate: activity.lastUpdate,
      isPending: activity.pendingUpdate,
      minutesSinceLastUpdate: Math.floor((now - activity.lastUpdate) / (60 * 1000)),
    }));
  }
}

export const activityTracker = ActivityTracker.getInstance();

export function logActivityTrackerStats(): void {
  const summary = activityTracker.getActivitySummary();
  const trackedCount = activityTracker.getTrackedUsersCount();
  
  console.log(`📊 Activity Tracker Stats: ${trackedCount} usuarios tracked`);
  
  if (summary.length > 0) {
    console.log("🔍 Detalle por usuario:");
    summary.forEach(({ userId, minutesSinceLastUpdate, isPending }) => {
      const status = isPending ? "📤 Pendiente" : "✅ Actualizado";
      console.log(`   ${userId}: ${minutesSinceLastUpdate}m - ${status}`);
    });
  }
}