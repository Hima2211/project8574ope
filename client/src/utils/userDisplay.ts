export function truncateAddress(address?: string) {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type ProfileLike = { username?: string | null; firstName?: string | null; email?: string | null } | null | undefined;

// Accept either a single options object { profile?, authUser?, walletAddress? }
// or a plain user/profile object (for backward compatibility with older callsites).
export function getDisplayName(optionsOrProfile?: any) {
  let profile: ProfileLike = undefined;
  let authUser: any = undefined;
  let walletAddress: string | null | undefined = undefined;

  if (!optionsOrProfile) return '';

  // If a plain object was passed that looks like a profile/user, use it as profile
  if (typeof optionsOrProfile === 'object' && (optionsOrProfile.username || optionsOrProfile.firstName || optionsOrProfile.email)) {
    profile = optionsOrProfile as ProfileLike;
  } else {
    // Otherwise expect an options bag
    profile = optionsOrProfile.profile;
    authUser = optionsOrProfile.authUser;
    walletAddress = optionsOrProfile.walletAddress;
  }

  // Prefer server/profile username or firstName
  if (profile) {
    if (profile.username) return profile.username;
    if (profile.firstName) return profile.firstName;
    if (profile.email) return profile.email;
  }

  // Prefer wallet address when available (truncate for display)
  if (walletAddress) return truncateAddress(walletAddress);

  // Then prefer authenticated user's email, then username
  if (authUser) {
    if (authUser.email) return authUser.email;
    if (authUser.username) return authUser.username;
    if (authUser.firstName) return authUser.firstName;
  }

  // Final fallback: empty string (avoid literal 'User')
  return '';
}

export default getDisplayName;
