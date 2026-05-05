'use client';

/**
 * Transfer Analysis Component
 * ============================
 *
 * DECISION-GRADE transfer cost analysis with opportunity costs.
 * Industry-first 3-component opportunity cost calculation.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRightLeft,
  DollarSign,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { useIntelligenceAPI } from '../hooks/useIntelligenceAPI';

export default function TransferAnalysis() {
  const [formData, setFormData] = useState({
    product_id: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    quantity: '',
    reason: '',
  });

  const { loading, error, analyzeTransfer } = useIntelligenceAPI();
  const [analysis, setAnalysis] = useState<any>(null);

  const handleAnalyze = async () => {
    const result = await analyzeTransfer({
      product_id: parseInt(formData.product_id),
      from_warehouse_id: parseInt(formData.from_warehouse_id),
      to_warehouse_id: parseInt(formData.to_warehouse_id),
      quantity: parseInt(formData.quantity),
      reason: formData.reason || undefined,
    });

    if (result) {
      setAnalysis(result);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Analysis
          </CardTitle>
          <CardDescription>
            Complete cost analysis with industry-first opportunity cost calculation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_id">Product ID *</Label>
              <Input
                id="product_id"
                type="number"
                placeholder="Enter product ID"
                value={formData.product_id}
                onChange={(e) => handleInputChange('product_id', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="Units to transfer"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="from_warehouse">From Warehouse *</Label>
              <Input
                id="from_warehouse"
                type="number"
                placeholder="Source warehouse ID"
                value={formData.from_warehouse_id}
                onChange={(e) => handleInputChange('from_warehouse_id', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="to_warehouse">To Warehouse *</Label>
              <Input
                id="to_warehouse"
                type="number"
                placeholder="Destination warehouse ID"
                value={formData.to_warehouse_id}
                onChange={(e) => handleInputChange('to_warehouse_id', e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Why is this transfer needed?"
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={!formData.product_id || !formData.from_warehouse_id || !formData.to_warehouse_id || !formData.quantity || loading}
            className="w-full md:w-auto"
          >
            {loading ? 'Analyzing...' : 'Analyze Transfer'}
          </Button>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-app-error-bg text-app-error rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Executive Summary */}
          <Card className={`border-2 ${
            analysis.approval_recommendation.decision === 'approve' ? 'border-app-success bg-app-success-bg' :
            analysis.approval_recommendation.decision === 'reject' ? 'border-app-error bg-app-error-bg' :
            'border-app-warning bg-app-warning-bg'
          }`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {analysis.approval_recommendation.decision === 'approve' ? (
                    <CheckCircle className="h-6 w-6 text-app-success" />
                  ) : analysis.approval_recommendation.decision === 'reject' ? (
                    <XCircle className="h-6 w-6 text-app-error" />
                  ) : (
                    <Info className="h-6 w-6 text-app-warning" />
                  )}
                  {analysis.executive_summary}
                </CardTitle>
                <Badge variant="outline" className="text-lg">
                  Score: {analysis.transfer_score}/100
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                {analysis.approval_recommendation.reasoning}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Confidence:</span>
                <span className="text-sm">{(analysis.approval_recommendation.confidence * 100).toFixed(0)}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Direct Costs (6 Components) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Direct Costs (6 Components)
                </CardTitle>
                <CardDescription>
                  Tangible transfer expenses
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <CostItem label="Shipping" value={analysis.cost_analysis.shipping} />
                <CostItem label="Handling" value={analysis.cost_analysis.handling} />
                <CostItem label="Packaging" value={analysis.cost_analysis.packaging} />
                <CostItem label="Labor" value={analysis.cost_analysis.labor} />
                <CostItem label="Insurance" value={analysis.cost_analysis.insurance} />
                <CostItem label="Fuel Surcharge" value={analysis.cost_analysis.fuel_surcharge} />
                <div className="pt-3 border-t">
                  <CostItem
                    label="Total Direct Cost"
                    value={analysis.cost_analysis.total_direct_cost}
                    highlight
                  />
                </div>
              </CardContent>
            </Card>

            {/* Opportunity Costs (3 Components) - INDUSTRY FIRST! */}
            <Card className="border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-purple-600" />
                  Opportunity Costs (3 Components)
                  <Badge variant="secondary" className="ml-2">Industry First!</Badge>
                </CardTitle>
                <CardDescription>
                  Hidden costs competitors don't show
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <CostItem
                  label="Margin Loss During Transit"
                  value={analysis.opportunity_cost_analysis.margin_loss_during_transit}
                  tooltip="Lost sales while stock is in motion"
                />
                <CostItem
                  label="Stockout Risk at Source"
                  value={analysis.opportunity_cost_analysis.stockout_risk_at_source}
                  tooltip="Risk of depleting source warehouse"
                />
                <CostItem
                  label="Delayed Fulfillment Cost"
                  value={analysis.opportunity_cost_analysis.delayed_fulfillment_cost}
                  tooltip="Impact of delivery delays"
                />
                <div className="pt-3 border-t">
                  <CostItem
                    label="Total Opportunity Cost"
                    value={analysis.opportunity_cost_analysis.total_opportunity_cost}
                    highlight
                  />
                </div>
                <div className="pt-3 border-t border-purple-300 bg-purple-50 -mx-6 px-6 py-3 rounded">
                  <CostItem
                    label="TRUE TOTAL COST"
                    value={analysis.opportunity_cost_analysis.total_combined_cost}
                    highlight
                    className="text-purple-900"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stock Impact & Route Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock Impact */}
            <Card>
              <CardHeader>
                <CardTitle>Stock Impact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Source Warehouse</span>
                    <Badge variant={analysis.stock_impact.source_risk_level === 'high' ? 'destructive' : 'outline'}>
                      {analysis.stock_impact.source_risk_level} risk
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Before: {analysis.stock_impact.source_before} units</span>
                    <span>After: {analysis.stock_impact.source_after} units</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Destination Warehouse</span>
                    <Badge variant={analysis.stock_impact.destination_risk_level === 'low' ? 'secondary' : 'outline'}>
                      {analysis.stock_impact.destination_risk_level} risk
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Before: {analysis.stock_impact.destination_before} units</span>
                    <span>After: {analysis.stock_impact.destination_after} units</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Route Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Route Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Distance:</span>
                  <span className="text-sm font-medium">{analysis.route_analysis.direct_distance_km} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transit Time:</span>
                  <span className="text-sm font-medium">{analysis.route_analysis.transit_days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Optimal Route:</span>
                  <span className="text-sm font-medium capitalize">{analysis.route_analysis.optimal_route}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Component
function CostItem({ label, value, highlight, tooltip, className }: {
  label: string;
  value: number;
  highlight?: boolean;
  tooltip?: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-between items-center ${className}`}>
      <span className={`text-sm ${highlight ? 'font-bold' : 'text-muted-foreground'}`} title={tooltip}>
        {label}
        {tooltip && <Info className="inline h-3 w-3 ml-1 text-muted-foreground" />}
      </span>
      <span className={`text-sm ${highlight ? 'font-bold text-lg' : ''}`}>
        ${value.toFixed(2)}
      </span>
    </div>
  );
}
