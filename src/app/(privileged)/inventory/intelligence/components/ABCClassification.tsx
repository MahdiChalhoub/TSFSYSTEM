'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';

export default function ABCClassification() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          ABC Classification
        </CardTitle>
        <CardDescription>
          Pareto analysis: A (top 20%), B (30%), C (50%)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button>Run ABC Analysis</Button>
      </CardContent>
    </Card>
  );
}
