#!/usr/bin/env python3
"""
Intelligent CRUD Page Generator
================================
Generates professional list, detail, and create pages from Django models.
Reads backend models to understand field types and generates type-safe frontend pages.

Usage:
    python scripts/generate_crud_pages.py --all
    python scripts/generate_crud_pages.py --module crm --route contacts
"""

import os
import json
import re
from pathlib import Path
from typing import Dict, List, Any

# Paths
BACKEND_ROOT = Path("/root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend/apps")
FRONTEND_ROOT = Path("/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)")
GAP_REPORT = Path("/root/.gemini/antigravity/scratch/TSFSYSTEM/BACKEND_FRONTEND_GAP.json")

# Field type mappings
DJANGO_TO_TS = {
    'CharField': 'string',
    'TextField': 'string',
    'EmailField': 'string',
    'URLField': 'string',
    'IntegerField': 'number',
    'BigIntegerField': 'number',
    'FloatField': 'number',
    'DecimalField': 'number',
    'BooleanField': 'boolean',
    'DateField': 'string',
    'DateTimeField': 'string',
    'TimeField': 'string',
    'ForeignKey': 'number',
    'ManyToManyField': 'number[]',
    'JSONField': 'Record<string, any>',
}

FIELD_ICONS = {
    'name': 'User',
    'email': 'Mail',
    'phone': 'Phone',
    'address': 'MapPin',
    'company': 'Building2',
    'date': 'Calendar',
    'amount': 'DollarSign',
    'description': 'FileText',
    'notes': 'MessageCircle',
    'status': 'CheckCircle2',
    'type': 'Tag',
}

def get_icon_for_field(field_name: str) -> str:
    """Get appropriate icon for field"""
    for key, icon in FIELD_ICONS.items():
        if key in field_name.lower():
            return icon
    return 'Circle'

def parse_django_model(app_name: str, model_name: str) -> Dict[str, Any]:
    """Parse Django model to extract fields"""
    model_file = BACKEND_ROOT / app_name / "models.py"

    if not model_file.exists():
        # Try models directory
        models_dir = BACKEND_ROOT / app_name / "models"
        if models_dir.exists():
            # Find the right model file
            for file in models_dir.glob("*.py"):
                if file.name != "__init__.py":
                    model_file = file
                    break

    if not model_file.exists():
        return {'fields': [], 'model_name': model_name}

    try:
        content = model_file.read_text()

        # Find the model class
        class_pattern = rf'class {model_name}\([^)]+\):'
        match = re.search(class_pattern, content)

        if not match:
            return {'fields': [], 'model_name': model_name}

        # Extract class definition
        start = match.start()
        lines = content[start:].split('\n')

        fields = []
        for line in lines[1:]:
            if line.strip() and not line.strip().startswith('#'):
                if line.startswith('class ') or line.startswith('def '):
                    break

                # Parse field definition
                if 'models.' in line or 'Field' in line:
                    field_match = re.match(r'\s*(\w+)\s*=\s*models\.(\w+)', line)
                    if field_match:
                        field_name = field_match.group(1)
                        field_type = field_match.group(2)

                        # Check if required (no blank=True, null=True)
                        required = 'blank=True' not in line and 'null=True' not in line

                        # Extract max_length for validation
                        max_length = None
                        if 'max_length=' in line:
                            max_match = re.search(r'max_length=(\d+)', line)
                            if max_match:
                                max_length = int(max_match.group(1))

                        fields.append({
                            'name': field_name,
                            'type': field_type,
                            'ts_type': DJANGO_TO_TS.get(field_type, 'any'),
                            'required': required,
                            'max_length': max_length,
                        })

        return {
            'fields': fields,
            'model_name': model_name,
        }

    except Exception as e:
        print(f"Error parsing {model_file}: {e}")
        return {'fields': [], 'model_name': model_name}

def generate_list_page(module: str, route: str, model_info: Dict) -> str:
    """Generate list page with TypicalListView"""
    model_name = route.replace('-', '_').title().replace('_', '')

    # Generate columns from fields
    columns = []
    for field in model_info['fields'][:5]:  # First 5 fields for display
        columns.append(f"{{ key: '{field['name']}', label: '{field['name'].replace('_', ' ').title()}', sortable: true }}")

    columns_str = ',\n  '.join(columns) if columns else "{ key: 'id', label: 'ID', sortable: true }"

    return f"""'use client'

import {{ useState, useEffect }} from 'react'
import {{ useRouter }} from 'next/navigation'
import {{ TypicalListView, type ColumnDef }} from '@/components/common/TypicalListView'
import {{ TypicalFilter }} from '@/components/common/TypicalFilter'
import {{ useListViewSettings }} from '@/hooks/useListViewSettings'
import {{ erpFetch }} from '@/lib/erp-api'
import {{ Plus }} from 'lucide-react'
import {{ Button }} from '@/components/ui/button'

type {model_name} = Record<string, any>

const ALL_COLUMNS: ColumnDef<{model_name}>[] = [
  {columns_str}
]

export default function {model_name}ListPage() {{
  const router = useRouter()
  const [items, setItems] = useState<{model_name}[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const settings = useListViewSettings('{module}_{route}', {{
    columns: ALL_COLUMNS.map(c => c.key),
    pageSize: 20,
    sortKey: '{model_info['fields'][0]['name'] if model_info['fields'] else 'id'}',
    sortDir: 'asc',
  }})

  useEffect(() => {{
    loadData()
  }}, [])

  async function loadData() {{
    try {{
      setLoading(true)
      const data = await erpFetch('{module}/{route}/')
      setItems(Array.isArray(data) ? data : (data?.results || []))
    }} catch (error) {{
      console.error('Failed to load {route}:', error)
    }} finally {{
      setLoading(false)
    }}
  }}

  const filtered = items.filter(item =>
    search ? JSON.stringify(item).toLowerCase().includes(search.toLowerCase()) : true
  )

  return (
    <div className="space-y-4">
      <TypicalListView<{model_name}>
        title="{route.replace('-', ' ').title()}"
        data={{filtered}}
        loading={{loading}}
        getRowId={{r => r.id}}
        columns={{ALL_COLUMNS}}
        visibleColumns={{settings.visibleColumns}}
        onToggleColumn={{settings.toggleColumn}}
        className="rounded-[32px] border-0 shadow-sm overflow-hidden"
        pageSize={{settings.pageSize}}
        onPageSizeChange={{settings.setPageSize}}
        sortKey={{settings.sortKey}}
        sortDir={{settings.sortDir}}
        onSort={{k => settings.setSort(k)}}
        headerExtra={{
          <Button
            onClick={{() => router.push('/{module}/{route}/new')}}
            className="h-9 px-4 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
          >
            <Plus size={{14}} className="mr-2" /> Create New
          </Button>
        }}
        actions={{{{
          onView: (r) => router.push(`/{module}/{route}/${{r.id}}`),
          onEdit: (r) => router.push(`/{module}/{route}/${{r.id}}/edit`),
        }}}}
      >
        <TypicalFilter
          search={{{{ placeholder: 'Search...', value: search, onChange: setSearch }}}}
        />
      </TypicalListView>
    </div>
  )
}}
"""

def generate_detail_page(module: str, route: str, model_info: Dict) -> str:
    """Generate detail page"""
    model_name = route.replace('-', '_').title().replace('_', '')

    return f"""'use client'

import {{ useEffect, useState }} from 'react'
import {{ useRouter, useParams }} from 'next/navigation'
import {{ erpFetch }} from '@/lib/erp-api'
import {{ Button }} from '@/components/ui/button'
import {{ Card, CardContent, CardHeader, CardTitle }} from '@/components/ui/card'
import {{ Tabs, TabsContent, TabsList, TabsTrigger }} from '@/components/ui/tabs'
import {{ ArrowLeft, Edit, Trash2 }} from 'lucide-react'

export default function {model_name}DetailPage() {{
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {{
    loadData()
  }}, [id])

  async function loadData() {{
    try {{
      setLoading(true)
      const data = await erpFetch(`{module}/{route}/${{id}}/`)
      setItem(data)
    }} catch (error) {{
      console.error('Failed to load {route}:', error)
    }} finally {{
      setLoading(false)
    }}
  }}

  async function handleDelete() {{
    if (!confirm('Are you sure you want to delete this item?')) return

    try {{
      await erpFetch(`{module}/{route}/${{id}}/`, {{
        method: 'DELETE'
      }})
      router.push('/{module}/{route}')
    }} catch (error) {{
      console.error('Failed to delete:', error)
      alert('Failed to delete item')
    }}
  }}

  if (loading) {{
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-primary"></div>
      </div>
    )
  }}

  if (!item) {{
    return (
      <div className="text-center py-12">
        <p className="text-app-muted-foreground">Item not found</p>
        <Button onClick={{() => router.back()}} variant="outline" className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }}

  return (
    <div className="min-h-screen layout-container-padding theme-bg">
      {{/* Header */}}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={{() => router.back()}}
            className="h-9 px-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-black theme-text">
              {{item.name || item.title || `{route.title()} #${{item.id}}`}}
            </h1>
            <p className="theme-text-muted mt-1">
              View and manage {route.replace('-', ' ')} details
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={{() => router.push(`/{module}/{route}/${{id}}/edit`)}}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={{handleDelete}}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {{/* Content */}}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="layout-card-radius theme-surface">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {{Object.entries(item).map(([key, value]) => (
                  <div key={{key}} className="border-b border-app-border pb-3">
                    <dt className="text-sm font-bold text-app-muted-foreground uppercase">
                      {{key.replace('_', ' ')}}
                    </dt>
                    <dd className="mt-1 text-app-foreground">
                      {{typeof value === 'object' ? JSON.stringify(value) : String(value)}}
                    </dd>
                  </div>
                ))}}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="layout-card-radius theme-surface">
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-app-muted-foreground">Activity tracking coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}}
"""

def generate_create_page(module: str, route: str, model_info: Dict) -> str:
    """Generate create page with form"""
    model_name = route.replace('-', '_').title().replace('_', '')

    # Generate form fields
    form_fields = []
    for field in model_info['fields']:
        if field['name'] in ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']:
            continue

        icon = get_icon_for_field(field['name'])
        field_label = field['name'].replace('_', ' ').title()
        is_required = field['required']

        if field['type'] in ['TextField']:
            form_fields.append(f"""
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  {field_label}{' *' if is_required else ''}
                </label>
                <div className="relative">
                  <{icon} className="absolute left-4 top-4 text-app-muted-foreground" size={{18}} />
                  <textarea
                    name="{field['name']}"
                    rows={{4}}
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-app-primary outline-none transition-all font-bold text-app-foreground resize-none"
                    placeholder="{field_label}"
                    {' required' if is_required else ''}
                  />
                </div>
              </div>
            """)
        elif field['type'] == 'BooleanField':
            form_fields.append(f"""
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="{field['name']}"
                  id="{field['name']}"
                  className="w-4 h-4 rounded border-app-border"
                />
                <label htmlFor="{field['name']}" className="text-sm font-bold text-app-foreground">
                  {field_label}
                </label>
              </div>
            """)
        else:
            input_type = 'email' if field['type'] == 'EmailField' else 'text'
            if field['type'] in ['IntegerField', 'FloatField', 'DecimalField']:
                input_type = 'number'
            elif field['type'] == 'DateField':
                input_type = 'date'
            elif field['type'] == 'DateTimeField':
                input_type = 'datetime-local'

            form_fields.append(f"""
              <div>
                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  {field_label}{' *' if is_required else ''}
                </label>
                <div className="relative">
                  <{icon} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={{18}} />
                  <input
                    type="{input_type}"
                    name="{field['name']}"
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-app-primary outline-none transition-all font-bold text-app-foreground"
                    placeholder="{field_label}"
                    {' required' if is_required else ''}
                  />
                </div>
              </div>
            """)

    fields_jsx = '\n'.join(form_fields) if form_fields else '<p>No form fields available</p>'

    # Import needed icons
    icons_used = set()
    for field in model_info['fields']:
        icons_used.add(get_icon_for_field(field['name']))
    icons_import = ', '.join(sorted(icons_used))

    return f"""'use client'

import {{ useRouter }} from 'next/navigation'
import {{ useState }} from 'react'
import {{ erpFetch }} from '@/lib/erp-api'
import {{ Button }} from '@/components/ui/button'
import {{ ArrowLeft, {icons_import} }} from 'lucide-react'

export default function Create{model_name}Page() {{
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {{
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {{
      const formData = new FormData(e.currentTarget)
      const data = Object.fromEntries(formData.entries())

      await erpFetch('{module}/{route}/', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(data),
      }})

      setSuccess(true)
      setTimeout(() => router.push('/{module}/{route}'), 500)
    }} catch (err: any) {{
      setError(err.message || 'Failed to create item')
    }} finally {{
      setSubmitting(false)
    }}
  }}

  return (
    <div className="min-h-screen layout-container-padding theme-bg">
      {{/* Header */}}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={{() => router.back()}}
            className="h-9 px-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-black theme-text">
            Create {route.replace('-', ' ').title()}
          </h1>
          <p className="theme-text-muted mt-1">
            Add a new {route.replace('-', ' ')} to the system
          </p>
        </div>
      </div>

      {{/* Form */}}
      <div className="max-w-4xl">
        <div className="bg-app-surface rounded-[32px] shadow-lg border border-app-border p-6 md:p-8">
          {{error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-800 border border-red-200">
              {{error}}
            </div>
          )}}

          {{success && (
            <div className="mb-6 p-4 rounded-2xl bg-green-50 text-green-800 border border-green-200">
              Item created successfully! Redirecting...
            </div>
          )}}

          <form onSubmit={{handleSubmit}} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fields_jsx}
            </div>

            {{/* Actions */}}
            <div className="flex gap-4 justify-end pt-4 border-t border-app-border">
              <Button
                type="button"
                variant="outline"
                onClick={{() => router.back()}}
                disabled={{submitting}}
                className="h-11 px-6 rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={{submitting}}
                className="h-11 px-6 rounded-xl font-bold bg-app-primary hover:bg-app-primary text-app-foreground shadow-lg"
              >
                {{submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-app-foreground border-t-transparent mr-2" />
                    Creating...
                  </>
                ) : (
                  <>Create {route.title()}</>
                )}}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}}
"""

def create_page_file(module: str, route: str, page_type: str, content: str):
    """Create the page file"""
    if page_type == 'list':
        page_dir = FRONTEND_ROOT / module / route
        page_file = page_dir / "page.tsx"
    elif page_type == 'detail':
        page_dir = FRONTEND_ROOT / module / route / "[id]"
        page_file = page_dir / "page.tsx"
    elif page_type == 'create':
        page_dir = FRONTEND_ROOT / module / route / "new"
        page_file = page_dir / "page.tsx"

    # Create directory
    page_dir.mkdir(parents=True, exist_ok=True)

    # Write file
    page_file.write_text(content)
    print(f"✅ Created: {page_file.relative_to(FRONTEND_ROOT.parent.parent)}")

def generate_pages_for_route(module: str, route: str):
    """Generate all three pages for a route"""
    print(f"\n📄 Generating pages for /{module}/{route}/")

    # Parse Django model
    model_name = route.replace('-', '_').title().replace('_', '')
    model_info = parse_django_model(module, model_name)

    # Check what's missing
    list_page = FRONTEND_ROOT / module / route / "page.tsx"
    detail_page = FRONTEND_ROOT / module / route / "[id]" / "page.tsx"
    create_page = FRONTEND_ROOT / module / route / "new" / "page.tsx"

    # Generate missing pages
    if not list_page.exists():
        content = generate_list_page(module, route, model_info)
        create_page_file(module, route, 'list', content)
    else:
        print(f"⏭️  Skipped: {list_page.relative_to(FRONTEND_ROOT.parent.parent)} (already exists)")

    if not detail_page.exists():
        content = generate_detail_page(module, route, model_info)
        create_page_file(module, route, 'detail', content)
    else:
        print(f"⏭️  Skipped: {detail_page.relative_to(FRONTEND_ROOT.parent.parent)} (already exists)")

    if not create_page.exists():
        content = generate_create_page(module, route, model_info)
        create_page_file(module, route, 'create', content)
    else:
        print(f"⏭️  Skipped: {create_page.relative_to(FRONTEND_ROOT.parent.parent)} (already exists)")

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Generate CRUD pages')
    parser.add_argument('--all', action='store_true', help='Generate all missing pages')
    parser.add_argument('--module', type=str, help='Module name')
    parser.add_argument('--route', type=str, help='Route name')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be generated')

    args = parser.parse_args()

    # Load gap report
    if not GAP_REPORT.exists():
        print("❌ Gap report not found. Run audit script first.")
        return

    with open(GAP_REPORT) as f:
        gap_data = json.load(f)

    print("=" * 80)
    print("CRUD PAGE GENERATOR")
    print("=" * 80)
    print()

    if args.all:
        print("🚀 Generating ALL missing pages...")
        print()

        total_created = 0
        for module, routes in gap_data['backend_routes'].items():
            for route in routes:
                if not args.dry_run:
                    generate_pages_for_route(module, route)
                    total_created += 3
                else:
                    print(f"Would generate: /{module}/{route}/ (3 pages)")

        print()
        print("=" * 80)
        print(f"✅ COMPLETE: Generated {total_created} pages")
        print("=" * 80)

    elif args.module and args.route:
        generate_pages_for_route(args.module, args.route)

    else:
        parser.print_help()

if __name__ == "__main__":
    main()
