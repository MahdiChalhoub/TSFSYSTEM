// @ts-nocheck
'use client'

/**
 * Universal Document Viewer
 * ==========================
 * Supports: PDF, Images (JPG/PNG), External URLs
 * Features: Zoom, Pan, Rotate, Annotations (future)
 */

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ZoomIn, ZoomOut, RotateCw, Download,
  Maximize2, Minimize2, FileText, Image as ImageIcon,
  ExternalLink, Upload, X
} from 'lucide-react'
import { toast } from 'sonner'

interface DocumentViewerProps {
  documentUrl?: string | null
  documentType?: 'pdf' | 'image' | 'url' | 'none'
  title?: string
  onUpload?: (file: File) => void
  allowUpload?: boolean
  className?: string
}

export function DocumentViewer({
  documentUrl,
  documentType = 'none',
  title = 'Physical Document',
  onUpload,
  allowUpload = true,
  className = ''
}: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  const handleDownload = () => {
    if (documentUrl) {
      const a = document.createElement('a')
      a.href = documentUrl
      a.download = 'document.pdf'
      a.click()
      toast.success('Download started')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onUpload) {
      onUpload(file)
      toast.success('Document uploaded')
    }
  }

  // No document uploaded yet
  if (!documentUrl || documentType === 'none') {
    return (
      <Card className={`h-full flex flex-col ${className}`}>
        <CardHeader className="pb-3 border-b border-app-border/30">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText size={14} className="text-app-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-app-surface-2 flex items-center justify-center">
              <FileText size={40} className="text-app-muted-foreground opacity-30" />
            </div>
            <div>
              <p className="text-sm font-bold text-app-muted-foreground mb-1">No Document Attached</p>
              <p className="text-xs text-app-muted-foreground">Upload supplier invoice, delivery note, or scan</p>
            </div>
            {allowUpload && onUpload && (
              <div>
                <label htmlFor="doc-upload" className="cursor-pointer">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-app-primary text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all">
                    <Upload size={16} />
                    Upload Document
                  </div>
                </label>
                <input
                  id="doc-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <p className="text-xs text-app-muted-foreground mt-2">PDF, JPG, PNG supported</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      {/* Header with controls */}
      <CardHeader className="pb-3 border-b border-app-border/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            {documentType === 'pdf' && <FileText size={14} className="text-app-primary" />}
            {documentType === 'image' && <ImageIcon size={14} className="text-app-primary" />}
            {documentType === 'url' && <ExternalLink size={14} className="text-app-primary" />}
            {title}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              className="h-8 w-8 p-0"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </Button>
            <span className="text-xs font-bold text-app-muted-foreground min-w-[50px] text-center">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="h-8 w-8 p-0"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </Button>
            <div className="w-px h-4 bg-app-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotate}
              className="h-8 w-8 p-0"
              title="Rotate"
            >
              <RotateCw size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 w-8 p-0"
              title="Download"
            >
              <Download size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 p-0"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Viewer area */}
      <CardContent
        ref={containerRef}
        className={`flex-1 overflow-auto bg-app-bg/30 p-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-app-bg' : ''}`}
      >
        <div className="flex items-center justify-center min-h-full">
          {documentType === 'pdf' && (
            <div
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease'
              }}
            >
              <iframe
                src={documentUrl}
                className="w-full h-[800px] bg-white rounded-lg shadow-lg"
                title="PDF Viewer"
              />
            </div>
          )}

          {documentType === 'image' && (
            <img
              src={documentUrl}
              alt="Document"
              style={{
                maxWidth: '100%',
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease'
              }}
              className="rounded-lg shadow-lg"
            />
          )}

          {documentType === 'url' && (
            <div className="text-center space-y-4">
              <ExternalLink size={48} className="mx-auto text-app-primary opacity-50" />
              <div>
                <p className="text-sm font-bold text-app-foreground mb-2">External Document</p>
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-app-primary hover:underline flex items-center gap-1 justify-center"
                >
                  Open in new window
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>

        {isFullscreen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 h-10 w-10 p-0 bg-app-surface/90 hover:bg-app-surface"
          >
            <X size={20} />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
