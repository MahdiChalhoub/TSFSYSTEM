/**
 * Blanc Engine — Unified Entry Point
 * 
 * The Engine is the lowest layer of the 4-tier architecture stack:
 *   Engine → Kernel → Core → Modules
 * 
 * It provides zero-logic infrastructure abstractions:
 * - storage:  localStorage/sessionStorage with namespacing
 * - events:   Pub/Sub event bus for cross-module communication
 * - network:  HTTP client wrappers (erpFetch, getTenantContext, getUser)
 * - config:   Platform configuration and dynamic branding
 * - modules:  Dynamic module registration system
 * 
 * Usage:
 *   import { Engine } from '@/engine'
 *   Engine.storage.get('key')
 *   Engine.events.emit('order:created', data)
 *   await Engine.network.fetch('products/')
 *   Engine.config.PLATFORM_CONFIG.name
 *   Engine.modules.registerModule(definition)
 */

import * as storage from './storage';
import * as events from './events';
import * as network from './network';
import * as config from './config';
import * as modules from './modules';

export const Engine = {
    storage: storage.storage,
    events: events.events,
    network,
    config,
    modules
} as const;

// Named re-exports for tree-shaking
export { storage } from './storage';
export { events } from './events';
export * from './network';
export * from './config';
export * from './modules';
