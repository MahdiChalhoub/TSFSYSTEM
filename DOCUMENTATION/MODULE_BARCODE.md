# Barcode Settings Module Documentation

## Overview
This module manages the configuration for automatic barcode generation (EAN-13), ensuring unique product identifiers.

---

## Database Schema (Django Models)

### 1. BarcodeSettings
**Purpose**: Stores global configuration for barcode generation per tenant.
**Columns**:
- `prefix`: Char (e.g., "200") - First digits of barcode.
- `next_sequence`: Integer - Auto-incrementing counter.
- `length`: Integer (Default 13).
- `is_enabled`: Boolean.
**Relationships**: Linked to Organization (Tenant).
**Readers**: `BarcodeSettingsViewSet`, `BarcodeService`
**Writers**: `BarcodeService.generate_barcode`

### 2. TransactionSequence (related utility)
**Purpose**: Generic sequencer for other document types (Invoices, Loans).
**Columns**: `type`, `prefix`, `next_number`, `padding`.
**Readers/Writers**: `SequenceService`.

---

## Pages & API

### Page: Barcode Settings (`/admin/settings/barcode`)
**Goal**: Configure barcode prefix and view status.
**Data READ**: `GET /api/settings/barcode/`
**Data SAVED**: `POST /api/settings/barcode/` (Update)
**Variables**: Prefix, Next Sequence, Enabled Status.
**Workflow**:
1. User loads page.
2. Backend ensures default settings exist if missing.
3. User updates Preifx (e.g., changes "200" to "201").
4. Saves -> Backend updates DB.

### Usage in Product Form
**Goal**: specific feature to generate barcode when creating product.
**Data READ**: N/A
**Data SAVED**: `POST /api/settings/barcode/generate/`
**Workflow**:
1. User clicks "Generate Barcode".
2. Frontend calls API.
3. Backend:
    - Locks `BarcodeSettings` row.
    - constructs candidate (Prefix + Sequence + Padding).
    - Calculates Check Digit (EAN-13 algorithm).
    - Verifies uniqueness against `Product` table.
    - Increments sequence.
    - Returns valid barcode.
4. Frontend fills input.

---

## Workflows

### Workflow: Generate EAN-13 Barcode
**Goal**: Produce a valid, unique EAN-13 barcode strings.
**Actors**: User, BarcodeService
**Steps**:
1. Request generation.
2. Read Prefix (P) and Sequence (S).
3. Pad S to fit (12 - len(P)).
4. Payload = P + Pad(S).
5. Calculate Check Digit (C) using Modulo 10 algorithm (Odds*1 + Evens*3).
6. Result = Payload + C.
7. Increment S in DB.
**Tables Affected**: `BarcodeSettings`
