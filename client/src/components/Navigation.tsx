import { useAuth } from "@/hooks/useAuth";
import { useChain } from "@/hooks/useChain";
import { useBlockchainChallenge } from "@/hooks/useBlockchainChallenge";
import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useNotifications } from "@/hooks/useNotifications";
import { useBadges } from "@/hooks/useBadges";
import { usePrivy } from "@privy-io/react-auth";
import { ChainSwitcherCompact } from "@/components/ChainSwitcher";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBalance } from "@/utils/currencyUtils";
import { getAvatarUrl } from "@/utils/avatarUtils";
import { UserAvatar } from "@/components/UserAvatar";
import { useEventsSearch } from "../context/EventsSearchContext"; // Corrected import
import { SmartSearch } from "./SmartSearch";
import { getBalances } from "@/lib/contractInteractions";
import { getChainLogo, getChainName, getChainColor } from "@/utils/chainUtils";
import {
  Bell,
  Settings,
  Users,
  Calendar,
  Trophy,
  Wallet,
  Home,
  Menu,
  X,
  Sun,
  Moon,
  ShoppingCart,
  ArrowLeft,
  User,
  Clock,
  LogOut,
  Award,
  Search,
  Info,
  ChevronDown,
  Zap,
  HelpCircle,
} from "lucide-react";
import { Link } from "wouter"; // Import Link from wouter
import { FloatingBantzzButton } from "./FloatingBantzzButton";

export function Navigation() {
  const { user, isLoading, login } = useAuth();
  const chainId = useChain((state) => state.currentChainId);
  const chainLogo = getChainLogo(chainId);
  const chainName = getChainName(chainId);
  const chainColor = getChainColor(chainId);
  const { switchChain: walletSwitchChain } = useBlockchainChallenge();

  const { notifications, unreadCount } = useNotifications();
  const { hasProfileBadge } = useBadges();
  const { user: privyUser, getEmbeddedWallet } = usePrivy();

  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
    retry: false,
    enabled: !!user,
  });

  // Map chain IDs to their native token IDs on CoinGecko
  const CHAIN_TOKEN_MAP: Record<number, string> = {
    84532: 'ethereum',    // Base Sepolia uses ETH
    80002: 'polygon',     // Polygon Amoy uses POL (formerly MATIC)
    421614: 'ethereum',   // Arbitrum Sepolia uses ETH
  };

  // Fetch native token price from CoinGecko based on current chain
  const { data: tokenPrice = 0 } = useQuery({
    queryKey: ["token-price", chainId],
    queryFn: async () => {
      const tokenId = CHAIN_TOKEN_MAP[chainId] || 'ethereum';
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`
      );
      const data = await response.json();
      return data[tokenId]?.usd || 0;
    },
    staleTime: 60000, // 1 minute
    retry: 1,
  });

  // Fetch wallet balance
  const { data: walletBalance = "0" } = useQuery({
    queryKey: ["wallet-balance", user?.id, chainId],
    queryFn: async () => {
      if (!privyUser?.wallet?.address) return "0";
      try {
        const balances = await getBalances(privyUser, privyUser.wallet.address, chainId);
        return balances.nativeBalance || "0";
      } catch (error) {
        console.error("Failed to fetch wallet balance:", error);
        return "0";
      }
    },
    enabled: !!privyUser?.wallet?.address,
    staleTime: 10000, // 10 seconds
    retry: 1,
  });

  // Calculate USD value from wallet balance
  const getUsdValue = () => {
    if (!walletBalance || !tokenPrice) return "$0.00";
    const tokenAmount = Number(walletBalance) / 1e18;
    const usdValue = tokenAmount * tokenPrice;
    return `$${usdValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getEthAmount = () => {
    if (!walletBalance) return "0";
    const tokenAmount = Number(walletBalance) / 1e18;
    return tokenAmount.toFixed(5);
  };

  const balance = getUsdValue();

  const [location, navigate] = useLocation();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleChainChange = async (newChainId: number) => {
    try {
      await walletSwitchChain(newChainId);
    } catch (error) {
      console.error('Failed to switch chain:', error);
      // Error handling is done in the wallet switch function
    }
  };

  const goToChallenges = () => {
    navigate("/challenges");
  };

  // Show full navigation for both authenticated and unauthenticated users
  // if (!user) {
  //   return (
  //     <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 theme-transition sticky top-0 z-50">
  //       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  //         <div className="flex justify-between items-center h-16">
  //           {/* Logo */}
  //           <div className="flex items-center space-x-3">
  //             <button
  //               className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
  //               onClick={() => (window.location.href = "/")}
  //             >
  //               <img
  //                 src="/assets/bantahblue.svg"
  //                 alt="Bantah Logo"
  //                 className="w-8 h-8"
  //               />
  //               <span className="text-xl font-bold text-slate-900 dark:text-white"></span>
  //             </button>
  //           </div>
  //           {/* Sign In Button */}
  //           <div>
  //             <button
  //               onClick={() => setShowSignIn(true)}
  //               className="bg-primary text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-primary/90 transition-colors"
  //             >
  //               Sign In
  //             </button>
  //           </div>
  //         </div>
  //       </div>
  //       {/* Sign In Modal */}
  //       <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
  //         <DialogContent className="sm:max-w-sm rounded-3xl border-0 shadow-2xl overflow-hidden">
  //           <DialogHeader className="pb-2">
  //             <div className="flex flex-col items-center justify-center w-full">
  //               <img
  //                 src="/assets/bantahblue.svg"
  //                 alt="Bantah Logo"
  //                 className="w-16 h-16 mb-2 drop-shadow-lg"
  //                 style={{ objectFit: "contain" }}
  //               />
  //               <DialogTitle className="text-center text-lg font-bold text-gray-800 dark:text-gray-200">
  //                 Sign in to Bantah
  //               </DialogTitle>
  //             </div>
  //           </DialogHeader>
  //           <div className="flex flex-col items-center space-y-4 py-2">
  //             <button
  //               onClick={() => {
  //                 window.location.href = "/api/login";
  //               }}
  //               className="w-full bg-primary text-white py-2 rounded-lg font-semibold shadow hover:bg-primary/90 transition-colors"
  //             >
  //               Continue with Telegram
  //             </button>
  //             <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
  //               By signing in, you agree to our Terms and Privacy Policy.
  //             </p>
  //           </div>
  //         </DialogContent>
  //       </Dialog>
  //     </nav>
  //   );
  // }

  // Extract challenge ID from URL if viewing a specific challenge
  const challengeIdMatch = useMemo(() => {
    const match = location.match(/^\/challenges\/([^/]+)$/);
    return match ? match[1] : null;
  }, [location]);

  // Fetch challenge data if viewing a specific challenge
  const { data: currentChallenge } = useQuery<any>({
    queryKey: [`/api/challenges/${challengeIdMatch}`],
    enabled: !!challengeIdMatch,
    retry: false,
  });

  // Check if current page should show logo (challenges and home pages)
  const shouldShowLogo =
    location === "/" || location === "/challenges" || location === "/home";

  // Get page title for non-logo pages
  const getPageTitle = () => {
    // If viewing a specific challenge, show challenge title and participant count
    if (challengeIdMatch && currentChallenge) {
      const participantCount = [currentChallenge?.challenger, currentChallenge?.challenged].filter(Boolean).length;
      return `${currentChallenge?.title} (${participantCount} participants)`;
    }

    if (location.startsWith("/events/create")) return "Create Event";
    if (location.startsWith("/events/")) return "Event Chat";
    if (location.startsWith("/challenges")) return "Challenges";
    if (location.startsWith("/wallet")) return "Wallet";
    if (location.startsWith("/profile/edit")) return "Edit Profile";
    if (location.startsWith("/profile/settings")) return "Profile Settings";
    if (location.startsWith("/profile")) return "Profile";
    if (location.startsWith("/friends")) return "Friends";
    if (location.startsWith("/leaderboard")) return "Leaderboard";
    if (location.startsWith("/notifications")) return "Notifications";
    if (location.startsWith("/settings")) return "Settings";

    if (location.startsWith("/activities")) return "Activities";
    if (location.startsWith("/admin")) return "Admin";
    if (location.startsWith("/referrals")) return "Referrals";
    if (location.startsWith("/points")) return "Points & Badges";
    if (location.startsWith("/support-chat")) return "Support Chat";
    if (location.startsWith("/help-support")) return "Help & Support";
    if (location.startsWith("/terms-of-service")) return "Terms of Service";
    if (location.startsWith("/privacy-policy")) return "Privacy Policy";
    if (location.startsWith("/data-deletion-request")) return "Data Deletion";
    if (location.startsWith("/about")) return "About";
    if (location.startsWith("/docs")) return "Documentation";
    if (location.startsWith("/bantahxbt")) return "BantahXBT";
    return "Bantah";
  };

  const handleBack = () => {
    // Navigate back to challenges page (main page for mobile)
    navigate("/challenges");
  };

  const { searchTerm, setSearchTerm } = useEventsSearch();

  return (
    <>
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 theme-transition sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12 md:h-16">
            {/* Mobile Header Logic - Logo on Events/Home, Back Button + Title on other pages */}
            <div className="flex items-center justify-between md:hidden w-full">
              {user ? (
                /* Authenticated users - existing logic */
                <div className="flex items-center space-x-3">
                  {shouldShowLogo ? (
                    /* Events/Home page - Show logo only */
                    <button
                      onClick={() => handleNavigation("/")}
                      className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                    >
                      <img
                        src="/assets/bantahblue.svg"
                        alt="Bantah Logo"
                        className="w-8 h-8"
                      />
                      <span className="text-2xl font-black text-slate-900 dark:text-white"></span>
                    </button>
                  ) : (
                    /* Other pages - Show back button + page title */
                    <>
                      <button
                        onClick={handleBack}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {getPageTitle()}
                      </h1>
                    </>
                  )}
                </div>
              ) : (
                /* Unauthenticated users - Show logo and signin button */
                <div className="flex items-center justify-between w-full">
                  <button
                    onClick={() => handleNavigation("/")}
                    className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                  >
                    <img
                      src="/assets/bantahblue.svg"
                      alt="Bantah Logo"
                      className="w-8 h-8"
                    />
                    <span className="text-2xl font-black text-slate-900 dark:text-white"></span>
                  </button>
                  <button
                    onClick={() => !isLoading && login()}
                    className="px-4 py-2 text-white rounded-lg font-semibold hover:bg-[#7440ff]/90 transition-colors text-sm"
                    style={{ backgroundColor: "#7440ff" }}
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Mobile Right Side Icons - Only for authenticated users */}
              {user && (
                <div className="flex items-center space-x-2">
                      {/* Smart Search - Only show on Events/Home page */}
                      {shouldShowLogo && (
                        <SmartSearch placeholder="Search events, challenges, users..." />
                      )}

                      {/* Search handled by SmartSearch on home/challenges */}

                  {/* Chain Switcher - Mobile */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center justify-center p-1.5 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700/50"
                        title="Switch Network"
                        data-testid="chain-switcher-mobile"
                      >
                        <img 
                          src={chainLogo} 
                          alt={chainName} 
                          className="w-5 h-5"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <DropdownMenuItem
                        onClick={() => handleChainChange(84532)}
                        className="cursor-pointer flex items-center gap-2"
                      >
                        <img src="/assets/Base_logo.svg" alt="Base" className="w-4 h-4" />
                        Base Sepolia
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleChainChange(80002)}
                        className="cursor-pointer flex items-center gap-2"
                      >
                        <img src="/assets/polygonlogo.svg" alt="Polygon" className="w-4 h-4" />
                        Polygon Amoy
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleChainChange(421614)}
                        className="cursor-pointer flex items-center gap-2"
                      >
                        <img src="/assets/arbitrumlogo.svg" alt="Arbitrum" className="w-4 h-4" />
                        Arbitrum Sepolia
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Leaderboard Icon - Always visible on mobile */}
                  <button
                    onClick={() => handleNavigation("/leaderboard")}
                    className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
                  >
                    <img 
                      src="/assets/leaderboard_activity.png" 
                      alt="Leaderboard" 
                      className="w-5 h-5"
                    />
                  </button>

                  {/* Notifications - Always visible on mobile */}
                  <button
                    onClick={() => handleNavigation("/notifications")}
                    className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors"
                    data-tour="notifications"
                  >
                    <img
                      src="/assets/notify22.svg"
                      alt="Notifications"
                      className="w-6 h-6"
                    />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </button>

                  {/* Wallet Points - Mobile with Dynamic Chain Logo */}
                  <button
                    onClick={() => handleNavigation("/wallet")}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-xs hover:opacity-90"
                    style={{ backgroundColor: "#ccff00", color: "black" }}
                    data-tour="wallet"
                    title={`Connected to ${chainName} (Chain ID: ${chainId})`}
                  >
                    <img 
                      src={chainLogo} 
                      alt={chainName} 
                      className="w-4 h-4"
                    />
                    <span className="font-medium">{balance}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Desktop Logo */}
            <div className="hidden md:flex items-center space-x-3">
              <button
                onClick={() => handleNavigation("/")}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
              >
                <img
                  src="/assets/bantahblue.svg"
                  alt="Bantah Logo"
                  className="w-8 h-8"
                />
                <span className="text-2xl font-black text-slate-900 dark:text-white"></span>
              </button>
            </div>
            {/* Navigation Items */}
            <div className="hidden md:flex items-center space-x-6">
              {/* Primary Navigation Group */}
              <div className="flex items-center bg-gray-50 dark:bg-slate-700/50 rounded-xl p-1 border border-gray-200 dark:border-slate-600">
                <button
                  onClick={() => handleNavigation("/challenges")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    location === "/challenges" ||
                    location.startsWith("/challenges")
                      ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                  }`}
                  data-tour="challenges"
                >
                  <Trophy className="w-4 h-4" />
                  Challenges
                </button>
                <button
                  onClick={() => handleNavigation("/friends")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    location === "/friends" || location.startsWith("/friends")
                      ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                  }`}
                  data-tour="friends"
                >
                  <Users className="w-4 h-4" />
                  Friends
                </button>
                <button
                  onClick={() => handleNavigation("/leaderboard")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    location === "/leaderboard" ||
                    location.startsWith("/leaderboard")
                      ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                  }`}
                  data-tour="leaderboard"
                >
                  <Award className="w-4 h-4" />
                  Leaderboard
                </button>
                {user?.isAdmin && (
                  <button
                    onClick={() => handleNavigation("/admin")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                      location.startsWith("/admin")
                        ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-lg"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </button>
                )}
                <button
                  onClick={() => handleNavigation("/bantahxbt") }
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    location === "/bantahxbt"
                      ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  BantahXBT
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                        location === "/about" || location === "/docs" || location === "/help-support"
                          ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-lg"
                          : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      More
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <DropdownMenuItem
                      onClick={() => handleNavigation("/about")}
                      className="cursor-pointer"
                    >
                      <Info className="w-4 h-4 mr-2" />
                      About
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleNavigation("/docs")}
                      className="cursor-pointer"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Docs
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleNavigation("/faq")}
                      className="cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      FAQ
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Secondary Navigation Group */}
              <div className="flex items-center bg-gray-50 dark:bg-slate-700/50 rounded-xl p-1 border border-gray-200 dark:border-slate-600"></div>

              {/* Search Bar - Wire to events or challenges depending on page */}
              <div className="ml-2">
                <Input
                  placeholder={location.startsWith("/challenges") ? "Search challenges..." : "Search events.."}
                  value={searchTerm}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (location.startsWith("/challenges")) {
                      window.dispatchEvent(new CustomEvent("challenges-search", { detail: v }));
                    } else {
                      setSearchTerm(v);
                    }
                  }}
                  className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 w-3/4 focus:ring-2 focus:ring-slate-400 focus:ring-offset-0 focus:border-slate-400 focus-visible:ring-slate-400 placeholder:text-slate-400 placeholder:text-sm"
                />
              </div>
            </div>

            {/* Right Side Items - Desktop Only */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Notifications - Desktop Only */}
              {user && (
                <button
                  onClick={() => handleNavigation("/notifications")}
                  className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors"
                  data-tour="notifications"
                >
                  <img
                    src="/assets/notify22.svg"
                    alt="Notifications"
                    className="w-7 h-7"
                  />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </button>
              )}

              {/* Profile Button - Desktop Only */}
              {user ? (
                <button
                  onClick={() => handleNavigation("/profile")}
                  className="relative hidden md:flex items-center justify-center w-8 h-8 rounded-full overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                >
                  <UserAvatar
                    userId={user.id}
                    username={profile?.username || (user as any).username || (typeof user.email === 'string' ? user.email : (user.email as any)?.address)}
                    profileImageUrl={profile?.profileImageUrl ?? null}
                    size={32}
                    className="w-full h-full"
                  />
                  {hasProfileBadge && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white dark:border-slate-800"></div>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => !isLoading && login()}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-white text-white rounded-lg font-semibold hover:bg-[#7440ff]/90 transition-colors"
                  style={{ backgroundColor: "#7440ff" }}
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              )}

              {/* Chain Switcher Icon - Between Profile and Wallet */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="hidden md:flex items-center justify-center p-2 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700/50"
                      title="Switch Network"
                    >
                      <img 
                        src={chainLogo} 
                        alt={chainName} 
                        className="w-5 h-5"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <DropdownMenuItem
                      onClick={() => handleChainChange(84532)}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <img src="/assets/Base_logo.svg" alt="Base" className="w-4 h-4" />
                      Base Sepolia
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleChainChange(80002)}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <img src="/assets/polygonlogo.svg" alt="Polygon" className="w-4 h-4" />
                      Polygon Amoy
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleChainChange(421614)}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <img src="/assets/arbitrumlogo.svg" alt="Arbitrum" className="w-4 h-4" />
                      Arbitrum Sepolia
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Wallet Points with Dynamic Chain Logo */}
              {user && (
                <button
                  onClick={() => handleNavigation("/wallet")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:opacity-90"
                  style={{ backgroundColor: "#ccff00", color: "black" }}
                  data-tour="wallet"
                  title={`Connected to ${chainName} (Chain ID: ${chainId})`}
                >
                  <img 
                    src={chainLogo} 
                    alt={chainName} 
                    className="w-5 h-5"
                  />
                  <span className="text-sm font-medium">{balance}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Floating Bantzz AI Button */}
      <FloatingBantzzButton />
    </>
  );
}
