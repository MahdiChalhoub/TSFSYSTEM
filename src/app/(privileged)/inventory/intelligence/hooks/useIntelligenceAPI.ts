/**
 * Intelligence API Hook
 * =====================
 *
 * React hook for accessing inventory intelligence endpoints.
 */

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const INTELLIGENCE_BASE = `${API_BASE}/api/inventory/intelligence`;

interface ForecastDemandParams {
  product_id: number;
  days_ahead?: number;
  warehouse_id?: number;
}

interface AnalyzeTransferParams {
  product_id: number;
  from_warehouse_id: number;
  to_warehouse_id: number;
  quantity: number;
  reason?: string;
}

interface OptimizeAllocationParams {
  order_items: Array<{
    product_id: number;
    quantity: number;
  }>;
  customer_location?: {
    latitude: number;
    longitude: number;
  };
  priority?: string;
  strategy?: string;
}

export function useIntelligenceAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAPI = async (endpoint: string, params: any) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token') || '';

      const response = await fetch(`${INTELLIGENCE_BASE}/${endpoint}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const forecastDemand = async (params: ForecastDemandParams) => {
    return fetchAPI('forecast-demand', params);
  };

  const analyzeTransfer = async (params: AnalyzeTransferParams) => {
    return fetchAPI('analyze-transfer', params);
  };

  const optimizeAllocation = async (params: OptimizeAllocationParams) => {
    return fetchAPI('optimize-allocation', params);
  };

  const optimizeReorder = async (params: { product_id: number; warehouse_id?: number }) => {
    return fetchAPI('optimize-reorder', params);
  };

  const calculateATP = async (params: {
    product_id: number;
    quantity: number;
    required_date?: string;
    warehouse_id?: number;
  }) => {
    return fetchAPI('calculate-atp', params);
  };

  const classifyABC = async (params: { warehouse_id?: number }) => {
    const token = localStorage.getItem('auth_token') || '';

    try {
      setLoading(true);
      setError(null);

      const url = new URL(`${INTELLIGENCE_BASE}/classify-abc/`);
      if (params.warehouse_id) {
        url.searchParams.append('warehouse_id', params.warehouse_id.toString());
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Token ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const predictStockoutRisk = async (params: {
    product_id: number;
    warehouse_id?: number;
    days_ahead?: number;
  }) => {
    return fetchAPI('stockout-risk', params);
  };

  return {
    loading,
    error,
    forecastDemand,
    analyzeTransfer,
    optimizeAllocation,
    optimizeReorder,
    calculateATP,
    classifyABC,
    predictStockoutRisk,
  };
}
