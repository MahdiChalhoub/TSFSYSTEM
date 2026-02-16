import { useState, useEffect } from 'react';
import { RefreshCw, Database, CheckCircle, XCircle, Loader2, MapPin, RotateCcw } from 'lucide-react';

interface SyncStatus {
  is_syncing: boolean;
  last_id: number;
  last_sync_at: string | null;
}

export default function SyncPanel() {
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [isSyncingLocations, setIsSyncingLocations] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ total: 0, lastId: 0 });
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [productSyncResult, setProductSyncResult] = useState<{
    success: boolean;
    message: string;
    totalSynced?: number;
  } | null>(null);
  const [locationSyncResult, setLocationSyncResult] = useState<{
    success: boolean;
    message: string;
    totalSynced?: number;
  } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Poll sync status for products - only when actively syncing
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/sync/status');
        
        // Handle authentication errors gracefully
        if (!response.ok) {
          // Don't try to parse non-JSON error responses
          return;
        }
        
        const data = await response.json();
        setSyncStatus(data);
      } catch (error) {
        // Silently handle errors - user may not be logged in
        console.error('Failed to fetch sync status:', error);
      }
    };

    // Initial fetch
    fetchStatus();
    
    // Only poll if sync is active
    if (isSyncingProducts || syncStatus?.is_syncing) {
      const interval = setInterval(fetchStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isSyncingProducts, syncStatus?.is_syncing]);

  const handleProductSync = async () => {
    setIsSyncingProducts(true);
    setProductSyncResult(null);
    setSyncProgress({ total: 0, lastId: 0 });

    try {
      let done = false;
      let totalSynced = 0;

      // Loop until sync is complete
      while (!done) {
        const response = await fetch('/api/sync/products', {
          method: 'POST',
        });

        // Handle non-JSON error responses
        if (!response.ok) {
          const text = await response.text();
          let errorMessage = 'Sync failed';
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = text || errorMessage;
          }
          setProductSyncResult({
            success: false,
            message: errorMessage,
          });
          setIsSyncingProducts(false);
          return;
        }

        const data = await response.json();
        
        if (!data.success) {
          setProductSyncResult({
            success: false,
            message: data.error || 'Sync failed',
          });
          setIsSyncingProducts(false);
          return;
        }

        // Update progress
        totalSynced = data.totalSynced;
        done = data.done;
        setSyncProgress({ total: totalSynced, lastId: data.lastId });

        // If not done, continue in the loop
        // Small delay to prevent overwhelming the server
        if (!done) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Sync complete
      setProductSyncResult({
        success: true,
        message: 'Product sync completed successfully',
        totalSynced,
      });
    } catch (error) {
      setProductSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
      });
    } finally {
      setIsSyncingProducts(false);
      setSyncProgress({ total: 0, lastId: 0 });
    }
  };

  const handleResetSync = async () => {
    setIsResetting(true);
    setProductSyncResult(null);

    try {
      const response = await fetch('/api/sync/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_type: 'products' }),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = 'Reset failed';
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }
        setProductSyncResult({
          success: false,
          message: errorMessage,
        });
        return;
      }

      const data = await response.json();
      setProductSyncResult({
        success: true,
        message: data.message || 'Sync state has been reset. You can now start a new sync.',
      });
      setIsSyncingProducts(false);
      setSyncProgress({ total: 0, lastId: 0 });
    } catch (error) {
      setProductSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleLocationSync = async () => {
    setIsSyncingLocations(true);
    setLocationSyncResult(null);

    try {
      const response = await fetch('/api/sync/locations', {
        method: 'POST',
      });

      // Handle non-JSON error responses
      if (!response.ok) {
        const text = await response.text();
        let errorMessage = 'Location sync failed';
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }
        setLocationSyncResult({
          success: false,
          message: errorMessage,
        });
        return;
      }

      const data = await response.json();
      setLocationSyncResult({
        success: true,
        message: data.message,
        totalSynced: data.totalSynced,
      });
    } catch (error) {
      setLocationSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
      });
    } finally {
      setIsSyncingLocations(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Product Sync */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-slate-200/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Product Sync</h3>
              <p className="text-sm text-slate-600">Synchronize products from TSFCI API</p>
              {syncStatus?.last_sync_at && (
                <p className="text-xs text-slate-500 mt-1">
                  Last sync: {new Date(syncStatus.last_sync_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleProductSync}
            disabled={isSyncingProducts}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncingProducts ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Sync Now
              </>
            )}
          </button>
        </div>

        {isSyncingProducts && (
          <div className="mb-4">
            {syncProgress.total > 0 && (
              <>
                <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                  <span>Syncing products...</span>
                  <span className="font-medium">{syncProgress.total.toLocaleString()} synced</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-purple-600 to-purple-700 h-full rounded-full transition-all duration-500 animate-pulse"
                    style={{ width: '100%' }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Processing in batches to avoid timeout. This may take a minute for large catalogs.
                </p>
              </>
            )}
          </div>
        )}

        {syncStatus?.is_syncing && !isSyncingProducts && (
          <div className="mb-4">
            <p className="text-sm text-amber-700 mb-2">
              Sync appears to be stuck. Click below to reset and try again.
            </p>
            <button
              onClick={handleResetSync}
              disabled={isResetting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
            >
              {isResetting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Reset stuck sync
            </button>
          </div>
        )}

        {productSyncResult && (
          <div
            className={`flex items-start gap-3 p-4 rounded-xl ${
              productSyncResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {productSyncResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={`font-medium ${
                  productSyncResult.success ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {productSyncResult.message}
              </p>
              {productSyncResult.totalSynced !== undefined && (
                <p className="text-sm text-green-700 mt-1">
                  {productSyncResult.totalSynced.toLocaleString()} products synchronized and stored in the database
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Location Sync */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-slate-200/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Location Sync</h3>
              <p className="text-sm text-slate-600">Synchronize warehouse locations from TSFCI API</p>
            </div>
          </div>
          <button
            onClick={handleLocationSync}
            disabled={isSyncingLocations}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncingLocations ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Sync Now
              </>
            )}
          </button>
        </div>

        {locationSyncResult && (
          <div
            className={`flex items-start gap-3 p-4 rounded-xl ${
              locationSyncResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {locationSyncResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={`font-medium ${
                  locationSyncResult.success ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {locationSyncResult.message}
              </p>
              {locationSyncResult.totalSynced !== undefined && (
                <p className="text-sm text-green-700 mt-1">
                  {locationSyncResult.totalSynced} locations synchronized and stored in the database
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
