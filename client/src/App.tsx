import React, { useEffect, useState, Suspense, lazy } from "react";
import { Router, Switch, Route, useLocation, useParams } from "wouter";
import { apiRequest, queryClient, initializeAuthToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { EventsSearchProvider } from "./context/EventsSearchContext";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from '@/hooks/use-toast';
import { initializeFCM } from "@/services/pushNotificationService";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Events from "./pages/Events";
import EventCreate from "./pages/EventCreate";
import Challenges from "./pages/Challenges";
import Friends from "./pages/Friends";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import ProfileSettings from "./pages/ProfileSettings";
import Activities from "./pages/Activities";
import Notifications from "./pages/Notifications";
import WalletPage from "@/pages/WalletPage";

import ReferralNew from "./pages/ReferralNew";
import Settings from "@/pages/Settings";
import SupportChat from "@/pages/SupportChat";
import HelpSupport from "@/pages/HelpSupport";
import TermsOfService from "@/pages/TermsOfService";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import DataDeletionRequest from "@/pages/DataDeletionRequest";
import Leaderboard from "./pages/Leaderboard";
import About from "./pages/About";
import PointsAndBadges from "./pages/PointsAndBadges";
import ChallengeDetail from "./pages/ChallengeDetail";
import OpenChallengeDetail from "./pages/OpenChallengeDetail";
import DirectChallengeDetail from "./pages/DirectChallengeDetail";
import GroupChallengeDetail from "./pages/GroupChallengeDetail";
import Recommendations from "./pages/Recommendations";
import EventChatPage from "./pages/EventChatPage";
import AdminDashboardOverview from "./pages/AdminDashboardOverview";
import BantahXBT from "./pages/BantahXBT";
import Docs from "./pages/Docs";
import FAQ from "./pages/FAQ";
import AdminEventPayouts from "./pages/AdminEventPayouts";
import AdminChallengePayouts from "./pages/AdminChallengePayouts";
import AdminChallengeCreate from "./pages/AdminChallengeCreate";
import AdminChallengeDisputes from "./pages/AdminChallengeDisputes";
import AdminTransactions from "./pages/AdminTransactions";
import AdminPayouts from "./pages/AdminPayouts";
import AdminPayoutDashboard from "./pages/AdminPayoutDashboard";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminBonusConfiguration from "./pages/AdminBonusConfiguration";
import AdminNotifications from "@/pages/AdminNotifications";
import AdminUsersManagement from "./pages/AdminUsersManagement";
import AdminBantahPoints from "./pages/AdminBantahPoints";
import AdminSettings from "./pages/AdminSettings";
import AdminWallet from "./pages/AdminWallet";

import { DailyLoginModal } from '@/components/DailyLoginModal';
import { useDailyLoginPopup } from '@/hooks/useDailyLoginPopup';
import AdminLogin from "@/pages/AdminLogin";
import { WebsiteTour, useTour } from "@/components/WebsiteTour";
import { SplashScreen } from "@/components/SplashScreen";
import AddToHomePrompt from "@/components/AddToHomePrompt";
import TelegramTest from "./pages/TelegramTest";
import TelegramLink from "@/pages/TelegramLink";
import Bantzz from "./pages/Bantzz";
import Stories from "./pages/Stories";
import BantMap from "./pages/BantMap";
import NotificationTest from "./pages/NotificationTest";
import PublicProfile from "@/pages/PublicProfile";
import { Navigation } from "@/components/Navigation";
import { ErrorBoundary } from "react-error-boundary";
import EventDetails from "./pages/EventDetails";
import ChallengeChatPage from "./pages/ChallengeChatPage";
import { PrivyProvider } from '@privy-io/react-auth';
import { privyConfig } from './lib/privyConfig';

// Challenge detail router that detects challenge type
function ChallengeDetailRouter() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  console.log('ChallengeDetailRouter: Received params:', params, 'id:', id);

  const { data: challenge, isLoading, error } = React.useQuery({
    queryKey: [`/api/challenges/${id}`],
    enabled: !!id,
    retry: false,
  });

  console.log('ChallengeDetailRouter: Query result - isLoading:', isLoading, 'error:', error, 'challenge:', challenge);

  // Still loading
  if (isLoading) {
    console.log('ChallengeDetailRouter: Still loading, showing ChallengeDetail');
    return <ChallengeDetail />;
  }

  // Error or no challenge found
  if (error || !challenge) {
    console.log('ChallengeDetailRouter: Error or no challenge, showing ChallengeDetail');
    return <ChallengeDetail />;
  }

  // Route based on challenge type
  console.log('ChallengeDetailRouter: Challenge loaded, adminCreated:', challenge.adminCreated, 'challenged:', challenge.challenged);
  
  if (challenge.adminCreated) {
    // Group/Admin/Betting pool challenge
    console.log('ChallengeDetailRouter: Routing to GroupChallengeDetail');
    return <GroupChallengeDetail />;
  } else if (challenge.challenged) {
    // Direct P2P challenge (has a specific challenged user)
    console.log('ChallengeDetailRouter: Routing to DirectChallengeDetail');
    return <DirectChallengeDetail />;
  } else {
    // Open P2P challenge (no specific opponent)
    console.log('ChallengeDetailRouter: Routing to OpenChallengeDetail');
    return <OpenChallengeDetail />;
  }
}

function AppRouter() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-all duration-300 ease-in-out">
      {!isLoading && (
        <div className="sticky top-0 z-50">
          <Navigation />
        </div>
      )}

      <Switch>
        <Route path="/" component={Challenges} />
        <Route path="/events" component={Events} />
        <Route path="/events/:id" component={EventDetails} />
        <Route path="/events/:id/chat" component={EventChatPage} />
        <Route path="/event-create" component={EventCreate} />
        <Route path="/home" component={Home} />
        <Route path="/wallet" component={WalletPage} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/about" component={About} />
        <Route path="/docs" component={Docs} />
        <Route path="/faq" component={FAQ} />
        <Route path="/help-support" component={HelpSupport} />
        <Route path="/bantahxbt" component={BantahXBT} />
        <Route path="/challenges" component={Challenges} />
        <Route path="/challenges/:id/chat" component={ChallengeChatPage} />
        <Route path="/challenges/:id/:tab" component={ChallengeDetail} />
        <Route path="/challenges/:id" component={ChallengeDetail} />
        <Route path="/activities" component={Activities} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/friends" component={Friends} />
        <Route path="/profile" component={Profile} />
        <Route path="/profile/edit" component={ProfileEdit} />
        <Route path="/profile/settings" component={ProfileSettings} />
        <Route path="/profile/:username" component={PublicProfile} />
        <Route path="/points" component={PointsAndBadges} />
        <Route path="/referrals" component={ReferralNew} />
        <Route path="/settings" component={Settings} />
        <Route path="/support-chat" component={SupportChat} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route path="/data-deletion-request" component={DataDeletionRequest} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin" component={AdminDashboardOverview} />
        <Route path="/admin/events" component={AdminEventPayouts} />
        <Route path="/admin/challenges" component={AdminChallengePayouts} />
        <Route path="/admin/challenges/create" component={AdminChallengeCreate} />
        <Route path="/admin/challenges/disputes" component={AdminChallengeDisputes} />
        <Route path="/admin/escrow" component={AdminPayoutDashboard} />
        <Route path="/admin/payouts" component={AdminPayouts} />
        <Route path="/admin/transactions" component={AdminTransactions} />
        <Route path="/admin/users" component={AdminUsersManagement} />
        <Route path="/admin/points" component={AdminBantahPoints} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/bonuses" component={AdminBonusConfiguration} />
        <Route path="/admin/wallet" component={AdminWallet} />
        <Route path="/admin/notifications" component={AdminNotifications} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Initialize auth token from localStorage on app startup
    initializeAuthToken();
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={privyConfig.appId}
        config={privyConfig.config}
      >
        <ThemeProvider>
          <EventsSearchProvider>
            <div className={`${isMobile ? 'mobile-app' : ''}`}>
              {showSplash ? (
                <SplashScreen onComplete={handleSplashComplete} />
              ) : (
                <TooltipProvider>
                  <Toaster />
                  <AddToHomePrompt />
                  <ErrorBoundary
                    fallback={<div className="p-4 text-center">Something went wrong. Please refresh the page.</div>}
                    onError={(error) => console.error("App Error:", error)}
                  >
                    <Router>
                      <AppRouter />
                    </Router>
                  </ErrorBoundary>
                </TooltipProvider>
              )}
            </div>
          </EventsSearchProvider>
        </ThemeProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}

export default App;