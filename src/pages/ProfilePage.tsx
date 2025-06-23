
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User, Package, MessageSquare, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_seller: boolean;
}

interface Order {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_items: Array<{
    product: {
      name: string;
      image_url: string;
    };
    quantity: number;
    price: number;
  }>;
}

interface Negotiation {
  id: string;
  original_price: number;
  proposed_price: number;
  status: string;
  message: string;
  created_at: string;
  product: {
    name: string;
    image_url: string;
  };
}

const ProfilePage = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchProfile();
    fetchOrders();
    fetchNegotiations();
  }, [user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    } else {
      setProfile(data);
    }
  };

  const fetchOrders = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          quantity,
          price,
          product:products(name, image_url)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const fetchNegotiations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('negotiations')
      .select(`
        *,
        product:products(name, image_url)
      `)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching negotiations:', error);
    } else {
      setNegotiations(data || []);
    }
  };

  const updateProfile = async () => {
    if (!user || !profile) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated successfully');
      setEditingProfile(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Account</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Orders</span>
            </TabsTrigger>
            <TabsTrigger value="negotiations" className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>Negotiations</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Profile Information</CardTitle>
                  <Button
                    variant="outline"
                    onClick={() => setEditingProfile(!editingProfile)}
                  >
                    {editingProfile ? 'Cancel' : 'Edit'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={profile.full_name || ''}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    disabled={!editingProfile}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile.email || ''}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    disabled={!editingProfile}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    disabled={!editingProfile}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Label>Account Type:</Label>
                  <Badge variant={profile.is_seller ? 'default' : 'secondary'}>
                    {profile.is_seller ? 'Seller' : 'Buyer'}
                  </Badge>
                </div>
                {editingProfile && (
                  <Button onClick={updateProfile}>
                    Save Changes
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No orders found</p>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <Card key={order.id} className="border">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                              <p className="text-sm text-gray-600">
                                {new Date(order.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant={
                                order.status === 'completed' ? 'default' :
                                order.status === 'pending' ? 'secondary' : 'destructive'
                              }>
                                {order.status}
                              </Badge>
                              <p className="font-bold mt-1">${order.total_amount.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {order.order_items.map((item, index) => (
                              <div key={index} className="flex items-center space-x-3">
                                <img
                                  src={item.product.image_url || '/placeholder-product.jpg'}
                                  alt={item.product.name}
                                  className="w-12 h-12 object-cover rounded"
                                />
                                <div className="flex-1">
                                  <p className="font-medium">{item.product.name}</p>
                                  <p className="text-sm text-gray-600">
                                    Qty: {item.quantity} × ${item.price}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="negotiations">
            <Card>
              <CardHeader>
                <CardTitle>Price Negotiations</CardTitle>
              </CardHeader>
              <CardContent>
                {negotiations.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No negotiations found</p>
                ) : (
                  <div className="space-y-4">
                    {negotiations.map((negotiation) => (
                      <Card key={negotiation.id} className="border">
                        <CardContent className="p-4">
                          <div className="flex items-start space-x-4">
                            <img
                              src={negotiation.product.image_url || '/placeholder-product.jpg'}
                              alt={negotiation.product.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                            <div className="flex-1">
                              <h4 className="font-semibold">{negotiation.product.name}</h4>
                              <div className="flex items-center space-x-4 mt-2">
                                <div>
                                  <p className="text-sm text-gray-600">Original Price</p>
                                  <p className="font-bold">${negotiation.original_price}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600">Your Offer</p>
                                  <p className="font-bold text-blue-600">${negotiation.proposed_price}</p>
                                </div>
                                <Badge variant={
                                  negotiation.status === 'accepted' ? 'default' :
                                  negotiation.status === 'pending' ? 'secondary' :
                                  negotiation.status === 'rejected' ? 'destructive' : 'outline'
                                }>
                                  {negotiation.status}
                                </Badge>
                              </div>
                              {negotiation.message && (
                                <p className="text-sm text-gray-600 mt-2">
                                  Message: {negotiation.message}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(negotiation.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Become a Seller</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Upgrade your account to start selling products on our platform.
                  </p>
                  <Button 
                    variant="outline" 
                    disabled={profile.is_seller}
                  >
                    {profile.is_seller ? 'Already a Seller' : 'Become a Seller'}
                  </Button>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Email Preferences</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Manage your email notification preferences.
                  </p>
                  <Button variant="outline">
                    Manage Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProfilePage;
