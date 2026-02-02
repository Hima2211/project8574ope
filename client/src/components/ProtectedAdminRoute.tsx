import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { PlayfulLoading } from '@/components/ui/playful-loading';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { adminUser, isAuthenticated, isLoading } = useAdminAuth();
  const [, navigate] = useLocation();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setHasInitialized(true);
    }
  }, [isLoading]);

  useEffect(() => {
    // Only redirect if we've finished loading AND user is not authenticated
    if (hasInitialized && !isAuthenticated) {
      console.warn('⚠️ Admin not authenticated, redirecting to login');
      navigate('/admin/login');
    }
  }, [hasInitialized, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <PlayfulLoading
        type="admin"
        title="Verifying Admin Access"
        description="Please wait while we verify your credentials..."
        className="min-h-screen flex items-center justify-center"
      />
    );
  }

  if (!isAuthenticated) {
    return null; // Redirect is happening in useEffect
  }

  return <>{children}</>;
}
