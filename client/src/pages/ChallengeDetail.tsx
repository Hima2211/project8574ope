import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MobileNavigation } from "@/components/MobileNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlayfulLoading } from "@/components/ui/playful-loading";
import { Trophy, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import OpenChallengeDetail from "./OpenChallengeDetail";
import DirectChallengeDetail from "./DirectChallengeDetail";
import GroupChallengeDetail from "./GroupChallengeDetail";

export default function ChallengeDetail() {
  const params = useParams<{ id: string; tab?: string }>();
  const id = params?.id;

  console.log("ChallengeDetail router: Loading challenge with id:", id);

  const { data: challenge, isLoading, error } = useQuery({
    queryKey: [`/api/challenges/${id}`],
    queryFn: () => apiRequest('GET', `/api/challenges/${id}`),
    enabled: !!id,
    retry: false,
  });

  console.log("ChallengeDetail router: Query result - isLoading:", isLoading, "error:", error?.message, "challenge:", challenge);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          <PlayfulLoading type="general" title="Loading Challenge" />
        </div>
        <MobileNavigation />
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto border-none shadow-none text-center">
            <CardContent className="p-12">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10 text-slate-400" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                Challenge Not Found
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
                The challenge you're looking for doesn't exist or has been removed from the platform.
              </p>
              {error && (
                <p className="text-xs text-red-500 dark:text-red-400 mb-4 font-mono">
                  Error: {error.message}
                </p>
              )}
              {id && (
                <p className="text-xs text-slate-400 mb-4">
                  Challenge ID: {id}
                </p>
              )}
              <Button onClick={() => window.history.back()} variant="outline" className="rounded-full px-8">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  // Route to the appropriate detail page based on challenge type
  // Note: Database fields are snake_case (admin_created, challenged)
  if ((challenge as any)?.admin_created) {
    return <GroupChallengeDetail challenge={challenge} />;
  } else if ((challenge as any)?.challenged) {
    return <DirectChallengeDetail challenge={challenge} />;
  } else {
    return <OpenChallengeDetail challenge={challenge} />;
  }
}