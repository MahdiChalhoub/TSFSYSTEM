# Responsive Tab Navigation Documentation

## Goal
To provide a high-fidelity workspace navigation experience that handles an unlimited number of open tabs without breaking the UI, ensuring smooth responsiveness across all screen sizes.

## Data Movement
- **Data READ From**: 
  - `AdminContext` (`openTabs`, `activeTab`)
  - DOM `ResizeObserver` (Container width)
- **Data SAVED To**:
  - `AdminContext` (Active tab state, Closing tabs)

## User Interaction Variables
- `containerRef`: Reference to the tab strip for width measurement.
- `visibleCount`: Dynamic number of tabs that fit the current screen.
- `isMenuOpen`: Boolean for the "More" dropdown visibility.

## Step-by-Step Workflow
1. **Resize Detection**: `ResizeObserver` monitors the `TabNavigator` container.
2. **Width Calculation**: Component calculates `maxVisible = (Width - DropdownWidth) / TabMinWidth`.
3. **Tab Splitting**: Tabs are split into `visibleTabs` and `hiddenTabs`.
4. **Rendering**:
   - `visibleTabs` are rendered as standard tab items.
   - `hiddenTabs` are injected into a custom, high-fidelity dropdown.
5. **Action**: User clicks a tab in the dropdown; `openTab` is called; the dropdown closes.

## How it Achieves the Goal
By combining `ResizeObserver` for real-time layout awareness with `React.memo` for rendering efficiency, the system provides a robust solution for multi-tasking within the ERP without UI clutter.
