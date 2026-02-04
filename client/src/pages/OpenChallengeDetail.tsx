import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MobileNavigation } from "@/components/MobileNavigation";
import { DynamicMetaTags } from "@/components/DynamicMetaTags";
import { AcceptChallengeModal } from "@/components/AcceptChallengeModal";
import { ChallengeChat } from "@/components/ChallengeChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrencySymbol } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  MessageCircle,
  Share2,
  Users,
  Trophy,
  TrendingUp,
  Clock,
  Shield,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface OpenChallengeDetailProps {
  challenge: any;
}

export default function OpenChallengeDetail({ challenge }: OpenChallengeDetailProps) {
  const { user } = useAuth();
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const { data: balance = 0 } = useQuery<any>({
    queryKey: ["/api/wallet/balance"],
    queryFn: () => apiRequest('GET', '/api/wallet/balance'),
    retry: false,
  });

  if (!challenge) {
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
                The challenge you're looking for doesn't exist or has been removed.
              </p>
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

  const isCreator = user?.id === challenge.challenger;
  const participantCount = challenge.participantCount || 0;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 pb-24">
      <DynamicMetaTags
        challenge={challenge}
        pageType="challenge"
        customImage={challenge?.coverImageUrl}
      />

      {/* Hero Section */}
      <div className="relative h-64 md:h-80 bg-gradient-to-br from-blue-600 to-blue-900 overflow-hidden">
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute top-6 left-6 z-20">
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
        </div>

        <div className="absolute bottom-8 left-6 right-6 z-20">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-blue-400 text-blue-900">OPEN P2P</Badge>
            <Badge variant="outline" className="text-white border-white/30">
              {challenge.status?.toUpperCase()}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            {challenge.title}
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-12 relative z-30">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {getCurrencySymbol(challenge.paymentTokenAddress)}
                  {parseInt(challenge.amount || "0").toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Stake</div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
                <div className="text-2xl font-bold text-blue-600">{participantCount}</div>
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Joined</div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
                <div className="text-2xl font-bold text-purple-600">
                  {challenge.yesStakeTotal || 0}
                </div>
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">YES</div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
                <div className="text-2xl font-bold text-orange-600">
                  {challenge.noStakeTotal || 0}
                </div>
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">NO</div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4">Details</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {challenge.description || "No description provided."}
              </p>
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timeline
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-24 text-sm font-semibold text-slate-500">Created</div>
                  <div className="text-sm">
                    {formatDistanceToNow(new Date(challenge.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-24 text-sm font-semibold text-slate-500">Due Date</div>
                  <div className="text-sm">
                    {challenge.dueDate
                      ? formatDistanceToNow(new Date(challenge.dueDate), { addSuffix: true })
                      : "No deadline"}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="terms" className="w-full">
              <div className="border-b border-slate-200 dark:border-slate-800">
                <TabsList className="bg-transparent p-0 w-full justify-start">
                  <TabsTrigger
                    value="terms"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600"
                  >
                    Terms
                  </TabsTrigger>
                  <TabsTrigger
                    value="participants"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600"
                  >
                    Participants
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="terms" className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold">Escrow Protected</h4>
                      <p className="text-sm text-slate-500">All funds are held in secure escrow until resolution.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold">No Counterparty Risk</h4>
                      <p className="text-sm text-slate-500">Match with other participants automatically.</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="participants" className="pt-6">
                <div className="space-y-3">
                  {[...Array(Math.min(participantCount, 5))].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback>U{i}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">Participant {i + 1}</div>
                        <div className="text-xs text-slate-500">Joined {i} hours ago</div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Creator Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 tracking-wide">Creator</h3>
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={challenge.challengerUser?.profileImageUrl} />
                  <AvatarFallback>
                    {challenge.challengerUser?.username?.charAt(0).toUpperCase() || "C"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">
                    {challenge.challengerUser?.username || "Anonymous"}
                  </div>
                  <div className="text-xs text-slate-500">Challenge Host</div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={() => setShowAcceptModal(true)}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg"
            >
              Accept & Stake
            </Button>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-900/40">
              <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-2">How it works</h4>
              <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <li>• Accept challenge to participate</li>
                <li>• Lock your stake in escrow</li>
                <li>• Match with another participant</li>
                <li>• Dispute result and earn points</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Join Modal */}
      {showAcceptModal && (
        <AcceptChallengeModal
          isOpen={showAcceptModal}
          onClose={() => setShowAcceptModal(false)}
          challenge={challenge}
          isOpenChallenge={true}
        />
      )}

      <MobileNavigation />
    </div>
  );
}
