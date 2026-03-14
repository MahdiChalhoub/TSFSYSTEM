import os
import re

page_path = '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/modules/migration/page.tsx'

with open(page_path, 'r') as f:
    orig_content = f.read()

def extract_block(content, prefix, suffix=None, open_brace='{', close_brace='}'):
    start_idx = content.find(prefix)
    if start_idx == -1: return None, content
    
    if suffix: # Text-based static extraction
        end_idx = content.find(suffix, start_idx) + len(suffix)
        return content[start_idx:end_idx], content[:start_idx] + content[end_idx:]
    
    # Brace matching extraction
    brace_start = content.find(open_brace, start_idx)
    if brace_start == -1: return None, content
    
    brace_count = 1
    end_idx = brace_start + 1
    while brace_count > 0 and end_idx < len(content):
        if content[end_idx] == open_brace: brace_count += 1
        elif content[end_idx] == close_brace: brace_count -= 1
        end_idx += 1
        
    extracted = content[start_idx:end_idx]
    remainder = content[:start_idx] + content[end_idx:]
    return extracted, remainder

remainder = orig_content

# 1. Types
types_block, remainder = extract_block(remainder, 'interface MigrationJob', '\n}\n')
preview_types, remainder = extract_block(remainder, 'interface PreviewData', '\n}\n')
biz_types, remainder = extract_block(remainder, 'interface Business', '\n}\n')
wiz_types, remainder = extract_block(remainder, 'type WizardStep = ', 'RESULTS"')
review_types, remainder = extract_block(remainder, 'interface ReviewEntity', '\n}\n')
review_data, remainder = extract_block(remainder, 'interface ReviewData', '\n}\n')
pipe_step_type, remainder = extract_block(remainder, 'interface PipelineStep', '\n}\n')
pipe_data_type, remainder = extract_block(remainder, 'interface PipelineData', '\n}\n')

wiz_types = wiz_types.strip() if wiz_types else ""

types_ts = f"""export {types_block}
export {preview_types}
export {biz_types}
export {wiz_types}
export {review_types}
export {review_data}
export {pipe_step_type}
export {pipe_data_type}
"""

components_dir = '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/modules/migration/components'
os.makedirs(components_dir, exist_ok=True)
with open(f'{components_dir}/types.ts', 'w') as f: f.write(types_ts.replace('interface', 'export interface'))

# 2. Extract specific constants (statusConfig, entityIcons, IMPORT_SOURCES, ENTITY_LABELS, ENTITY_COLORS)
# It's safer to keep them in page.tsx right now or keep it simple.
# Let's extract the functional components: MigrationPipeline, COAMappingModal, MigrationReviewDashboard
pipe_comp, remainder = extract_block(remainder, 'function MigrationPipeline')
coa_comp, remainder = extract_block(remainder, 'function COAMappingModal')
dash_comp, remainder = extract_block(remainder, 'function MigrationReviewDashboard')

# 3. Create components
shared_imports = """\"use client\"
import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Upload, DatabaseZap, Server, FileUp, Play, RotateCcw, CheckCircle2, XCircle, Loader2, ArrowRight, ArrowLeft, Eye, AlertTriangle, RefreshCw, Database, Layers, Package, Users, ShoppingCart, Banknote, Tag, Ruler, BarChart3, Trash2, Building2, Globe, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { MigrationJob, PipelineStep, PipelineData, ReviewEntity, ReviewData } from "./types"
"""

with open(f'{components_dir}/MigrationPipeline.tsx', 'w') as f:
    f.write(shared_imports)
    f.write("import { getMigrationPipeline, resumeMigration } from '../actions'\n\n")
    f.write(f"export {pipe_comp}\n")

with open(f'{components_dir}/COAMappingModal.tsx', 'w') as f:
    f.write(shared_imports)
    f.write(f"export {coa_comp}\n")

with open(f'{components_dir}/MigrationReviewDashboard.tsx', 'w') as f:
    f.write(shared_imports)
    f.write("import { getMigrationReview, getMigrationSamples, approveMigrationEntity, getAccountMapping, saveAccountMapping } from '../actions'\n")
    f.write("import { COAMappingModal } from './COAMappingModal'\n\n")
    f.write(f"export {dash_comp}\n")

# 4. Modify Page.tsx
new_imports = """import { MigrationPipeline } from "./components/MigrationPipeline"
import { COAMappingModal } from "./components/COAMappingModal"
import { MigrationReviewDashboard } from "./components/MigrationReviewDashboard"
import { MigrationJob, PreviewData, Business, WizardStep } from "./components/types"
"""

lines = remainder.split('\n')
import_idx = -1
for i, line in enumerate(lines):
    if line.startswith('import ') and 'Separator' in line:
        import_idx = i
        break

lines.insert(import_idx + 1, new_imports)
final_content = '\\n'.join(lines)

with open(page_path, 'w') as f:
    f.write(final_content)
