import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MobileNavigation } from "@/components/MobileNavigation";
import { DynamicMetaTags } from "@/components/DynamicMetaTags";
import { ChallengeChat } from "@/components/ChallengeChat";
import { AcceptChallengeModal } from "@/components/AcceptChallengeModal";
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
  Zap,
  Clock,
  Shield,
  CheckCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DirectChallengeDetailProps {
  challenge: any;
}

export default function DirectChallengeDetail({ challenge }: DirectChallengeDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showChat, setShowChat] = useState(false);

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

  const isChallenger = user?.id === challenge.challenger;
  const isChallenged = user?.id === challenge.challenged;
  const isParticipant = isChallenger || isChallenged;

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    active: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    disputed: "bg-red-100 text-red-800",
  };

  const getStatusColor = (status: string) => statusColors[status] || "bg-slate-100 text-slate-800";

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 pb-24">
      <DynamicMetaTags
        challenge={challenge}
        pageType="challenge"
        customImage={challenge?.coverImageUrl}
      />

      {/* Hero Section */}
      <div className="relative h-64 md:h-80 bg-gradient-to-br from-purple-600 to-purple-900 overflow-hidden">
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
            <Badge className="bg-purple-400 text-purple-900">DIRECT P2P</Badge>
            <Badge variant="outline" className={`text-white border-white/30`}>
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
            {/* Key Stats */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {getCurrencySymbol(challenge.paymentTokenAddress)}
                    {parseInt(challenge.amount || "0").toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 font-semibold uppercase mt-2">Stake Per Party</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-600">
                    {getCurrencySymbol(challenge.paymentTokenAddress)}
                    {parseInt(challenge.amount || "0") * 2}
                  </div>
                  <div className="text-xs text-slate-500 font-semibold uppercase mt-2">Total Pool</div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4">Challenge Details</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                {challenge.description || "No description provided."}
              </p>

              {challenge.category && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Category: </span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {challenge.category.charAt(0).toUpperCase() + challenge.category.slice(1)}
                  </span>
                </div>
              )}
            </div>

            {/* Status Timeline */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Status & Timeline
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Status</span>
                  <Badge className={getStatusColor(challenge.status)}>
                    {challenge.status?.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Created</span>
                  <span className="text-sm">
                    {formatDistanceToNow(new Date(challenge.createdAt), { addSuffix: true })}
                  </span>
                </div>
                {challenge.dueDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Due</span>
                    <span className="text-sm">
                      {formatDistanceToNow(new Date(challenge.dueDate), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Rules & Terms */}
            <Tabs defaultValue="rules" className="w-full">
              <div className="border-b border-slate-200 dark:border-slate-800">
                <TabsList className="bg-transparent p-0 w-full justify-start">
                  <TabsTrigger
                    value="rules"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600"
                  >
                    Rules
                  </TabsTrigger>
                  <TabsTrigger
                    value="sides"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600"
                  >
                    Sides
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="rules" className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">Escrow Protected</h4>
                      <p className="text-xs text-slate-500">Funds locked until resolution verified</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">Instant Settlement</h4>
                      <p className="text-xs text-slate-500">Automated payout after voting ends</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">Verified Results</h4>
                      <p className="text-xs text-slate-500">Both parties dispute and resolve outcome</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="sides" className="pt-6">
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                      {challenge.challengerSide === "YES" ? "YES" : "NO"} Side (Creator)
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-400">
                      Taken by {challenge.challengerUser?.username}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                    <div className="font-semibold text-orange-900 dark:text-orange-300 mb-1">
                      {challenge.challengerSide === "NO" ? "YES" : "NO"} Side (Opponent)
                    </div>
                    <div className="text-xs text-orange-700 dark:text-orange-400">
                      Available for {challenge.challengedUser?.username || "waiting"}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participants */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 tracking-wide">Participants</h3>

              {/* Creator */}
              <div className="mb-6">
                <div className="text-xs font-bold text-slate-400 uppercase mb-3">Creator</div>
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={challenge.challengerUser?.profileImageUrl} />
                    <AvatarFallback>
                      {challenge.challengerUser?.username?.charAt(0).toUpperCase() || "C"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-sm">
                      {challenge.challengerUser?.username || "Unknown"}
                    </div>
                    <Badge className="mt-1 text-xs">Creator</Badge>
                  </div>
                </div>
              </div>

              {/* Opponent */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-400 uppercase mb-3">Opponent</div>
                {challenge.challengedUser ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={challenge.challengedUser?.profileImageUrl} />
                      <AvatarFallback>
                        {challenge.challengedUser?.username?.charAt(0).toUpperCase() || "O"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-sm">
                        {challenge.challengedUser?.username || "Unknown"}
                      </div>
                      <Badge className="mt-1 text-xs bg-green-600">Joined</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Waiting for opponent...</div>
                )}
              </div>
            </div>

            {/* Action Button */}
            {!isParticipant && challenge.status === "pending" && (
              <Button
                onClick={() => setShowAcceptModal(true)}
                className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg"
              >
                Accept Challenge
              </Button>
            )}

            {isParticipant && challenge.status === "active" && (
              <Button
                onClick={() => setShowChat(!showChat)}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                {showChat ? "Hide" : "Open"} Discussion
              </Button>
            )}

            {/* Info */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-200 dark:border-purple-900/40">
              <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300 mb-2">Direct Challenge</h4>
              <p className="text-xs text-purple-800 dark:text-purple-300">
                One-on-one competition between two specific users. Both parties stake equal amounts in escrow.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accept Modal */}
      {showAcceptModal && (
        <AcceptChallengeModal
          isOpen={showAcceptModal}
          onClose={() => setShowAcceptModal(false)}
          challenge={challenge}
          onSuccess={() => {
            toast({
              title: "Challenge Accepted!",
              description: "You have accepted the challenge.",
            });
          }}
        />
      )}

      {/* Chat */}
      {showChat && isParticipant && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl h-[80vh]">
            <ChallengeChat challenge={challenge} onClose={() => setShowChat(false)} />
          </div>
        </div>
      )}

      <MobileNavigation />
    </div>
  );
}
