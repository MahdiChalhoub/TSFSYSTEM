'use client';
import React, { useState, useMemo } from 'react';
import {
 Plus, Shield, Trash2, Edit2, Save, X,
 CheckSquare, Square, ChevronRight, Lock,
 Search, Filter, Info, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
 Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
 createRole, updateRole, deleteRole
} from '@/app/actions/roles';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import {
 Dialog, DialogContent,
 DialogHeader, DialogTitle, DialogFooter,
 DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
interface Permission {
 id: number;
 code: string;
 name: string;
 description: string;
}
interface Role {
 id: number;
 name: string;
 description: string;
 permissions: number[];
}
export function RoleManager({ initialRoles, allPermissions }: { initialRoles: Role[], allPermissions: Permission[] }) {
 const [roles, setRoles] = useState<Role[]>(initialRoles);
 const [selectedRole, setSelectedRole] = useState<Role | null>(initialRoles[0] || null);
 const [searchQuery, setSearchQuery] = useState('');
 const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
 const [newRole, setNewRole] = useState({ name: '', description: '' });
 const [loading, setLoading] = useState(false);
 const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
 // Group permissions by module
 const groupedPermissions = useMemo(() => {
 const groups: Record<string, Permission[]> = {};
 allPermissions.forEach(p => {
 const module = p.code.split('.')[0] || 'core';
 if (!groups[module]) groups[module] = [];
 groups[module].push(p);
 });
 return groups;
 }, [allPermissions]);
 const handleTogglePermission = async (permId: number) => {
 if (!selectedRole) return;
 const isAssigned = selectedRole.permissions.includes(permId);
 const newPerms = isAssigned
 ? selectedRole.permissions.filter(id => id !== permId)
 : [...selectedRole.permissions, permId];
 try {
 const updated = await updateRole(selectedRole.id, { permissions: newPerms });
 setSelectedRole(updated);
 setRoles(prev => prev.map(r => r.id === updated.id ? updated : r));
 toast.success(`${isAssigned ? 'Removed' : 'Added'} permission`);
 } catch (error) {
 toast.error("Failed to update permission");
 }
 };
 const handleCreateRole = async () => {
 if (!newRole.name) return;
 setLoading(true);
 try {
 const created = await createRole(newRole);
 setRoles([...roles, created]);
 setSelectedRole(created);
 setIsCreateModalOpen(false);
 setNewRole({ name: '', description: '' });
 toast.success("Role created successfully");
 } catch (error) {
 toast.error("Failed to create role");
 } finally {
 setLoading(false);
 }
 };
 const handleDeleteRole = async () => {
 if (deleteTarget === null) return;
 try {
 await deleteRole(deleteTarget);
 setRoles(prev => prev.filter(r => r.id !== deleteTarget));
 if (selectedRole?.id === deleteTarget) setSelectedRole(roles.find(r => r.id !== deleteTarget) || null);
 toast.success("Role deleted");
 } catch (error) {
 toast.error("Failed to delete role");
 }
 setDeleteTarget(null);
 };
 return (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-280px)] min-h-[600px]">
 {/* Roles Selection Panel */}
 <div className="lg:col-span-4 flex flex-col gap-4">
 <div className="bg-app-surface rounded-[2rem] border border-app-border shadow-sm p-4 h-full flex flex-col">
 <div className="flex items-center justify-between mb-4 px-2">
 <h2 className="text-xs font-black uppercase text-app-muted-foreground tracking-widest">Roles List</h2>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setIsCreateModalOpen(true)}
 className="h-8 w-8 p-0 rounded-lg hover:bg-app-primary-light hover:text-app-primary"
 >
 <Plus size={18} />
 </Button>
 </div>
 <div className="relative mb-4 px-2">
 <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={14} />
 <Input
 placeholder="Find role..."
 className="pl-9 h-10 rounded-xl bg-app-background border-none text-xs font-medium"
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 />
 </div>
 <ScrollArea className="flex-1">
 <div className="space-y-1 px-2">
 {roles.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(role => (
 <div
 key={role.id}
 onClick={() => setSelectedRole(role)}
 className={cn(
 "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all",
 selectedRole?.id === role.id
 ? "bg-app-surface text-app-foreground shadow-lg shadow-app-border/20"
 : "hover:bg-app-background text-app-muted-foreground"
 )}
 >
 <div className="flex items-center gap-3">
 <div className={cn(
 "w-8 h-8 rounded-lg flex items-center justify-center",
 selectedRole?.id === role.id ? "bg-app-foreground/20" : "bg-app-surface-2"
 )}>
 <Shield size={16} className={selectedRole?.id === role.id ? "text-app-foreground" : "text-app-muted-foreground"} />
 </div>
 <div>
 <p className="text-sm font-black tracking-tight">{role.name}</p>
 <p className={cn(
 "text-[10px] font-bold uppercase",
 selectedRole?.id === role.id ? "text-app-muted-foreground" : "text-app-muted-foreground"
 )}>
 {role.permissions?.length || 0} permissions
 </p>
 </div>
 </div>
 {selectedRole?.id !== role.id && role.name !== 'Admin' && (
 <button
 onClick={(e) => { e.stopPropagation(); setDeleteTarget(role.id); }}
 className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-app-error transition-all"
 >
 <Trash2 size={14} />
 </button>
 )}
 </div>
 ))}
 </div>
 </ScrollArea>
 </div>
 </div>
 {/* Permission Matrix Panel */}
 <div className="lg:col-span-8 h-full">
 {selectedRole ? (
 <div className="bg-app-surface rounded-[2rem] border border-app-border shadow-sm flex flex-col h-full overflow-hidden">
 <div className="p-6 border-b border-app-border flex items-center justify-between bg-app-surface-2/30">
 <div>
 <Badge variant="outline" className="mb-2 rounded-lg text-[10px] font-black uppercase text-app-primary border-app-success/30 bg-app-primary-light/50">
 Editing Permissions
 </Badge>
 <h1 className="text-2xl font-black text-app-foreground uppercase tracking-tighter">{selectedRole.name}</h1>
 <p className="text-xs text-app-muted-foreground font-medium italic mt-0.5">{selectedRole.description || 'No description provided'}</p>
 </div>
 <div className="text-right flex flex-col items-end gap-1">
 <div className="p-2 bg-app-primary-light/50 rounded-xl text-app-success">
 <ShieldCheck size={20} />
 </div>
 <span className="text-[10px] font-black uppercase text-app-muted-foreground tracking-tighter">Authorized Scope</span>
 </div>
 </div>
 <ScrollArea className="flex-1 p-6">
 <div className="space-y-8">
 {Object.entries(groupedPermissions).map(([module, perms]) => (
 <div key={module} className="space-y-4">
 <div className="flex items-center gap-4">
 <h3 className="text-[10px] font-black uppercase text-app-muted-foreground tracking-widest bg-app-surface-2 px-3 py-1 rounded-full">{module}</h3>
 <div className="h-px bg-app-surface-2 flex-1"></div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {perms.map(perm => {
 const isActive = selectedRole.permissions.includes(perm.id);
 return (
 <div
 key={perm.id}
 onClick={() => handleTogglePermission(perm.id)}
 className={cn(
 "p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 group",
 isActive
 ? "border-app-primary/20 bg-app-primary-light/30 ring-2 ring-app-primary/5"
 : "border-app-border bg-app-surface hover:border-app-border"
 )}
 >
 <div className="min-w-0">
 <p className={cn("text-xs font-black uppercase tracking-tight mb-1", isActive ? "text-app-success" : "text-app-foreground")}>
 {perm.name}
 </p>
 <p className="text-[10px] text-app-muted-foreground leading-tight font-medium">
 {perm.description || `Grants access to ${perm.code} features.`}
 </p>
 </div>
 <div className={cn(
 "w-5 h-5 rounded-lg flex items-center justify-center transition-all",
 isActive ? "bg-app-primary text-app-foreground" : "bg-app-surface-2 text-app-muted-foreground group-hover:bg-app-border"
 )}>
 {isActive ? <CheckSquare size={14} /> : <Square size={14} />}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 </div>
 ) : (
 <div className="bg-app-surface rounded-[2rem] border border-app-border shadow-sm flex flex-col items-center justify-center p-12 text-center h-full">
 <div className="w-20 h-20 bg-app-background rounded-full flex items-center justify-center mb-6">
 <ShieldAlert className="text-app-foreground" size={40} />
 </div>
 <h2 className="text-xl font-black text-app-muted-foreground uppercase tracking-tighter">No Role Selected</h2>
 <p className="text-sm text-app-muted-foreground font-bold uppercase tracking-widest mt-1">Select a role from the list to manage its permissions</p>
 </div>
 )}
 </div>
 {/* Create Role Modal */}
 <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
 <DialogContent className="max-w-md bg-app-surface rounded-[2rem] p-8 border-none shadow-2xl">
 <DialogHeader>
 <DialogTitle className="text-2xl font-black text-app-foreground uppercase tracking-tighter">New Policy Role</DialogTitle>
 <DialogDescription className="text-xs font-bold uppercase text-app-muted-foreground tracking-widest">Define a new set of access rules</DialogDescription>
 </DialogHeader>
 <div className="space-y-6 pt-4">
 <div className="space-y-2">
 <Label className="text-[10px] font-black uppercase text-app-muted-foreground px-1 tracking-widest">Role Name</Label>
 <Input
 placeholder="e.g. Inventory Manager"
 value={newRole.name}
 onChange={e => setNewRole({ ...newRole, name: e.target.value })}
 className="h-14 rounded-2xl border-app-border bg-app-background focus:bg-app-surface focus:border-app-primary/50 focus:ring-4 focus:ring-app-primary/10 transition-all font-bold"
 />
 </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-black uppercase text-app-muted-foreground px-1 tracking-widest">Description</Label>
 <Input
 placeholder="What can this role do?"
 value={newRole.description}
 onChange={e => setNewRole({ ...newRole, description: e.target.value })}
 className="h-14 rounded-2xl border-app-border bg-app-background focus:bg-app-surface focus:border-app-primary/50 focus:ring-4 focus:ring-app-primary/10 transition-all font-medium"
 />
 </div>
 <div className="flex gap-3 pt-2">
 <Button
 variant="outline"
 onClick={() => setIsCreateModalOpen(false)}
 className="flex-1 h-14 rounded-2xl border-app-border text-[10px] font-black uppercase tracking-widest"
 >
 Cancel
 </Button>
 <Button
 onClick={handleCreateRole}
 disabled={loading || !newRole.name}
 className="flex-1 h-14 rounded-2xl bg-app-surface text-app-foreground text-[10px] font-black uppercase tracking-widest"
 >
 {loading ? "Creating..." : "Create Role"}
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 <ConfirmDialog
 open={deleteTarget !== null}
 onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
 onConfirm={handleDeleteRole}
 title="Delete Role?"
 description="This will permanently remove this role. Users assigned to it may lose their permissions."
 confirmText="Delete"
 variant="danger"
 />
 </div>
 );
}
