/**
 * Responsive List Component
 *
 * Automatically transforms between:
 * - Mobile: Card list (vertical stack)
 * - Tablet+: Table view (horizontal scroll if needed)
 *
 * Usage:
 * <ResponsiveList data={users} columns={columnDefs} />
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Column<T> {
  key: keyof T
  label: string
  render?: (item: T) => React.ReactNode
}

interface ResponsiveListProps<T> {
  data: T[]
  columns: Column<T>[]
  getRowId: (item: T) => string | number
  renderMobileCard?: (item: T) => React.ReactNode
  onView?: (item: T) => void
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
}

export function ResponsiveList<T extends Record<string, any>>({
  data,
  columns,
  getRowId,
  renderMobileCard,
  onView,
  onEdit,
  onDelete,
}: ResponsiveListProps<T>) {
  return (
    <>
      {/* MOBILE VIEW: Cards */}
      <div className="md:hidden space-y-4">
        {data.map((item) => (
          renderMobileCard ? (
            // Custom mobile card if provided
            <div key={getRowId(item)}>{renderMobileCard(item)}</div>
          ) : (
            // Default mobile card
            <Card key={getRowId(item)} className="layout-card-radius border-0 shadow-sm theme-surface">
              <CardContent className="layout-card-padding">
                {/* Main content */}
                <div className="space-y-3">
                  {columns.slice(0, 3).map((column) => (
                    <div key={String(column.key)}>
                      <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">
                        {column.label}
                      </p>
                      <div className="text-app-foreground">
                        {column.render ? column.render(item) : item[column.key]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions (if provided) */}
                {(onView || onEdit || onDelete) && (
                  <div className="flex gap-2 mt-4 pt-4 border-t theme-border">
                    {onView && (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => onView(item)}>
                        View
                      </Button>
                    )}
                    {onEdit && (
                      <Button size="sm" className="flex-1" onClick={() => onEdit(item)}>
                        Edit
                      </Button>
                    )}
                    {onDelete && (
                      <Button size="sm" variant="destructive" onClick={() => onDelete(item)}>
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        ))}
      </div>

      {/* TABLET+ VIEW: Table */}
      <div className="hidden md:block overflow-x-auto layout-card-radius border-0 shadow-sm theme-surface">
        <Table>
          <TableHeader>
            <TableRow className="theme-border">
              {columns.map((column) => (
                <TableHead key={String(column.key)} className="text-app-foreground font-bold">
                  {column.label}
                </TableHead>
              ))}
              {(onView || onEdit || onDelete) && (
                <TableHead className="text-app-foreground font-bold">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={getRowId(item)} className="theme-border hover:bg-[var(--theme-surface-hover)]">
                {columns.map((column) => (
                  <TableCell key={String(column.key)} className="text-app-foreground">
                    {column.render ? column.render(item) : item[column.key]}
                  </TableCell>
                ))}
                {(onView || onEdit || onDelete) && (
                  <TableCell>
                    <div className="flex gap-2">
                      {onView && (
                        <Button size="sm" variant="ghost" onClick={() => onView(item)}>
                          View
                        </Button>
                      )}
                      {onEdit && (
                        <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                          Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button size="sm" variant="destructive" onClick={() => onDelete(item)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

// Example Usage:
export function ExampleUsage() {
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active', role: 'Admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Pending', role: 'User' },
  ]

  const columns = [
    { key: 'name' as const, label: 'Name' },
    { key: 'email' as const, label: 'Email' },
    {
      key: 'status' as const,
      label: 'Status',
      render: (user: any) => (
        <Badge className={user.status === 'Active' ? 'bg-green-500' : 'bg-yellow-500'}>
          {user.status}
        </Badge>
      ),
    },
    { key: 'role' as const, label: 'Role' },
  ]

  return (
    <ResponsiveList
      data={users}
      columns={columns}
      getRowId={(user) => user.id}
      onView={(user) => console.log('View', user)}
      onEdit={(user) => console.log('Edit', user)}
      onDelete={(user) => console.log('Delete', user)}
    />
  )
}
