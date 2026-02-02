
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Lock, Shield, Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login } = useAdminAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await login(credentials.username, credentials.password);
      if (result && result.token) {
        // Give a small delay for state to update, then navigate to admin dashboard
        setTimeout(() => {
          navigate('/admin');
        }, 500);
      }
    } catch (error) {
      // Error is handled by the login function
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof credentials, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Admin Access
          </h1>
          <p className="text-slate-400">
            Secure login for Bantah administrators
          </p>
        </div>

        {/* Login Form */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-center">
              Administrator Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username Field */}
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-slate-300">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter admin username"
                  value={credentials.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter admin password"
                    value={credentials.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4" />
                    <span>Login as Admin</span>
                  </div>
                )}
              </Button>
            </form>
            {/* Security Notice */}
            <Alert className="mt-6 bg-amber-900/20 border-amber-800">
              <Shield className="w-4 h-4 text-amber-400" />
              <AlertDescription className="text-amber-300 text-xs">
                This is a secure admin portal. All login attempts are monitored and logged.
                Unauthorized access attempts will be reported.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-slate-500 text-sm">
            Bantah Admin Portal © 2024
          </p>
        </div>
      </div>
    </div>
  );
}
