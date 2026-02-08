export function getDisplayName(user: any): string {
  if (!user) return '';
  // Prefer username, then firstName, then email, then wallet address, then id
  if (user.username) return user.username;
  if (user.firstName) return user.firstName;
  if (user.email) return typeof user.email === 'string' ? user.email : (user.email?.address || '');
  if (user.profileImageUrl && user.username) return user.username;
  if (user.wallet?.address) return user.wallet.address;
  if ((user as any).primaryWalletAddress) return (user as any).primaryWalletAddress;
  if (user.id) return String(user.id);
  return '';
}

export function getUsernameOrAddress(user: any): string {
  if (!user) return '';
  if (user.username) return user.username;
  if (user.wallet?.address) return user.wallet.address;
  if (user.email) return typeof user.email === 'string' ? user.email : (user.email?.address || '');
  return '';
}
