import { useQuery } from "@tanstack/react-query";

interface BadgeCounts {
  profile: number;
  events: number;
  challenges: number;
}

const DEFAULT_BADGES: BadgeCounts = {
  profile: 0,
  events: 0,
  challenges: 0,
};

export function useBadges() {
  const { data: badges } = useQuery<BadgeCounts>({
    queryKey: ["/api/navigation/badges"],
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
    retry: 1,
    enabled: false, // Disable automatic fetching since endpoint may not exist
  });

  const badgeData = badges || DEFAULT_BADGES;

  return {
    profileBadgeCount: badgeData.profile,
    eventsBadgeCount: badgeData.events,
    challengesBadgeCount: badgeData.challenges,
    hasProfileBadge: badgeData.profile > 0,
    hasEventsBadge: badgeData.events > 0,
    hasChallengesBadge: badgeData.challenges > 0,
  };
}