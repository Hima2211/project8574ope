import { useState } from 'react';
import { useLocation } from 'wouter';
import { useBlockchainChallenge } from '@/hooks/useBlockchainChallenge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { AlertCircle, CheckCircle, Loader, Shield, Coins, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// Category icon mapping
function getCategoryIcon(category?: string): string {
  const map: Record<string, string> = {
    crypto: '₿',
    sports: '⚽',
    gaming: '🎮',
    music: '🎵',
    politics: '🗳️',
    entertainment: '🎬',
    technology: '💻',
    finance: '💰',
    news: '📰',
    general: '🎯',
    trading: '📈',
    fitness: '🏃',
    skill: '🧠',
  };
  return (category && map[category.toLowerCase()]) || '🎯';
}

interface AcceptChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: any;
  onSuccess?: () => void;
  isOpenChallenge?: boolean;
}

export function AcceptChallengeModal({
  isOpen,
  onClose,
  challenge,
  onSuccess,
  isOpenChallenge = false,
}: AcceptChallengeModalProps) {
  const [, setLocation] = useLocation();
  const { acceptP2PChallenge, isRetrying } = useBlockchainChallenge();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch full challenge details if notification data is incomplete
  const { data: fullChallenge } = useQuery({
    queryKey: ['challenge', challenge?.id],
    queryFn: async () => {
      if (!challenge?.id) return null;
      try {
        const res = await apiRequest('GET', `/api/challenges/${challenge.id}`);
        return res;
      } catch (err) {
        console.warn('Failed to fetch full challenge details:', err);
        return null;
      }
    },
    enabled: isOpen && !!challenge?.id && (!challenge?.stakeAmount && !challenge?.stakeAmountWei && !challenge?.amount),
  });

  // Use full challenge data if available, otherwise fall back to notification data
  const enrichedChallenge = fullChallenge || challenge;

  if (!enrichedChallenge) return null;

  const challenger = enrichedChallenge.challengerUser;

  // Determine stake (per-side) in USDC; support multiple notification payload shapes
  const stakeInUSDC = (() => {
    try {
      console.log('🔍 Challenge object received:', {
        id: enrichedChallenge.id,
        stakeAmount: enrichedChallenge.stakeAmount,
        stakeAmountWei: enrichedChallenge.stakeAmountWei,
        amount: enrichedChallenge.amount,
        totalPool: enrichedChallenge.totalPool,
        challengerUser: enrichedChallenge.challengerUser,
      });

      // 1) If wei value is present (smallest units, USDC has 6 decimals), prefer that
      if (enrichedChallenge.stakeAmountWei) {
        const weiStr = String(enrichedChallenge.stakeAmountWei);
        console.log('✓ Using stakeAmountWei:', weiStr);
        const weiBig = BigInt(weiStr);
        const usdc = Number(weiBig) / 1e6; // convert to USDC
        return usdc.toFixed(2);
      }

      // 2) If explicit stakeAmount (per-side) is provided, use it directly
      if (enrichedChallenge.stakeAmount !== undefined && enrichedChallenge.stakeAmount !== null) {
        const val = Number(enrichedChallenge.stakeAmount);
        console.log('✓ Using stakeAmount:', val);
        if (!Number.isNaN(val)) return val.toFixed(2);
      }

      // 3) If only total amount is provided (total pool), and it's the 'amount' field,
      //    assume it's the total and use half for per-side if totalPool or total indicator exists
      if (enrichedChallenge.amount !== undefined && enrichedChallenge.totalPool !== undefined) {
        const total = Number(enrichedChallenge.amount);
        console.log('✓ Using amount/2 from totalPool:', total / 2);
        if (!Number.isNaN(total)) return (total / 2).toFixed(2);
      }

      // 4) Fallback to 'amount' as per-side if nothing else available
      const fallback = Number(enrichedChallenge.amount || 0);
      console.log('✓ Using fallback amount:', fallback);
      return (Number.isNaN(fallback) ? 0 : fallback).toFixed(2);
    } catch (err) {
      console.error('Error computing stakeInUSDC:', err);
      return '0.00';
    }
  })();

  // For Open Challenges, show creator's side and auto-assign opponent's side
  const creatorSide = enrichedChallenge.challengerSide || 'YES'; // Creator's choice
  const opponentSide = creatorSide === 'YES' ? 'NO' : 'YES'; // Auto-assigned opposite

  const handleAcceptChallenge = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      setTransactionHash(null);

      toast({
        title: 'Accepting Challenge',
        description: 'Preparing transaction...',
      });

      // For Open Challenges, call accept-open endpoint instead
      if (isOpenChallenge) {
        const result = await apiRequest('POST', `/api/challenges/${enrichedChallenge.id}/accept-open`, {
          side: opponentSide,
        });

        setTransactionHash(result.transactionHash || 'pending');

        toast({
          title: '✅ Challenge Accepted!',
          description: `You picked ${opponentSide}. Stake locked in escrow.`,
        });

        setTimeout(() => {
          onSuccess?.();
          // Redirect to chat room
          setLocation(`/chat/${enrichedChallenge.id}`);
          onClose();
        }, 2000);
      } else {
        // For Direct Challenges, use the existing blockchain flow
        const result = await acceptP2PChallenge({
          challengeId: enrichedChallenge.id,
          stakeAmount: enrichedChallenge.stakeAmountWei?.toString() || String(enrichedChallenge.stakeAmount),
          paymentToken: enrichedChallenge.paymentTokenAddress || '0x833589fCD6eDb6E08f4c7C32D4f71b3566dA8860',
          pointsReward: ''
        });

        setTransactionHash(result.transactionHash);

        toast({
          title: '✅ Challenge Accepted!',
          description: `Transaction: ${result.transactionHash?.slice(0, 10)}...`,
        });

        setTimeout(() => {
          onSuccess?.();
          // Redirect to chat room
          setLocation(`/chat/${enrichedChallenge.id}`);
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Failed to accept challenge:', err);
      const errorMsg = err.message?.includes('user rejected')
        ? 'You cancelled the transaction'
        : err.message || 'Failed to accept challenge';
      
      setError(errorMsg);
      toast({
        title: '❌ Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setError(null);
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Accept Challenge</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Challenger Info - Compact */}
          <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
            {challenger?.profileImageUrl ? (
              <img
                src={challenger.profileImageUrl}
                alt={challenger.firstName || 'Challenger'}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <UserAvatar userId={challenger?.id} username={challenger?.username} size={32} />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs">
                {challenger?.firstName || challenger?.username || 'Unknown'}
              </p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-slate-500 truncate flex-1">
                  {enrichedChallenge.title}
                </p>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <img src="/assets/usd-coin-usdc-logo.svg" alt="USDC" className="w-2.5 h-2.5" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{stakeInUSDC}</span>
                </div>
              </div>
            </div>
          </div>

          {/* For Open Challenges: Show creator's side choice and opponent's auto-assigned side */}
          {isOpenChallenge && (
            <>
              <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-900">
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1">Creator Chose</p>
                  <div className={`text-xs font-bold p-1.5 rounded-md ${
                    creatorSide === 'YES' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {creatorSide === 'YES' ? '✓ YES' : '✗ NO'}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1">You Pick</p>
                  <div className={`text-xs font-bold p-1.5 rounded-md ${
                    opponentSide === 'YES' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {opponentSide === 'YES' ? '✓ YES' : '✗ NO'}
                  </div>
                </div>
              </div>

              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-tight">
                  Once accepted, both stakes lock in escrow. Challenge begins when creator confirms.
                </p>
              </div>
            </>
          )}

          {/* Challenge Details - Compact 3-column layout */}
          <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Category</p>
              <p className="text-lg">{getCategoryIcon(enrichedChallenge.category)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Your Stake</p>
              <div className="flex items-center gap-0.5">
                <img src="/assets/usd-coin-usdc-logo.svg" alt="USDC" className="w-3 h-3" />
                <p className="text-xs font-bold">{stakeInUSDC}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">to win</p>
              <div className="flex items-center gap-0.5">
                <img src="/assets/usd-coin-usdc-logo.svg" alt="USDC" className="w-3 h-3" />
                <p className="text-xs font-bold">{(Number(stakeInUSDC) * 2).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-3 h-3 text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {transactionHash && (
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                Challenge Accepted!
              </p>
            </div>
          )}

          {isRetrying && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Loader className="w-3 h-3 text-blue-600 animate-spin flex-shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-400">Processing...</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => {
                setError(null);
                onClose();
              }}
              disabled={isSubmitting || isRetrying || !!transactionHash}
              className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAcceptChallenge}
              disabled={isSubmitting || isRetrying || !!transactionHash}
              className="flex-1 bg-[#ccff00] text-black hover:bg-[#b8e600] disabled:opacity-50 text-xs h-8 font-semibold"
            >
              {isSubmitting || isRetrying ? (
                <>
                  <Loader className="w-3 h-3 mr-1 animate-spin" />
                  Staking...
                </>
              ) : transactionHash ? (
                '✓ Staked'
              ) : (
                'Stake'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
