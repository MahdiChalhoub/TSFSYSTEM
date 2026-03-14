'use client';

/**
 * Demand Forecast Component
 * ==========================
 *
 * ML-based demand forecasting with confidence intervals.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { useIntelligenceAPI } from '../hooks/useIntelligenceAPI';

export default function DemandForecast() {
  const [productId, setProductId] = useState('');
  const [daysAhead, setDaysAhead] = useState('30');
  const [warehouseId, setWarehouseId] = useState('');

  const { loading, error, forecastDemand } = useIntelligenceAPI();
  const [forecast, setForecast] = useState<any>(null);

  const handleForecast = async () => {
    const result = await forecastDemand({
      product_id: parseInt(productId),
      days_ahead: parseInt(daysAhead),
      warehouse_id: warehouseId ? parseInt(warehouseId) : undefined,
    });

    if (result) {
      setForecast(result);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Demand Forecasting
          </CardTitle>
          <CardDescription>
            ML-based prediction of future product demand
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product">Product ID</Label>
              <Input
                id="product"
                type="number"
                placeholder="Enter product ID"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="days">Days Ahead</Label>
              <Select value={daysAhead} onValueChange={setDaysAhead}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse">Warehouse (Optional)</Label>
              <Input
                id="warehouse"
                type="number"
                placeholder="All warehouses"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleForecast}
            disabled={!productId || loading}
            className="w-full md:w-auto"
          >
            {loading ? 'Forecasting...' : 'Generate Forecast'}
          </Button>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {forecast && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Summary Cards */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Predicted Demand
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {forecast.total_predicted_demand?.toFixed(0) || 0} units
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Next {daysAhead} days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Confidence Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {((forecast.confidence_score || 0) * 100).toFixed(0)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {forecast.confidence_score > 0.8 ? 'High confidence' : 'Medium confidence'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {forecast.current_stock || 0} units
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {forecast.current_stock < forecast.total_predicted_demand ? (
                  <span className="text-red-600">⚠️ Below forecast</span>
                ) : (
                  <span className="text-green-600">✓ Sufficient</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Forecast Chart */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Daily Forecast</CardTitle>
              <CardDescription>
                Predicted demand for the next {daysAhead} days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-right p-2">Predicted Demand</th>
                      <th className="text-right p-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.forecast?.map((item: any, index: number) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="p-2 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {item.date}
                        </td>
                        <td className="text-right p-2 font-medium">
                          {item.predicted_demand.toFixed(1)} units
                        </td>
                        <td className="text-right p-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                            item.confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {(item.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation */}
          {forecast.recommendation && (
            <Card className="lg:col-span-3 border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900">AI Recommendation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-800">{forecast.recommendation}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
