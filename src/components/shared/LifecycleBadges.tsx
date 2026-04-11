/**
 * Lifecycle Status Badges
 * ========================
 * Display lifecycle status and verification progress for any VerifiableModel.
 *
 * Usage:
 *   <LifecycleBadges
 *     lifecycleStatus="LOCKED"
 *     currentLevel={1}
 *     requiredLevels={3}
 *     isControlled={true}
 *   />
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

interface LifecycleBadgesProps {
  lifecycleStatus: 'OPEN' | 'LOCKED' | 'VERIFIED' | 'CONFIRMED';
  currentLevel: number;
  requiredLevels: number;
  isControlled?: boolean;
  className?: string;
}

export function LifecycleBadges({
  lifecycleStatus,
  currentLevel,
  requiredLevels,
  isControlled = true,
  className = ''
}: LifecycleBadgesProps) {
  // Status badge configuration
  const statusConfig = {
    OPEN: {
      label: 'Open',
      icon: AlertCircle,
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    },
    LOCKED: {
      label: 'Locked',
      icon: Lock,
      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    },
    VERIFIED: {
      label: 'Verified',
      icon: ShieldCheck,
      className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    },
    CONFIRMED: {
      label: 'Confirmed',
      icon: CheckCircle,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    }
  };

  const status = statusConfig[lifecycleStatus];
  const StatusIcon = status.icon;

  // Verification progress
  const verificationProgress = isControlled
    ? `L${currentLevel} / L${requiredLevels}`
    : 'No Approval Required';

  const isFullyVerified = currentLevel >= requiredLevels;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status Badge */}
      <Badge className={`flex items-center gap-1.5 ${status.className}`}>
        <StatusIcon className="h-3.5 w-3.5" />
        <span>{status.label}</span>
      </Badge>

      {/* Controlled Badge */}
      {isControlled ? (
        <Badge
          className={`flex items-center gap-1.5 ${
            isFullyVerified
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{verificationProgress}</span>
        </Badge>
      ) : (
        <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          No Approval Required
        </Badge>
      )}
    </div>
  );
}

/**
 * Compact version for list views
 */
export function LifecycleBadgeCompact({
  lifecycleStatus,
  currentLevel,
  requiredLevels
}: LifecycleBadgesProps) {
  const statusColors = {
    OPEN: 'bg-blue-500',
    LOCKED: 'bg-orange-500',
    VERIFIED: 'bg-purple-500',
    CONFIRMED: 'bg-green-500'
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2 w-2 rounded-full ${statusColors[lifecycleStatus]}`} />
      <span className="text-xs text-muted-foreground">
        L{currentLevel}/{requiredLevels}
      </span>
    </div>
  );
}
