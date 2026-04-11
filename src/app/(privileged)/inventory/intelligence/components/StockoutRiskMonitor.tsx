'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function StockoutRiskMonitor() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Stockout Risk Prediction
        </CardTitle>
        <CardDescription>
          AI-powered stockout probability analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button>Analyze Stockout Risk</Button>
      </CardContent>
    </Card>
  );
}
