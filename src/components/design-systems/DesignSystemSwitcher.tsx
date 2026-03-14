"use client";

import React from "react";
import { useDesignSystem } from "@/contexts/DesignSystemContext";
import { DesignSystemId } from "@/lib/design-systems/design-system-framework";
import { Palette, Sun, Moon, Check } from "lucide-react";

interface DesignSystemSwitcherProps {
  compact?: boolean;
  showLabel?: boolean;
}

export function DesignSystemSwitcher({
  compact = false,
  showLabel = true,
}: DesignSystemSwitcherProps) {
  const {
    currentSystem,
    colorMode,
    availableSystems,
    switchSystem,
    toggleColorMode,
    setColorMode,
  } = useDesignSystem();

  const [isOpen, setIsOpen] = React.useState(false);

  const handleSystemChange = (systemId: DesignSystemId) => {
    switchSystem(systemId);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Color Mode Toggle */}
        <button
          onClick={toggleColorMode}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
          title={`Switch to ${colorMode === "light" ? "dark" : "light"} mode`}
        >
          {colorMode === "light" ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {colorMode === "light" ? "Dark" : "Light"} Mode
          </span>
        </button>

        {/* Design System Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <Palette className="w-4 h-4" />
            <span className="text-sm font-medium flex-1 text-left">
              {availableSystems.find((s) => s.id === currentSystem)?.name ||
                "Design System"}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-2 py-2 rounded-lg shadow-lg z-50"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              {availableSystems.map((system) => (
                <button
                  key={system.id}
                  onClick={() => handleSystemChange(system.id)}
                  className="w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors hover:bg-opacity-80"
                  style={{
                    background:
                      currentSystem === system.id
                        ? "var(--color-surface-hover)"
                        : "transparent",
                    color: "var(--color-text)",
                  }}
                >
                  <div>
                    <div className="font-medium">{system.name}</div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {system.description}
                    </div>
                  </div>
                  {currentSystem === system.id && (
                    <Check className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full version
  return (
    <div className="space-y-4">
      {showLabel && (
        <div>
          <h3
            className="text-lg font-semibold mb-1"
            style={{ color: "var(--color-text)" }}
          >
            Design System
          </h3>
          <p
            className="text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Choose your preferred UI design language
          </p>
        </div>
      )}

      {/* Color Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setColorMode('light')}
          className={`flex-1 px-4 py-2 rounded-lg transition-all ${colorMode === "light" ? "ring-2 ring-[var(--color-primary)]" : ""
            }`}
          style={{
            background:
              colorMode === "light"
                ? "var(--color-primary)"
                : "var(--color-surface)",
            color:
              colorMode === "light"
                ? "#ffffff"
                : "var(--color-text)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Sun className="w-4 h-4 mx-auto mb-1" />
          <span className="text-sm">Light</span>
        </button>

        <button
          onClick={() => setColorMode('dark')}
          className={`flex-1 px-4 py-2 rounded-lg transition-all ${colorMode === "dark" ? "ring-2 ring-[var(--color-primary)]" : ""
            }`}
          style={{
            background:
              colorMode === "dark"
                ? "var(--color-primary)"
                : "var(--color-surface)",
            color:
              colorMode === "dark"
                ? "#ffffff"
                : "var(--color-text)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Moon className="w-4 h-4 mx-auto mb-1" />
          <span className="text-sm">Dark</span>
        </button>
      </div>

      {/* Design System Cards */}
      <div className="space-y-2">
        {availableSystems.map((system) => (
          <button
            key={system.id}
            onClick={() => handleSystemChange(system.id)}
            className={`w-full p-4 rounded-lg text-left transition-all ${currentSystem === system.id ? "ring-2 ring-[var(--color-primary)]" : ""
              }`}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div
                  className="font-semibold"
                  style={{ color: "var(--color-text)" }}
                >
                  {system.name}
                </div>
                <div
                  className="text-xs"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  by {system.author}
                </div>
              </div>
              {currentSystem === system.id && (
                <Check className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
              )}
            </div>

            <p
              className="text-sm mb-3"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {system.description}
            </p>

            {/* Color preview */}
            <div className="flex gap-1">
              <div
                className="w-6 h-6 rounded"
                style={{
                  background:
                    colorMode === "light"
                      ? system.colors.light.primary
                      : system.colors.dark.primary,
                }}
                title="Primary"
              />
              <div
                className="w-6 h-6 rounded"
                style={{
                  background:
                    colorMode === "light"
                      ? system.colors.light.success
                      : system.colors.dark.success,
                }}
                title="Success"
              />
              <div
                className="w-6 h-6 rounded"
                style={{
                  background:
                    colorMode === "light"
                      ? system.colors.light.warning
                      : system.colors.dark.warning,
                }}
                title="Warning"
              />
              <div
                className="w-6 h-6 rounded"
                style={{
                  background:
                    colorMode === "light"
                      ? system.colors.light.error
                      : system.colors.dark.error,
                }}
                title="Error"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

