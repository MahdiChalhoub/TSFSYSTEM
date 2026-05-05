'use client';

import React, { useEffect, useState } from 'react';
import { AppNotification } from "@/types/erp";
import { Bell, Check, Trash2, Clock, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsRead
} from '@/app/actions/auth';
import { formatDistanceToNow } from 'date-fns';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuHeader,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function NotificationBell() {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = async () => {
        try {
            const data = await getNotifications();
            setNotifications(data);
            setUnreadCount(data.filter((n: AppNotification) => !n.read_at).length);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every 30 seconds for new notifications
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleMarkRead = async (id: number) => {
        try {
            await markNotificationAsRead(id);
            fetchNotifications();
        } catch (error) {
            toast.error('Failed to mark as read');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();
            fetchNotifications();
            toast.success('All marked as read');
        } catch (error) {
            toast.error('Failed to mark all as read');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'SUCCESS': return <CheckCircle className="text-app-success" size={16} />;
            case 'WARNING': return <AlertTriangle className="text-app-warning" size={16} />;
            case 'ERROR': return <XCircle className="text-app-error" size={16} />;
            default: return <Info className="text-app-info" size={16} />;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button suppressHydrationWarning className="p-2.5 relative hover:bg-gray-100/50 rounded-xl text-app-muted-foreground hover:text-app-success transition-colors outline-none">
                    <Bell size={22} />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2.5 w-4 h-4 bg-app-error text-white text-[10px] font-black flex items-center justify-center rounded-full ring-2 ring-white animate-in zoom-in-50 duration-300">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] p-0 shadow-2xl border-app-border rounded-2xl overflow-hidden">
                <div className="bg-gray-50/80 p-4 border-b border-app-border flex items-center justify-between">
                    <div>
                        <h3 className="uppercase">Notifications</h3>
                        <p className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-tight">You have {unreadCount} unread alerts</p>
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllRead}
                            className="h-8 text-[10px] font-black uppercase text-app-success hover:text-app-success hover:bg-app-success-soft rounded-lg"
                        >
                            Mark all read
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                <Bell className="text-app-muted-foreground" size={24} />
                            </div>
                            <p className="text-sm font-bold text-app-muted-foreground">All caught up!</p>
                            <p className="text-[10px] text-app-muted-foreground uppercase font-black">No new notifications</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-app-border">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={cn(
                                        "p-4 hover:bg-gray-50 transition-colors group relative cursor-pointer",
                                        !notif.read_at && "bg-app-success-soft/30"
                                    )}
                                    onClick={() => !notif.read_at && handleMarkRead(notif.id)}
                                >
                                    <div className="flex gap-3">
                                        <div className="mt-0.5 shrink-0">
                                            {getIcon(notif.type ?? 'info')}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <p className={cn(
                                                    "text-sm font-bold truncate",
                                                    !notif.read_at ? "text-app-foreground" : "text-app-muted-foreground"
                                                )}>
                                                    {notif.title}
                                                </p>
                                                <span className="text-[10px] font-bold text-app-muted-foreground whitespace-nowrap">
                                                    {notif.created_at ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }) : ''}
                                                </span>
                                            </div>
                                            <p className="text-xs text-app-muted-foreground line-clamp-2 leading-relaxed">
                                                {notif.message}
                                            </p>
                                        </div>
                                    </div>
                                    {!notif.read_at && (
                                        <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-2 h-2 bg-app-success rounded-full"></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-3 bg-gray-50 border-t border-app-border text-center">
                    <Button variant="link" className="text-[10px] font-black uppercase text-app-muted-foreground hover:text-app-success h-auto p-0">
                        View all activity
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
