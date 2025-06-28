
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: 'message' | 'negotiation' | 'order';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedId?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  fetchNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      // Fetch unread messages (including system messages for negotiations)
      const { data: messages } = await supabase
        .from('conversation_messages')
        .select(`
          *,
          conversation:conversations(
            product:products(name),
            buyer_id,
            seller_id
          )
        `)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      // Fetch pending negotiations (only for sellers)
      const { data: negotiations } = await supabase
        .from('negotiations')
        .select(`
          *,
          product:products(name)
        `)
        .eq('status', 'pending')
        .eq('seller_id', user.id);

      const notificationList: Notification[] = [];

      // Process messages
      messages?.forEach((msg: any) => {
        const isBuyer = msg.conversation.buyer_id === user.id;
        const isSeller = msg.conversation.seller_id === user.id;
        
        if (isBuyer || isSeller) {
          const isSystemMessage = msg.message_type === 'system';
          const title = isSystemMessage ? 'Negotiation Update' : 'New Message';
          
          notificationList.push({
            id: `msg-${msg.id}`,
            type: isSystemMessage ? 'negotiation' : 'message',
            title,
            message: isSystemMessage ? msg.message : `New message about ${msg.conversation.product?.name || 'a product'}`,
            isRead: msg.is_read,
            createdAt: msg.created_at,
            relatedId: msg.conversation_id,
          });
        }
      });

      // Process negotiations (for sellers)
      negotiations?.forEach((neg: any) => {
        notificationList.push({
          id: `neg-${neg.id}`,
          type: 'negotiation',
          title: 'New Price Negotiation',
          message: `New offer for ${neg.product?.name}: $${neg.proposed_price}`,
          isRead: false,
          createdAt: neg.created_at,
          relatedId: neg.id,
        });
      });

      // Sort by creation date
      notificationList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setNotifications(notificationList);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    if (id.startsWith('msg-')) {
      const messageId = id.replace('msg-', '');
      await supabase
        .from('conversation_messages')
        .update({ is_read: true })
        .eq('id', messageId);
    }
    
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from('conversation_messages')
      .update({ is_read: true })
      .neq('sender_id', user.id);

    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    );
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up real-time listeners
      const messageChannel = supabase
        .channel('message-notifications')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'conversation_messages' },
          () => fetchNotifications()
        )
        .subscribe();

      const negotiationChannel = supabase
        .channel('negotiation-notifications')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'negotiations' },
          () => fetchNotifications()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messageChannel);
        supabase.removeChannel(negotiationChannel);
      };
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};
