/**
 * Lifecycle Action Buttons
 * =========================
 * Dynamic buttons for lifecycle operations: Lock, Verify, Unlock, etc.
 *
 * Features:
 * - Shows only applicable buttons based on current status
 * - Handles permissions (Manager override, etc.)
 * - Comment modal for UNLOCK/UNVERIFY
 *
 * Usage:
 *   <LifecycleActions
 *     model="Invoice"
 *     instanceId={invoice.id}
 *     transactionType="SALES_INVOICE"
 *     lifecycleStatus="LOCKED"
 *     currentLevel={1}
 *     requiredLevels={3}
 *     allowOverride={true}
 *     isManager={userIsManager}
 *     onSuccess={() => refreshData()}
 *   />
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Lock, Unlock, ShieldCheck, ShieldOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LifecycleActionsProps {
  model: string;
  instanceId: number;
  transactionType: string;
  lifecycleStatus: 'OPEN' | 'LOCKED' | 'VERIFIED' | 'CONFIRMED';
  currentLevel: number;
  requiredLevels: number;
  allowOverride?: boolean;
  isManager?: boolean;
  onSuccess?: () => void;
  className?: string;
}

export function LifecycleActions({
  model,
  instanceId,
  transactionType,
  lifecycleStatus,
  currentLevel,
  requiredLevels,
  allowOverride = false,
  isManager = false,
  onSuccess,
  className = ''
}: LifecycleActionsProps) {
  const [loading, setLoading] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentAction, setCommentAction] = useState<'unlock' | 'unverify' | null>(null);
  const [comment, setComment] = useState('');

  const isFullyVerified = currentLevel >= requiredLevels;

  // API call helper
  const lifecycleAction = async (endpoint: string, data: any) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lifecycle/${endpoint}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          instance_id: instanceId,
          transaction_type: transactionType,
          ...data
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Operation failed');
      }

      toast.success(result.message || 'Success');
      onSuccess?.();
      return result;
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Action handlers
  const handleLock = async () => {
    await lifecycleAction('lock', {});
  };

  const handleVerify = async () => {
    await lifecycleAction('verify', {});
  };

  const handleVerifyAndComplete = async () => {
    if (!comment.trim()) {
      toast.error('Comment is required for manager override');
      return;
    }
    await lifecycleAction('verify-complete', { comment });
    setComment('');
    setCommentModalOpen(false);
  };

  const handleUnlock = async () => {
    if (!comment.trim()) {
      toast.error('Comment is required for unlock');
      return;
    }
    await lifecycleAction('unlock', { comment });
    setComment('');
    setCommentModalOpen(false);
  };

  const handleUnverify = async () => {
    if (!comment.trim()) {
      toast.error('Comment is required for unverify');
      return;
    }
    await lifecycleAction('unverify', { comment });
    setComment('');
    setCommentModalOpen(false);
  };

  const openCommentModal = (action: 'unlock' | 'unverify') => {
    setCommentAction(action);
    setComment('');
    setCommentModalOpen(true);
  };

  const handleCommentSubmit = () => {
    if (commentAction === 'unlock') {
      handleUnlock();
    } else if (commentAction === 'unverify') {
      handleUnverify();
    }
  };

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* LOCK Button (OPEN → LOCKED) */}
        {lifecycleStatus === 'OPEN' && (
          <Button
            onClick={handleLock}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <Lock className="h-4 w-4 mr-2" />
            Lock
          </Button>
        )}

        {/* VERIFY Button (LOCKED/VERIFIED → next level) */}
        {lifecycleStatus in ['LOCKED', 'VERIFIED'] && !isFullyVerified && (
          <Button
            onClick={handleVerify}
            disabled={loading}
            variant="default"
            size="sm"
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Verify (Level {currentLevel + 1})
          </Button>
        )}

        {/* VERIFY & COMPLETE Button (Manager Override) */}
        {isManager &&
          allowOverride &&
          lifecycleStatus in ['LOCKED', 'VERIFIED'] &&
          !isFullyVerified && (
            <Button
              onClick={() => openCommentModal('unlock')} // Will handle via modal
              disabled={loading}
              variant="destructive"
              size="sm"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Verify & Complete
            </Button>
          )}

        {/* UNLOCK Button (LOCKED → OPEN) */}
        {lifecycleStatus === 'LOCKED' && (
          <Button
            onClick={() => openCommentModal('unlock')}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <Unlock className="h-4 w-4 mr-2" />
            Unlock
          </Button>
        )}

        {/* UNVERIFY Button (VERIFIED/CONFIRMED → previous level) */}
        {lifecycleStatus in ['VERIFIED', 'CONFIRMED'] && currentLevel > 0 && (
          <Button
            onClick={() => openCommentModal('unverify')}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <ShieldOff className="h-4 w-4 mr-2" />
            Unverify
          </Button>
        )}
      </div>

      {/* Comment Modal */}
      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {commentAction === 'unlock' ? 'Unlock Transaction' : 'Unverify Transaction'}
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for this action. This will be recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              placeholder="Enter your reason..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCommentModalOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCommentSubmit}
              disabled={loading || !comment.trim()}
            >
              {loading ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
