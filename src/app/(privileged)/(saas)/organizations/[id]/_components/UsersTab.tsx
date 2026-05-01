'use client'

import { Plus, KeyRound } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SaasUser } from '@/types/erp'

interface UsersTabProps {
    users: SaasUser[]
    onCreateUser: () => void
    onResetPassword: (user: Record<string, unknown>) => void
}

export function UsersTab({ users, onCreateUser, onResetPassword }: UsersTabProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-app-foreground">Organization Users</h3>
                    <p className="text-sm text-app-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''} in this organization</p>
                </div>
                <Button onClick={onCreateUser} className="bg-app-primary-dark hover:bg-app-primary-dark text-white rounded-xl font-bold shadow-md">
                    <Plus size={16} className="mr-2" /> Create User
                </Button>
            </div>

            {users.length === 0 ? (
                <Card className="border-app-border shadow-sm">
                    <CardContent className="py-12 text-center text-app-muted-foreground italic">No users found for this organization.</CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {users.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-4 bg-app-surface rounded-2xl border border-app-border hover:border-app-border shadow-sm transition-all">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${user.is_superuser
                                    ? 'bg-app-accent-bg text-app-accent border border-app-accent'
                                    : 'bg-app-surface text-app-muted-foreground border border-app-border'
                                    }`}>
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-app-foreground text-sm">{user.username}</span>
                                        {user.is_superuser && (
                                            <Badge className="bg-app-accent-bg text-app-accent border-app-accent text-[9px] font-black">SUPER</Badge>
                                        )}
                                        {user.is_staff && !user.is_superuser && (
                                            <Badge className="bg-app-info-bg text-app-info border-app-info text-[9px] font-black">STAFF</Badge>
                                        )}
                                        {!user.is_active && (
                                            <Badge className="bg-app-error-bg text-app-error border-app-error text-[9px]">Inactive</Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-app-muted-foreground">{user.email || 'No email'} {user.role ? `· ${user.role}` : ''}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-app-muted-foreground">
                                    {user.date_joined ? new Date(user.date_joined).toLocaleDateString() : ''}
                                </span>
                                <Button variant="outline" size="sm" onClick={() => onResetPassword(user as unknown as Record<string, unknown>)}
                                    className="rounded-xl border-app-border text-app-muted-foreground hover:text-app-foreground text-xs font-bold">
                                    <KeyRound size={12} className="mr-1" /> Reset
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
