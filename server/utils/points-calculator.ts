/**
 * Bantah Points Calculator
 * New points distribution system with hard cap of 500 pts
 */

/**
 * Calculate points for challenge creation
 * Fixed amount: 20 pts (capped at 500 max)
 * 
 * @param challengeAmountUSD Challenge amount in USD (not used in new system)
 * @returns Points earned (capped at 500)
 */
export function calculateCreationPoints(challengeAmountUSD: number): number {
  const fixedPoints = 20;
  const maxPoints = 500;
  return Math.min(fixedPoints, maxPoints);
}

/**
 * Calculate points for challenge participation (joining/winning)
 * Fixed amount: 30 pts (capped at 500 max)
 * 
 * @param challengeAmountUSD Challenge amount in USD (not used in new system)
 * @returns Points earned (capped at 500)
 */
export function calculateParticipationPoints(challengeAmountUSD: number): number {
  const fixedPoints = 30;
  const maxPoints = 500;
  return Math.min(fixedPoints, maxPoints);
}

/**
 * Calculate points for successful referral (one-time per user)
 * Fixed amount: 30 pts per side (referrer and referred both get 30)
 * 
 * @returns Fixed referral points
 */
export function calculateReferralPoints(): number {
  return 30;
}

/**
 * Check if user can claim points (weekly window)
 * Points can only be claimed at the end of the week
 * 
 * @param lastClaimedAt Last claim timestamp or null
 * @returns true if user can claim, false otherwise
 */
export function canClaimPoints(lastClaimedAt: Date | null): boolean {
  if (!lastClaimedAt) {
    // First time claiming
    return true;
  }

  const now = new Date();
  const lastClaimed = new Date(lastClaimedAt);
  
  // Get the start of current week (Sunday)
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay());
  currentWeekStart.setHours(0, 0, 0, 0);
  
  // If last claim was before this week, user can claim
  return lastClaimed < currentWeekStart;
}

/**
 * Get next claim time (end of current week)
 * 
 * @returns Date of next Sunday (end of current week)
 */
export function getNextClaimTime(): Date {
  const now = new Date();
  const daysUntilSunday = 7 - now.getDay(); // Days until next Sunday
  
  const nextClaim = new Date(now);
  nextClaim.setDate(now.getDate() + daysUntilSunday);
  nextClaim.setHours(0, 0, 0, 0);
  
  return nextClaim;
}

/**
 * Format points for display
 * 
 * @param points Points amount
 * @returns Formatted string (e.g., "500 BPTS")
 */
export function formatPoints(points: number): string {
  return `${points.toLocaleString()} BPTS`;
}
