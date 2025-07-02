import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, ArrowLeft, Package, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ensureUserProfile, getUserDisplayName } from '@/utils/profileUtils';

interface Message {
  id: string;
  message: string;
  sender_id: string;
  created_at: string;
  sender_name?: string;
  message_type?: string;
  product_data?: any;
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
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (user) {
      ensureUserProfile(user.id, user.email);
    }
    scrollToBottom();
  }, [messages, user]);

  useEffect(() => {
    fetchMessages();
    fetchSellerProducts();
    
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
        async (payload) => {
          const newMsg = payload.new as Message;
          newMsg.sender_name = await getUserDisplayName(newMsg.sender_id);
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
      const messagesWithNames = await Promise.all(
        (data || []).map(async (msg) => ({
          ...msg,
          sender_name: await getUserDisplayName(msg.sender_id)
        }))
      );
      setMessages(messagesWithNames);
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
    const senderName = await getUserDisplayName(user.id);

    try {
      const { error } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          message: newMessage.trim(),
          sender_name: senderName
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }

    setLoading(false);
  };

  const mentionProduct = async (product: Product) => {
    if (!user) return;

    setLoading(true);
    
    // Get user's full name for the message
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    const senderName = profile?.full_name || 'User';
    
    // Store product data as a JSON string in the message field
    const productMessage = {
      type: 'product_mention',
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url
      }
    };

    const { error } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message: JSON.stringify(productMessage),
        message_type: 'product_mention',
        sender_name: senderName
      });

    if (error) {
      console.error('Error mentioning product:', error);
      toast.error('Failed to mention product');
    } else {
      setShowProductMentions(false);
      toast.success('Product mentioned!');
    }
    setLoading(false);
  };

  const handleProductClick = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const parseProductMessage = (message: string) => {
    try {
      return JSON.parse(message);
    } catch {
      return null;
    }
  };

  const renderMessage = (message: Message) => {
    if (message.message_type === 'product_mention') {
      const productData = parseProductMessage(message.message);
      
      if (productData && productData.type === 'product_mention' && productData.product) {
        return (
          <div
            key={message.id}
            className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'} mb-4`}
          >
            <Card className={`max-w-[70%] ${message.sender_id === user?.id ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Package className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Product Mention</span>
                  <span className="text-xs text-gray-500">
                    by {message.sender_name || 'User'}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <img
                    src={productData.product.image_url || '/placeholder-product.jpg'}
                    alt={productData.product.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{productData.product.name}</h4>
                    <p className="text-lg font-bold text-blue-600">${productData.product.price}</p>
                    <Button
                      onClick={() => handleProductClick(productData.product.id)}
                      size="sm"
                      className="mt-2"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Product
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(message.created_at).toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>
          </div>
        );
      }
    }

    return (
      <div
        key={message.id}
        className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`max-w-[70%] p-3 rounded-lg ${
            message.sender_id === user?.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          <div className="text-sm">{message.message}</div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs opacity-70">
              {message.sender_name || 'User'}
            </p>
            <p className="text-xs opacity-70">
              {new Date(message.created_at).toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    );
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
                  disabled={loading}
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

        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map(renderMessage)
          )}
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
