'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';

export default function ReorderOptimizer() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Reorder Point Optimization
        </CardTitle>
        <CardDescription>
          Calculate optimal reorder points with safety stock
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button>Optimize Reorder Points</Button>
      </CardContent>
    </Card>
  );
}
