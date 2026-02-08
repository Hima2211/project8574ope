import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { formatUserDisplayName } from '@/lib/utils';

interface UserAvatarProps {
  userId?: string;
  username?: string;
  profileImageUrl?: string | null;
  size?: number;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function UserAvatar({ userId, username, profileImageUrl, size = 40, className = "", onClick }: UserAvatarProps) {
  // If caller didn't provide a `profileImageUrl`, try to fetch the user's profile
  // from the server so avatars are consistent across the app.
  const shouldFetchProfile = !profileImageUrl && !!userId;
  const { data: serverProfile } = useQuery(
    ["/api/users/profile", userId],
    async () => {
      try {
        return await apiRequest("GET", `/api/users/${userId}/profile`);
      } catch (e) {
        return null;
      }
    },
    { enabled: shouldFetchProfile, retry: false, staleTime: 1000 * 60 * 5 }
  );

  const finalProfileImage = profileImageUrl ?? (serverProfile && (serverProfile.profileImageUrl ?? serverProfile.profileImage)) ?? null;
  const avatarUrl = getAvatarUrl(userId || '', finalProfileImage, username);

  const altName = username || formatUserDisplayName({ id: userId, username });

  return (
    <img
      src={avatarUrl}
      alt={`${altName || 'Profile'} avatar`}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onClick={onClick}
    />
  );
}