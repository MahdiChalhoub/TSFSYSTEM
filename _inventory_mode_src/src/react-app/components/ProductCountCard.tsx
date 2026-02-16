import { useState, useEffect } from 'react';
import { X, MapPin, Tag, Save, Lock, Unlock, RefreshCw } from 'lucide-react';

interface ProductCountCardProps {
  line: {
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    unit: string;
    category: string;
    brand: string;
    system_qty: number | null;
    physical_qty: number | null;
    difference: number | null;
    current_system_qty: number;
    counted_at: string | null;
  };
  session: {
    id: number;
    location: string;
    section: string;
  };
  personName: string;
  onClose: () => void;
  onSubmit: (lineId: number, qty: number, systemQtyOverride?: number) => Promise<void>;
  onUnlock?: (lineId: number) => Promise<void>;
}

export default function ProductCountCard({
  line,
  session,
  personName,
  onClose,
  onSubmit,
  onUnlock
}: ProductCountCardProps) {
  const [physicalQty, setPhysicalQty] = useState<string>(
    line.physical_qty !== null ? line.physical_qty.toString() : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [liveData, setLiveData] = useState<{
    qty_in_location: number;
    total_qty: number;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isLocked = line.physical_qty !== null && line.counted_at !== null;
  
  // Use live data if available, otherwise use snapshot or current system qty
  const displaySystemQty = liveData 
    ? liveData.qty_in_location 
    : (line.system_qty !== null ? line.system_qty : line.current_system_qty);
  const difference = physicalQty ? parseInt(physicalQty) - displaySystemQty : null;

  // Auto-sync live data when card opens
  useEffect(() => {
    syncLiveData();
  }, []);

  const syncLiveData = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/inventory-sessions/${session.id}/products/${line.product_id}/sync-live-qty`);
      if (res.ok) {
        const data = await res.json();
        setLiveData(data);
      } else {
        const error = await res.json();
        setSyncError(error.error || 'Failed to sync live data');
      }
    } catch (error) {
      console.error('Failed to sync live data:', error);
      setSyncError('Failed to sync live data');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async () => {
    if (!physicalQty || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // Use live qty as system qty if available
      const systemQtyOverride = liveData ? liveData.qty_in_location : undefined;
      await onSubmit(line.id, parseInt(physicalQty), systemQtyOverride);
      onClose();
    } catch (error) {
      console.error('Failed to submit count:', error);
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    // TODO: Validate unlock code against admin settings
    if (unlockCode !== '1234') { // Temporary - will be replaced with admin settings
      alert('Invalid unlock code');
      return;
    }

    if (onUnlock) {
      await onUnlock(line.id);
      setShowUnlockPrompt(false);
      setUnlockCode('');
    }
  };

  const handleDraft = () => {
    // Just close without submitting - the value is already stored as draft
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">{line.product_name}</h2>
              <div className="flex items-center gap-4 text-sm text-blue-100">
                {line.sku && <span>SKU: {line.sku}</span>}
                {line.category && <span>• {line.category}</span>}
                {line.brand && <span>• {line.brand}</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - No scroll, fixed height */}
        <div className="p-6">
          {/* Location & Category Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Location</p>
                <p className="font-semibold text-slate-900">{session.location}</p>
                <p className="text-sm text-slate-600">{session.section}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Tag className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Category</p>
                <p className="font-semibold text-slate-900">{line.category || 'N/A'}</p>
                {line.brand && <p className="text-sm text-slate-600">{line.brand}</p>}
              </div>
            </div>
          </div>

          {/* Live Data Sync */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Live Quantity Data</h3>
              <button
                onClick={syncLiveData}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync
              </button>
            </div>
            
            {isSyncing && (
              <p className="text-sm text-slate-500">Syncing live data from API...</p>
            )}
            
            {syncError && (
              <p className="text-sm text-red-600">{syncError}</p>
            )}
            
            {liveData && !isSyncing && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Qty in This Location</p>
                  <p className="text-2xl font-bold text-blue-600">{liveData.qty_in_location}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total in All Locations</p>
                  <p className="text-2xl font-bold text-slate-900">{liveData.total_qty}</p>
                </div>
              </div>
            )}
          </div>

          {/* Quantities - Horizontal Layout */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-2">System Qty</p>
                <p className="text-3xl font-bold text-slate-900">{displaySystemQty}</p>
                <p className="text-xs text-slate-500 mt-1">{line.unit}</p>
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-600 mb-2">Physical Count</p>
                <input
                  type="number"
                  value={physicalQty}
                  onChange={(e) => setPhysicalQty(e.target.value)}
                  disabled={isLocked}
                  placeholder="0"
                  className="w-full text-3xl font-bold text-center border-2 border-blue-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
                />
                <p className="text-xs text-slate-500 mt-1">{personName}</p>
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-600 mb-2">Difference</p>
                {difference !== null ? (
                  <div>
                    <p className={`text-3xl font-bold ${
                      difference === 0 ? 'text-green-600' : 
                      difference > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {difference > 0 ? '+' : ''}{difference}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{line.unit}</p>
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-slate-300">—</p>
                )}
              </div>
            </div>

            <div className="text-center text-xs text-slate-500">
              System Qty (from last sync): <span className="font-semibold text-slate-700">{line.current_system_qty} {line.unit}</span>
            </div>
          </div>

          {/* Lock Status or Unlock Prompt */}
          {isLocked && !showUnlockPrompt && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-900">Locked</p>
                  <p className="text-sm text-yellow-700">
                    Counted at {new Date(line.counted_at!).toLocaleString()}
                  </p>
                </div>
              </div>
              {onUnlock && (
                <button
                  onClick={() => setShowUnlockPrompt(true)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition-colors flex items-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  Unlock
                </button>
              )}
            </div>
          )}

          {showUnlockPrompt && (
            <div className="bg-white border-2 border-yellow-300 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Unlock className="w-5 h-5 text-yellow-600" />
                <p className="font-medium text-slate-900">Enter unlock code</p>
              </div>
              <input
                type="password"
                value={unlockCode}
                onChange={(e) => setUnlockCode(e.target.value)}
                placeholder="Enter admin code..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 mb-3"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleUnlock}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Unlock
                </button>
                <button
                  onClick={() => {
                    setShowUnlockPrompt(false);
                    setUnlockCode('');
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDraft}
              className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={!physicalQty || isSubmitting || isLocked}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              <Lock className="w-5 h-5" />
              {isSubmitting ? 'Submitting...' : 'Submit & Lock'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
