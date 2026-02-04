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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

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

  if (!challenge) return null;

  const challenger = challenge.challengerUser;
  const stakeAmount = challenge.stakeAmount || '0';
  const stakeInUSDC = (parseInt(stakeAmount) / 1e6).toFixed(2);

  // For Open Challenges, show creator's side and auto-assign opponent's side
  const creatorSide = challenge.challengerSide || 'YES'; // Creator's choice
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
        const result = await apiRequest('POST', `/api/challenges/${challenge.id}/accept-open`, {
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
          setLocation(`/chat/${challenge.id}`);
          onClose();
        }, 2000);
      } else {
        // For Direct Challenges, use the existing blockchain flow
        const result = await acceptP2PChallenge({
          challengeId: challenge.id,
          stakeAmount: challenge.stakeAmountWei?.toString() || stakeAmount,
          paymentToken: challenge.paymentTokenAddress || '0x833589fCD6eDb6E08f4c7C32D4f71b3566dA8860',
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
          setLocation(`/chat/${challenge.id}`);
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">Accept Challenge</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Challenger Info - Compact */}
          <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
            {challenger?.profileImageUrl ? (
              <img
                src={challenger.profileImageUrl}
                alt={challenger.firstName || 'Challenger'}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <UserAvatar user={challenger} size={32} />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs">
                {challenger?.firstName || challenger?.username || 'Unknown'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {challenge.title}
              </p>
            </div>
          </div>

          {/* For Open Challenges: Show creator's side choice and opponent's auto-assigned side */}
          {isOpenChallenge && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-900">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Creator Chose</p>
                <div className={`text-sm font-bold p-2 rounded-md ${
                  creatorSide === 'YES' 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                  {creatorSide === 'YES' ? '✓ YES' : '✗ NO'}
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">You Pick</p>
                <div className={`text-sm font-bold p-2 rounded-md ${
                  opponentSide === 'YES' 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                  {opponentSide === 'YES' ? '✓ YES' : '✗ NO'}
                </div>
              </div>
            </div>
          )}

          {/* Challenge Details - Minimal */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="text-xs text-slate-500">Category</p>
              <p className="text-sm font-semibold capitalize">{challenge.category}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Stake</p>
              <p className="text-sm font-semibold text-[#ccff00]">
                {stakeInUSDC} USDC
              </p>
            </div>
          </div>

          {/* Status Messages */}
          {transactionHash && (
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                  Challenge Accepted!
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          {isRetrying && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Loader className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Processing...
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={onClose}
              disabled={isSubmitting || isRetrying}
              className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAcceptChallenge}
              disabled={isSubmitting || isRetrying || !!transactionHash}
              className="flex-1 bg-[#ccff00] text-black hover:bg-[#b8e600] disabled:opacity-50 text-xs h-9 font-semibold"
            >
              {isSubmitting || isRetrying ? (
                <>
                  <Loader className="w-3 h-3 mr-1 animate-spin" />
                  Accepting...
                </>
              ) : transactionHash ? (
                '✓ Accepted'
              ) : (
                'Accept'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
