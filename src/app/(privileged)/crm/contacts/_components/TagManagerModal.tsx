'use client'

/**
 * Tag Manager Modal
 * ====================
 * CRUD modal for CRM contact categories/tags, grouped by parent type.
 */

import { useState, useMemo } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import { X, Plus, Trash2, Tag } from 'lucide-react'
import { TYPES } from '../_lib/constants'

function TagRow({ tag, onDelete }: { tag: any; onDelete: (t: any) => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.375rem 0.5rem', borderRadius: 'calc(var(--app-radius, 12px) - 0.25rem)',
        background: 'var(--app-surface)',
        border: '1px solid var(--app-border)',
      }}
    >
      <div style={{
        width: '1rem', height: '1rem', borderRadius: '0.25rem',
        background: tag.color || '#6366F1', flexShrink: 0,
      }} />
      <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--app-foreground)' }}>
        {tag.name}
      </span>
      <button
        onClick={() => onDelete(tag)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--app-muted-foreground)', padding: '0.1875rem',
          borderRadius: '0.25rem', transition: 'color 0.1s',
        }}
        onMouseOver={e => e.currentTarget.style.color = 'var(--app-error)'}
        onMouseOut={e => e.currentTarget.style.color = 'var(--app-muted-foreground)'}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

export function TagManagerModal({ isOpen, onClose, initialTags }: {
  isOpen: boolean
  onClose: () => void
  initialTags: Record<string, any>[]
}) {
  const [managedTags, setManagedTags] = useState(initialTags)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366F1')
  const [newTagType, setNewTagType] = useState('')
  const [tagSaving, setTagSaving] = useState(false)

  const tagsByType = useMemo(() => {
    const groups: Record<string, any[]> = { '': [] }
    TYPES.filter(t => t.key !== 'ALL').forEach(t => { groups[t.key] = [] })
    managedTags.forEach((tag: any) => {
      const k = tag.contact_type || ''
      if (!groups[k]) groups[k] = []
      groups[k].push(tag)
    })
    return groups
  }, [managedTags])

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    setTagSaving(true)
    try {
      const body: any = { name: newTagName.trim(), color: newTagColor }
      if (newTagType) body.contact_type = newTagType
      const data = await erpFetch('/crm/contact-tags/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setManagedTags(prev => [...prev, data])
      setNewTagName(''); setNewTagColor('#6366F1'); setNewTagType('')
      toast.success(`Category "${data.name}" created`)
    } catch (e: any) {
      toast.error(`Failed: ${e.message || 'Unknown error'}`)
    } finally { setTagSaving(false) }
  }

  async function handleDeleteTag(tag: any) {
    if (!confirm(`Delete category "${tag.name}"?`)) return
    try {
      await erpFetch(`/crm/contact-tags/${tag.id}/`, { method: 'DELETE' })
      setManagedTags(prev => prev.filter((t: any) => t.id !== tag.id))
      toast.success(`Deleted "${tag.name}"`)
    } catch { toast.error('Failed to delete') }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="app-card"
        style={{
          width: '100%', maxWidth: '32rem', maxHeight: '85vh',
          borderRadius: 'var(--app-radius)', overflow: 'hidden',
          boxShadow: '0 16px 64px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--app-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--app-foreground)' }}>Contact Categories</h3>
            <p style={{ fontSize: '0.6875rem', color: 'var(--app-muted-foreground)', marginTop: '0.125rem' }}>
              Each parent type can have its own child categories
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--app-surface-2)', border: 'none', cursor: 'pointer',
            color: 'var(--app-muted-foreground)', padding: '0.375rem', borderRadius: '0.375rem',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Create new tag */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--app-border)', background: 'var(--app-bg)' }}>
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} title="Pick color"
              style={{ width: '2rem', height: '2rem', border: '2px solid var(--app-border)', borderRadius: '0.375rem', cursor: 'pointer', padding: 0 }} />
            <input type="text" placeholder="Category name..." value={newTagName} onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newTagName.trim() && handleCreateTag()}
              style={{
                flex: 1, height: '2rem', fontSize: '0.8125rem', fontWeight: 600,
                background: 'var(--app-surface)', color: 'var(--app-foreground)',
                border: '1px solid var(--app-border)', borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                padding: '0 0.625rem', outline: 'none', minWidth: '100px',
              }} />
            <select value={newTagType} onChange={e => setNewTagType(e.target.value)}
              style={{
                height: '2rem', fontSize: '0.6875rem', fontWeight: 600,
                background: 'var(--app-surface)', color: 'var(--app-foreground)',
                border: '1px solid var(--app-border)', borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                padding: '0 0.5rem', outline: 'none', appearance: 'none', WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.375rem center', paddingRight: '1.25rem',
              }}>
              <option value="">All Types</option>
              {TYPES.filter(t => t.key !== 'ALL').map(t => (
                <option key={t.key} value={t.key}>{t.shortLabel}</option>
              ))}
            </select>
            <button onClick={handleCreateTag} disabled={!newTagName.trim() || tagSaving}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.375rem 0.75rem', borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                fontSize: '0.6875rem', fontWeight: 700,
                background: 'var(--app-primary)', color: '#fff',
                border: 'none', cursor: newTagName.trim() ? 'pointer' : 'not-allowed',
                opacity: newTagName.trim() ? 1 : 0.5,
              }}>
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        {/* Tag list grouped by parent type */}
        <div style={{ overflowY: 'auto', maxHeight: '24rem' }}>
          {managedTags.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <Tag size={28} style={{ color: 'var(--app-muted-foreground)', margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.875rem', color: 'var(--app-muted-foreground)', fontWeight: 600 }}>No categories yet</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)', marginTop: '0.25rem' }}>
                Create your first category above — pick a name, color, and parent type
              </p>
            </div>
          ) : (
            <div style={{ padding: '0.5rem' }}>
              {tagsByType['']?.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ padding: '0.3125rem 0.5rem', fontSize: '0.5625rem', fontWeight: 700, color: 'var(--app-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ● Global (All Types)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1875rem' }}>
                    {tagsByType[''].map((tag: any) => (
                      <TagRow key={tag.id} tag={tag} onDelete={handleDeleteTag} />
                    ))}
                  </div>
                </div>
              )}
              {TYPES.filter(t => t.key !== 'ALL').map(typeCfg => {
                const tags = tagsByType[typeCfg.key] || []
                if (tags.length === 0) return null
                return (
                  <div key={typeCfg.key} style={{ marginBottom: '0.5rem' }}>
                    <div style={{
                      padding: '0.3125rem 0.5rem', fontSize: '0.5625rem', fontWeight: 700,
                      color: typeCfg.color, textTransform: 'uppercase', letterSpacing: '0.06em',
                      display: 'flex', alignItems: 'center', gap: '0.3125rem',
                    }}>
                      <typeCfg.icon size={10} />
                      {typeCfg.label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1875rem' }}>
                      {tags.map((tag: any) => (
                        <TagRow key={tag.id} tag={tag} onDelete={handleDeleteTag} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
