'use client';

/**
 * Inventory Intelligence Dashboard
 * =================================
 *
 * AI-powered inventory analytics and decision support.
 *
 * Features:
 * - Demand Forecasting
 * - Reorder Optimization
 * - Transfer Analysis
 * - Order Allocation
 * - ABC Classification
 * - Stockout Risk Prediction
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Target,
  BarChart3,
  ArrowRightLeft,
  Brain
} from 'lucide-react';

// Import sub-components
import DemandForecast from './components/DemandForecast';
import TransferAnalysis from './components/TransferAnalysis';
import AllocationOptimizer from './components/AllocationOptimizer';
import ABCClassification from './components/ABCClassification';
import StockoutRiskMonitor from './components/StockoutRiskMonitor';
import ReorderOptimizer from './components/ReorderOptimizer';

export default function IntelligenceDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Inventory Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered analytics and decision support for inventory management
          </p>
        </div>

        <Button variant="outline" size="sm">
          View Decision Logs
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="forecast">
            <TrendingUp className="h-4 w-4 mr-2" />
            Forecast
          </TabsTrigger>
          <TabsTrigger value="reorder">
            <Package className="h-4 w-4 mr-2" />
            Reorder
          </TabsTrigger>
          <TabsTrigger value="transfer">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transfer
          </TabsTrigger>
          <TabsTrigger value="allocation">
            <Target className="h-4 w-4 mr-2" />
            Allocation
          </TabsTrigger>
          <TabsTrigger value="abc">
            <BarChart3 className="h-4 w-4 mr-2" />
            ABC
          </TabsTrigger>
          <TabsTrigger value="stockout">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Stockout
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Decisions Made Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">247</div>
                <p className="text-xs text-muted-foreground">+12% from yesterday</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Average Confidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">87%</div>
                <p className="text-xs text-muted-foreground">High confidence level</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Auto-Approved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">182</div>
                <p className="text-xs text-muted-foreground">74% automation rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cost Savings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$12.4K</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Recommendations</CardTitle>
                <CardDescription>
                  AI-generated insights from the last 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <RecommendationItem
                    type="warning"
                    title="Low Stock Alert"
                    message="Product #1234 will stockout in 3 days"
                    action="Reorder Now"
                  />
                  <RecommendationItem
                    type="success"
                    title="Transfer Approved"
                    message="WH-1 → WH-3: 50 units, Score: 92/100"
                    action="View Details"
                  />
                  <RecommendationItem
                    type="info"
                    title="Optimal Allocation"
                    message="Order #5678 allocated across 2 warehouses"
                    action="View Plan"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Decision Accuracy</CardTitle>
                <CardDescription>
                  Model performance over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Chart: Decision accuracy trend (92% → 95% → 87% → 94%)
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Demand Forecast Tab */}
        <TabsContent value="forecast">
          <DemandForecast />
        </TabsContent>

        {/* Reorder Optimizer Tab */}
        <TabsContent value="reorder">
          <ReorderOptimizer />
        </TabsContent>

        {/* Transfer Analysis Tab */}
        <TabsContent value="transfer">
          <TransferAnalysis />
        </TabsContent>

        {/* Allocation Optimizer Tab */}
        <TabsContent value="allocation">
          <AllocationOptimizer />
        </TabsContent>

        {/* ABC Classification Tab */}
        <TabsContent value="abc">
          <ABCClassification />
        </TabsContent>

        {/* Stockout Risk Tab */}
        <TabsContent value="stockout">
          <StockoutRiskMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper Component
function RecommendationItem({ type, title, message, action }: {
  type: 'success' | 'warning' | 'info';
  title: string;
  message: string;
  action: string;
}) {
  const colors = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="flex items-start justify-between p-3 border rounded-lg">
      <div className="flex-1">
        <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${colors[type]} mb-1`}>
          {title}
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="ghost" size="sm">
        {action}
      </Button>
    </div>
  );
}
