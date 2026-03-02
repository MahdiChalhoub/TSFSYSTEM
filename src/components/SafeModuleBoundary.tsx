'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
 children: ReactNode;
 moduleName?: string;
 fallback?: ReactNode;
}

interface State {
 hasError: boolean;
 error?: Error;
}

export class SafeModuleBoundary extends Component<Props, State> {
 public state: State = {
 hasError: false
 };

 public static getDerivedStateFromError(error: Error): State {
 return { hasError: true, error };
 }

 public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
 console.error(`[ModuleErrorBoundary] Failure in module ${this.props.moduleName}:`, error, errorInfo);
 }

 public render() {
 if (this.state.hasError) {
 if (this.props.fallback) return this.props.fallback;

 return (
 <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center gap-3">
 <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
 <AlertCircle size={20} />
 </div>
 <div>
 <h4 className="text-sm font-bold text-red-400">Module Error</h4>
 <p className="text-xs text-red-300/70">
 {this.props.moduleName || 'Component'} failed to load.
 <span className="block mt-1 font-mono text-[10px] opacity-50">{this.state.error?.message}</span>
 </p>
 </div>
 </div>
 );
 }

 return this.props.children;
 }
}
