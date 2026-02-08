export interface AppUser {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
  level?: number | null;
  xp?: number | null;
  bio?: string | null;
  referralCode?: string | null;
  followerCount?: number | null;
  followingCount?: number | null;
  wallet?: {
    address?: string | null;
  } | null;
  [key: string]: any;
}

export default AppUser;
export interface User {
  id: string;
  email?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  level?: number | null;
  xp?: number | null;
  bio?: string | null;
  referralCode?: string | null;
  wallet?: { address?: string } | null;
  [key: string]: any;
}
