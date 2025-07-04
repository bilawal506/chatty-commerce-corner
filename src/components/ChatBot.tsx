
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Message {
  id: string;
  message: string;
  response?: string;
  created_at: string;
  isUser: boolean;
}

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && user) {
      loadChatHistory();
    }
  }, [isOpen, user]);

  const loadChatHistory = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      console.error('Error loading chat history:', error);
      return;
    }

    const formattedMessages: Message[] = [];
    data?.forEach((msg) => {
      formattedMessages.push({
        id: msg.id + '-user',
        message: msg.message,
        created_at: msg.created_at,
        isUser: true,
      });
      if (msg.response) {
        formattedMessages.push({
          id: msg.id + '-bot',
          message: msg.response,
          created_at: msg.created_at,
          isUser: false,
        });
      }
    });

    setMessages(formattedMessages);
  };

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setLoading(true);

    // Add user message to chat
    const userMsg: Message = {
      id: Date.now().toString(),
      message: userMessage,
      created_at: new Date().toISOString(),
      isUser: true,
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Call Gemini API through Edge Function
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: { message: userMessage }
      });

      if (error) {
        throw error;
      }

      const aiResponse = data.response;
      
      // Add AI response to chat
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        message: aiResponse,
        created_at: new Date().toISOString(),
        isUser: false,
      };
      setMessages(prev => [...prev, aiMsg]);

      // Save to database
      if (user) {
        await supabase.from('chat_messages').insert({
          user_id: user.id,
          message: userMessage,
          response: aiResponse,
          session_id: `session_${Date.now()}`,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      
      // Add error message
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        message: "I'm sorry, I'm having trouble connecting right now. Please try again later.",
        created_at: new Date().toISOString(),
        isUser: false,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
        size="lg"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-80 h-96 shadow-xl z-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg flex items-center space-x-2">
          <Bot className="h-5 w-5 text-blue-600" />
          <span>AI Assistant</span>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col h-80">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <Bot className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p>Hi! I'm your AI shopping assistant. How can I help you today?</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="flex items-start space-x-2">
                  {!msg.isUser && <Bot className="h-4 w-4 mt-0.5 text-blue-600" />}
                  <p className="text-sm">{msg.message}</p>
                  {msg.isUser && <User className="h-4 w-4 mt-0.5" />}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Bot className="h-4 w-4 text-blue-600" />
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex space-x-2">
          <Input
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !currentMessage.trim()}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatBot;
