'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, MapPin } from 'lucide-react';

export default function AllocationOptimizer() {
  const [strategy, setStrategy] = useState('smart');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Order Allocation Optimizer
        </CardTitle>
        <CardDescription>
          Smart multi-warehouse allocation with 4 strategies
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Strategy</Label>
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smart">Smart (Multi-criteria)</SelectItem>
                <SelectItem value="nearest">Nearest (Distance)</SelectItem>
                <SelectItem value="cheapest">Cheapest (Cost)</SelectItem>
                <SelectItem value="balanced">Balanced (Equal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select defaultValue="STANDARD">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD">Standard</SelectItem>
                <SelectItem value="EXPRESS">Express</SelectItem>
                <SelectItem value="BULK">Bulk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="w-full md:w-auto">Optimize Allocation</Button>
      </CardContent>
    </Card>
  );
}
