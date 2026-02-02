
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { setAdminToken } from '@/lib/queryClient';

interface AdminUser {
  id: string;
  username: string;
  firstName?: string;
  email: string;
  isAdmin: boolean;
}

export const useAdminAuth = () => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const checkAdminAuth = async () => {
      const token = localStorage.getItem('adminToken');
      const userStr = localStorage.getItem('adminUser');
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.isAdmin) {
            console.log('✅ Admin credentials found in localStorage, restoring session');
            // Simply restore from localStorage without verifying
            // Verification will happen when making actual API requests
            setAdminUser(user);
            setAdminTokenState(token);
            setAdminToken(token);
          } else {
            // Not an admin user
            console.warn('⚠️ Stored user is not an admin');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            setAdminUser(null);
            setAdminTokenState(null);
            setAdminToken(null);
          }
        } catch (error) {
          console.error('Error parsing admin user:', error);
          // Clear invalid data
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
          setAdminUser(null);
          setAdminTokenState(null);
          setAdminToken(null);
        }
      } else {
        console.log('ℹ️ No admin credentials in localStorage');
      }
      setIsLoading(false);
    };

    checkAdminAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();

      if (!data.token || !data.user) {
        throw new Error('Invalid login response');
      }

      console.log('✅ Admin login successful, storing credentials...');

      // Store token and user
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminUser', JSON.stringify(data.user));

      setAdminToken(data.token);
      setAdminTokenState(data.token);
      setAdminUser(data.user);

      console.log('✅ Admin state updated:', data.user);

      toast({
        title: 'Login Successful',
        description: `Welcome, ${data.user.firstName || data.user.username}!`,
      });

      return data;
    } catch (error: any) {
      console.error('Admin login error:', error);
      toast({
        title: 'Login Failed',
        description: error.message || 'An error occurred during login',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setAdminUser(null);
    setAdminTokenState(null);
    setAdminToken(null);
    toast({
      title: 'Logged Out',
      description: 'You have been logged out',
    });
    navigate('/admin/login');
  };

  const isAdmin = !!adminUser?.isAdmin;
  const isAuthenticated = !!adminToken && !!adminUser;

  return {
    adminUser,
    adminToken,
    isAdmin,
    isAuthenticated,
    isLoading,
    login,
    logout
  };
};


