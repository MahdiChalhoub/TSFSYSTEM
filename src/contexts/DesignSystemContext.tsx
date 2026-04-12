"use client";

/**
 * Design System Context
 * =====================
 * Manages the active design system and applies it to the entire app.
 *
 * Users can switch between:
 * - Ant Design
 * - Material Design
 * - Apple HIG
 * - Tailwind
 * - TSF Custom
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  DesignSystemId,
  DesignSystem,
  getDesignSystem,
  getAllDesignSystems,
  applyDesignSystem,
  getCurrentDesignSystem,
  getCurrentColorMode,
} from "@/lib/design-systems/design-system-framework";

// Import all presets
import { ANT_DESIGN_SYSTEM } from "@/lib/design-systems/presets/ant-design";
import { MATERIAL_DESIGN_SYSTEM } from "@/lib/design-systems/presets/material-design";
import { APPLE_HIG_SYSTEM } from "@/lib/design-systems/presets/apple-hig";
import { TAILWIND_SYSTEM } from "@/lib/design-systems/presets/tailwind";

// Register all systems
const DESIGN_SYSTEMS_REGISTRY = {
  "ant-design": ANT_DESIGN_SYSTEM,
  "material-design": MATERIAL_DESIGN_SYSTEM,
  "apple-hig": APPLE_HIG_SYSTEM,
  tailwind: TAILWIND_SYSTEM,
  // "tsf-custom": TSF_CUSTOM_SYSTEM, // TODO: Create this
};

interface DesignSystemContextValue {
  currentSystem: DesignSystemId;
  currentSystemObject: DesignSystem | null;
  colorMode: "light" | "dark";
  availableSystems: DesignSystem[];
  switchSystem: (systemId: DesignSystemId) => void;
  toggleColorMode: () => void;
  setColorMode: (mode: "light" | "dark") => void;
}

const DesignSystemContext = createContext<DesignSystemContextValue | undefined>(
  undefined
);

export function useDesignSystem(): DesignSystemContextValue {
  const context = useContext(DesignSystemContext);
  if (!context) {
    throw new Error(
      "useDesignSystem must be used within DesignSystemProvider"
    );
  }
  return context;
}

interface DesignSystemProviderProps {
  children: React.ReactNode;
  defaultSystem?: DesignSystemId;
  defaultColorMode?: "light" | "dark";
}

export function DesignSystemProvider({
  children,
  defaultSystem = "tailwind",
  defaultColorMode = "light",
}: DesignSystemProviderProps) {
  // Lazy-initialize from localStorage so the design system is correct on first
  // render — avoids the double-apply flash (default → saved) on page load.
  const [currentSystem, setCurrentSystem] = useState<DesignSystemId>(() => {
    if (typeof window === "undefined") return defaultSystem;
    const saved = localStorage.getItem("design-system") as DesignSystemId | null;
    return (saved && saved in DESIGN_SYSTEMS_REGISTRY) ? saved : defaultSystem;
  });
  const [colorMode, setColorModeState] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return defaultColorMode;
    const saved = localStorage.getItem("design-system-color-mode") as "light" | "dark" | null;
    return saved ?? defaultColorMode;
  });
  const [currentSystemObject, setCurrentSystemObject] =
    useState<DesignSystem | null>(null);

  // Apply design system whenever it changes
  useEffect(() => {
    const system = DESIGN_SYSTEMS_REGISTRY[currentSystem as keyof typeof DESIGN_SYSTEMS_REGISTRY];
    if (system) {
      setCurrentSystemObject(system);
      applyDesignSystem(system, colorMode);

      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("design-system", currentSystem);
        localStorage.setItem("design-system-color-mode", colorMode);
      }
    }
  }, [currentSystem, colorMode]);

  const switchSystem = (systemId: DesignSystemId) => {
    if (systemId in DESIGN_SYSTEMS_REGISTRY) {
      setCurrentSystem(systemId);
    } else {
      console.warn(`❌ [DesignSystem] Design system "${systemId}" not found`);
    }
  };

  const toggleColorMode = () => {
    setColorModeState((prev) => {
      const newMode = prev === "light" ? "dark" : "light"
      return newMode
    });
  };

  const setColorMode = (mode: "light" | "dark") => {
    setColorModeState(mode);
  };

  const availableSystems = Object.values(DESIGN_SYSTEMS_REGISTRY);

  const value: DesignSystemContextValue = {
    currentSystem,
    currentSystemObject,
    colorMode,
    availableSystems,
    switchSystem,
    toggleColorMode,
    setColorMode,
  };

  return (
    <DesignSystemContext.Provider value={value}>
      {children}
    </DesignSystemContext.Provider>
  );
}

/**
 * Wrapper component for easy integration
 */
export function DesignSystemWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DesignSystemProvider defaultSystem="tailwind" defaultColorMode="light">
      {children}
    </DesignSystemProvider>
  );
}
