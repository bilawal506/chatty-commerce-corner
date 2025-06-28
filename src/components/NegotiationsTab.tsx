import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Check, X, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Negotiation {
  id: string;
  original_price: number;
  proposed_price: number;
  status: string;
  message: string;
  created_at: string;
  buyer_id: string;
  product_id: string;
  product: {
    name: string;
    image_url: string;
  };
  buyer_profile?: {
    full_name: string;
  } | null;
}

const NegotiationsTab = () => {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchNegotiations();
    }
  }, [user]);

  const fetchNegotiations = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('negotiations')
      .select(`
        *,
        product:products(name, image_url)
      `)
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching negotiations:', error);
      toast.error('Failed to load negotiations');
      setLoading(false);
      return;
    }

    // Fetch buyer profiles separately
    const negotiationsWithProfiles = await Promise.all(
      (data || []).map(async (negotiation) => {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', negotiation.buyer_id)
          .single();

        if (profileError) {
          console.error('Error fetching buyer profile:', profileError);
        }

        return {
          ...negotiation,
          buyer_profile: profile,
        };
      })
    );

    setNegotiations(negotiationsWithProfiles);
    setLoading(false);
  };

  const handleNegotiationAction = async (negotiationId: string, action: 'accept' | 'reject') => {
    const negotiation = negotiations.find(n => n.id === negotiationId);
    if (!negotiation) return;

    const { error } = await supabase
      .from('negotiations')
      .update({ 
        status: action === 'accept' ? 'accepted' : 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', negotiationId);

    if (error) {
      console.error('Error updating negotiation:', error);
      toast.error('Failed to update negotiation');
      return;
    }

    // Create notification for the buyer
    const notificationTitle = action === 'accept' 
      ? 'Negotiation Accepted!' 
      : 'Negotiation Rejected';
    
    const notificationMessage = action === 'accept'
      ? `Great news! Your offer of $${negotiation.proposed_price} for ${negotiation.product.name} has been accepted! You can now add it to your cart at the negotiated price.`
      : `Your offer of $${negotiation.proposed_price} for ${negotiation.product.name} has been rejected. You can try making a new offer.`;

    // Insert a conversation message as notification
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('buyer_id', negotiation.buyer_id)
      .eq('product_id', negotiation.product_id)
      .single();

    if (conversation) {
      await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user!.id,
          message: notificationMessage,
          message_type: 'system',
          is_read: false,
        });
    } else {
      // Create a new conversation if none exists
      const { data: newConversation } = await supabase
        .from('conversations')
        .insert({
          buyer_id: negotiation.buyer_id,
          seller_id: user!.id,
          product_id: negotiation.product_id,
        })
        .select('id')
        .single();

      if (newConversation) {
        await supabase
          .from('conversation_messages')
          .insert({
            conversation_id: newConversation.id,
            sender_id: user!.id,
            message: notificationMessage,
            message_type: 'system',
            is_read: false,
          });
      }
    }

    toast.success(`Negotiation ${action}ed successfully! Buyer has been notified.`);
    fetchNegotiations();
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <DollarSign className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Price Negotiations</h2>
      </div>

      {negotiations.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <DollarSign className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No negotiations yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Negotiations will appear here when buyers make offers on your products
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {negotiations.map((negotiation) => (
            <Card key={negotiation.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <span>{negotiation.product.name}</span>
                    {getStatusBadge(negotiation.status)}
                  </CardTitle>
                  <span className="text-sm text-gray-500">
                    {new Date(negotiation.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Buyer</p>
                      <p className="text-sm">{negotiation.buyer_profile?.full_name || 'Anonymous'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Original Price</p>
                      <p className="text-lg font-semibold">${negotiation.original_price}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Proposed Price</p>
                      <p className="text-lg font-semibold text-blue-600">${negotiation.proposed_price}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {negotiation.message && (
                      <div>
                        <p className="text-sm font-medium text-gray-600">Message</p>
                        <p className="text-sm bg-gray-50 p-3 rounded">{negotiation.message}</p>
                      </div>
                    )}
                    
                    {negotiation.status === 'pending' && (
                      <div className="flex space-x-2 pt-2">
                        <Button
                          onClick={() => handleNegotiationAction(negotiation.id, 'accept')}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                        <Button
                          onClick={() => handleNegotiationAction(negotiation.id, 'reject')}
                          variant="outline"
                          className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NegotiationsTab;
