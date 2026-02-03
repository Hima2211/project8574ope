import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MobileNavigation } from "@/components/MobileNavigation";
import { DynamicMetaTags } from "@/components/DynamicMetaTags";
import { JoinChallengeModal } from "@/components/JoinChallengeModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrencySymbol } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  Clock,
  Shield,
  Zap,
  Users,
  CheckCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

interface GroupChallengeDetailProps {
  challenge: any;
}

export default function GroupChallengeDetail({ challenge }: GroupChallengeDetailProps) {
  const { user } = useAuth();
  const [showJoinModal, setShowJoinModal] = useState(false);

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

  const totalStaked = (challenge.yesStakeTotal || 0) + (challenge.noStakeTotal || 0);
  const yesPercentage = totalStaked > 0 ? ((challenge.yesStakeTotal || 0) / totalStaked) * 100 : 50;
  const participantCount = challenge.participantCount || 0;

  const statusColors: Record<string, string> = {
    open: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    active: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    completed: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300",
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 pb-24">
      <DynamicMetaTags
        challenge={challenge}
        pageType="challenge"
        customImage={challenge?.coverImageUrl}
      />

      {/* Hero Section */}
      <div className="relative h-72 md:h-96 overflow-hidden">
        {challenge.coverImageUrl ? (
          <img
            src={challenge.coverImageUrl}
            alt={challenge.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-700" />
        )}
        <div className="absolute inset-0 bg-black/40" />
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
            <Badge className="bg-amber-400 text-amber-900 font-bold">BETTING POOL</Badge>
            <Badge variant="outline" className="text-white border-white/30">
              {challenge.status?.toUpperCase()}
            </Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
            {challenge.title}
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 relative z-30">
        <div className="grid lg:grid-cols-3 gap-8 -mt-20 mb-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Market Stats */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-lg">
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-6 tracking-wide">Market Overview</h3>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                  <div className="text-3xl font-bold text-green-600">
                    {getCurrencySymbol(challenge.paymentTokenAddress)}
                    {totalStaked.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 font-semibold uppercase mt-1">Total Pool</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-600">{participantCount}</div>
                  <div className="text-xs text-slate-500 font-semibold uppercase mt-1">Participants</div>
                </div>
              </div>

              {/* Odds/Stakes Display */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-bold text-sm">YES</div>
                      <div className="text-xs text-slate-500">
                        {getCurrencySymbol(challenge.paymentTokenAddress)}
                        {(challenge.yesStakeTotal || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{yesPercentage.toFixed(1)}%</div>
                      <div className="text-xs text-slate-500">of pool</div>
                    </div>
                  </div>
                  <Progress value={yesPercentage} className="h-3" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-bold text-sm">NO</div>
                      <div className="text-xs text-slate-500">
                        {getCurrencySymbol(challenge.paymentTokenAddress)}
                        {(challenge.noStakeTotal || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{(100 - yesPercentage).toFixed(1)}%</div>
                      <div className="text-xs text-slate-500">of pool</div>
                    </div>
                  </div>
                  <Progress value={100 - yesPercentage} className="h-3" />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4">About This Challenge</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {challenge.description ||
                  "A community-driven prediction market where participants can stake on different outcomes."}
              </p>
            </div>

            {/* Bonuses (if any) */}
            {(challenge.earlyBirdSlots || challenge.streakBonusEnabled || challenge.convictionBonusEnabled) && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-900/40">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-green-900 dark:text-green-300">
                  <Zap className="w-5 h-5" />
                  Bonus Opportunities
                </h3>
                <div className="space-y-3">
                  {challenge.earlyBirdSlots && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Early Bird Bonus</span>
                      <Badge variant="outline" className="bg-green-100 border-green-300">
                        +{challenge.earlyBirdBonus} coins
                      </Badge>
                    </div>
                  )}
                  {challenge.streakBonusEnabled && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Streak Bonus</span>
                      <Badge variant="outline" className="bg-green-100 border-green-300">
                        Eligible
                      </Badge>
                    </div>
                  )}
                  {challenge.convictionBonusEnabled && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Conviction Bonus</span>
                      <Badge variant="outline" className="bg-green-100 border-green-300">
                        Eligible
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Details */}
            <Tabs defaultValue="info" className="w-full">
              <div className="border-b border-slate-200 dark:border-slate-800">
                <TabsList className="bg-transparent p-0 w-full justify-start">
                  <TabsTrigger
                    value="info"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600"
                  >
                    Info
                  </TabsTrigger>
                  <TabsTrigger
                    value="how"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600"
                  >
                    How It Works
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="info" className="pt-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">Category</h4>
                    <p className="text-lg font-semibold">
                      {challenge.category?.charAt(0).toUpperCase()}
                      {challenge.category?.slice(1)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">Created</h4>
                    <p className="text-lg font-semibold">
                      {formatDistanceToNow(new Date(challenge.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {challenge.dueDate && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">Due Date</h4>
                      <p className="text-lg font-semibold">
                        {formatDistanceToNow(new Date(challenge.dueDate), { addSuffix: true })}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="how" className="pt-6 space-y-4">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Choose Your Side</h4>
                      <p className="text-sm text-slate-500">Select YES or NO on the market outcome</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Stake Your Amount</h4>
                      <p className="text-sm text-slate-500">Lock your coins in the betting pool</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Wait for Resolution</h4>
                      <p className="text-sm text-slate-500">Challenge is resolved by the admin</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Claim Your Winnings</h4>
                      <p className="text-sm text-slate-500">Winning side shares the total pool</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participation Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 sticky top-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 tracking-wide">Participate</h3>

              <div className="space-y-3 mb-6">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase mb-2">Min Stake</div>
                  <div className="text-2xl font-bold text-green-600">
                    {getCurrencySymbol(challenge.paymentTokenAddress)}
                    {parseInt(challenge.amount || "0").toLocaleString()}
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setShowJoinModal(true)}
                className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg mb-4"
              >
                Join Market
              </Button>

              {/* Benefits */}
              <div className="space-y-3">
                <div className="flex gap-2 text-xs">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Escrow protected funds</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Instant automated payouts</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Earn bonus points</span>
                </div>
              </div>
            </div>

            {/* Market Info */}
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-200 dark:border-amber-900/40">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Betting Pool
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Community prediction market with transparent odds and automated settlement.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Join Modal */}
      {showJoinModal && (
        <JoinChallengeModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          challenge={{
            id: challenge.id,
            title: challenge.title,
            category: challenge.category,
            amount: challenge.amount,
            description: challenge.description,
          }}
          userBalance={
            balance && typeof balance === "object"
              ? (balance as any).balance
              : typeof balance === "number"
                ? balance
                : 0
          }
        />
      )}

      <MobileNavigation />
    </div>
  );
}
