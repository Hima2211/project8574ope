import { usePrivy } from '@privy-io/react-auth';
import type { User as UserType } from '@/types/user';
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { setAuthToken } from '@/lib/queryClient';

export function useAuth() {
  const { toast } = useToast();
  const {
    ready,
    authenticated,
    user,
    login,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();
  const [, navigate] = useLocation();

  const [stableAuthenticated, setStableAuthenticated] = useState(authenticated);

  // Stabilize authentication state and set auth token for API requests
  useEffect(() => {
    if (ready) {
      // Only update stable state after Privy is ready
      if (stableAuthenticated !== authenticated) {
        setStableAuthenticated(authenticated);
      }
      
      // If authenticated, use Privy access token directly for API requests
      if (authenticated && user?.wallet?.address) {
        (async () => {
          try {
            const accessToken = await getAccessToken();
            if (accessToken) {
              setAuthToken(accessToken);
              console.log('✅ Privy access token set for API requests');
            } else {
              console.warn('⚠️ No Privy access token available');
              setAuthToken(null);
            }
          } catch (err) {
            console.error('❌ Failed to obtain Privy access token:', err);
            setAuthToken(null);
          }
        })();
      } else {
        // Clear token when logged out
        console.log('👋 User logged out, clearing auth token');
        setAuthToken(null);
      }
    }
  }, [authenticated, ready, user?.wallet?.address, user?.email]);

  const logout = async () => {
    try {
      await privyLogout();
      // Force redirect to home page after logout
      window.location.replace('/');
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    } catch (error: any) {
      toast({
        title: "Logout failed",
        description: error.message || "Failed to logout",
        variant: "destructive",
      });
    }
  };

  return {
    user: stableAuthenticated ? (user as unknown as UserType) : null,
    isLoading: !ready,
    isAuthenticated: stableAuthenticated,
    login,
    logout,
    isLoggingOut: false,
    getAccessToken,
  };
}