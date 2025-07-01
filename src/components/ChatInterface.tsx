import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, ArrowLeft, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Message {
  id: string;
  message: string;
  sender_id: string;
  created_at: string;
  sender_name?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  otherUserId: string;
  otherUserName: string;
  productName?: string;
  onBack: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  conversationId,
  otherUserId,
  otherUserName,
  productName,
  onBack
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProductMentions, setShowProductMentions] = useState(false);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchMessages();
    fetchSellerProducts();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('conversation-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } else {
      setMessages(data || []);
    }
  };

  const fetchSellerProducts = async () => {
    // Fetch products belonging to the other user (seller)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, image_url')
      .eq('seller_id', otherUserId)
      .limit(10);

    if (error) {
      console.error('Error fetching seller products:', error);
    } else {
      setSellerProducts(data || []);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setLoading(true);
    const { error } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message: newMessage.trim()
      });

    if (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } else {
      setNewMessage('');
      setShowProductMentions(false);
    }
    setLoading(false);
  };

  const mentionProduct = (product: Product) => {
    const productMention = `[Product: ${product.name} - $${product.price}]`;
    setNewMessage(prev => prev + productMention);
    setShowProductMentions(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar>
              <AvatarFallback>{otherUserName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{otherUserName}</CardTitle>
              {productName && (
                <p className="text-sm text-gray-600">About: {productName}</p>
              )}
            </div>
          </div>
          {sellerProducts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProductMentions(!showProductMentions)}
            >
              <Package className="h-4 w-4 mr-2" />
              Mention Product
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {showProductMentions && sellerProducts.length > 0 && (
          <div className="border-b p-4 bg-gray-50">
            <h4 className="text-sm font-medium mb-2">Mention a product from {otherUserName}:</h4>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
              {sellerProducts.map((product) => (
                <Button
                  key={product.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => mentionProduct(product)}
                  className="justify-start text-left h-auto p-2"
                >
                  <div className="flex items-center space-x-2">
                    <img
                      src={product.image_url || '/placeholder-product.jpg'}
                      alt={product.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-gray-500">${product.price}</p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => {
            // Parse product mentions in messages
            const messageText = message.message.replace(
              /\[Product: (.+?) - \$(.+?)\]/g,
              '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 mx-1">📦 $1 - $$2</span>'
            );

            return (
              <div
                key={message.id}
                className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    message.sender_id === user?.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div 
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: messageText }}
                  />
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatInterface;
