
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ChatInterface from './ChatInterface';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  last_message_at: string;
  product: {
    name: string;
  } | null;
  other_user: {
    id: string;
    full_name: string;
    email: string;
  };
  unread_count: number;
}

const ChatsPage = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchConversations();
      
      // Set up real-time subscription for new conversations
      const channel = supabase
        .channel('conversations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations'
          },
          () => {
            fetchConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        product:products(name)
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } else {
      // Enhanced user fetching with profile information
      const conversationsWithUsers = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUserId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', otherUserId)
            .single();

          // Fallback to stored names in conversation if profile doesn't exist
          let userName = 'Unknown User';
          if (profile?.full_name) {
            userName = profile.full_name;
          } else if (conv.buyer_id === user.id && conv.seller_name) {
            userName = conv.seller_name;
          } else if (conv.seller_id === user.id && conv.buyer_name) {
            userName = conv.buyer_name;
          }

          return {
            ...conv,
            other_user: {
              id: otherUserId,
              full_name: userName,
              email: profile?.email || ''
            },
            unread_count: 0 // TODO: Implement unread count
          };
        })
      );
      
      setConversations(conversationsWithUsers);
    }
    setLoading(false);
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Messages</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Conversations List */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Conversations</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-600">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>No conversations yet</p>
                    <p className="text-sm">Start chatting with sellers or buyers!</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        onClick={() => setSelectedConversation(conversation.id)}
                        className={`w-full p-4 text-left hover:bg-gray-50 border-b transition-colors ${
                          selectedConversation === conversation.id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <Avatar>
                            <AvatarFallback>
                              {conversation.other_user.full_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900 truncate">
                                {conversation.other_user.full_name}
                              </p>
                              {conversation.unread_count > 0 && (
                                <Badge variant="default" className="ml-2">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                            </div>
                            {conversation.product && (
                              <p className="text-sm text-gray-600 truncate">
                                About: {conversation.product.name}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              {new Date(conversation.last_message_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            {selectedConv ? (
              <ChatInterface
                conversationId={selectedConv.id}
                otherUserId={selectedConv.other_user.id}
                otherUserName={selectedConv.other_user.full_name}
                productName={selectedConv.product?.name}
                onBack={() => setSelectedConversation(null)}
              />
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center">
                  <User className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a conversation
                  </h3>
                  <p className="text-gray-600">
                    Choose a conversation from the list to start chatting
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatsPage;
