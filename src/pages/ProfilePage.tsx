import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User, Settings, Package, MessageSquare, ShoppingBag, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import AddProductForm from '@/components/AddProductForm';
import NegotiationsTab from '@/components/NegotiationsTab';
import SellerProductsTab from '@/components/SellerProductsTab';
import type { Json } from '@/integrations/supabase/types';

interface AddressType {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_seller: boolean;
  address: AddressType | null;
}

const ProfilePage = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSeller, setIsSeller] = useState(false);
  const [address, setAddress] = useState<AddressType>({
    street: '',
    city: '',
    state: '',
    zip: '',
  });
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const parseAddress = (addressJson: Json | null): AddressType => {
    if (!addressJson || typeof addressJson !== 'object' || Array.isArray(addressJson)) {
      return { street: '', city: '', state: '', zip: '' };
    }
    
    const addr = addressJson as Record<string, unknown>;
    return {
      street: typeof addr.street === 'string' ? addr.street : '',
      city: typeof addr.city === 'string' ? addr.city : '',
      state: typeof addr.state === 'string' ? addr.state : '',
      zip: typeof addr.zip === 'string' ? addr.zip : '',
    };
  };

  const fetchProfile = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } else if (data) {
      const parsedAddress = parseAddress(data.address);
      const profileData: Profile = {
        id: data.id,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        is_seller: data.is_seller || false,
        address: parsedAddress,
      };
      
      setProfile(profileData);
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
      setIsSeller(data.is_seller || false);
      setAddress(parsedAddress);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    
    try {
      // First, check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const profileData = {
        user_id: user.id,
        full_name: fullName,
        email: user.email,
        phone: phone,
        is_seller: isSeller,
        address: address as Json,
        updated_at: new Date().toISOString(),
      };

      let error;

      if (existingProfile) {
        // Update existing profile
        const result = await supabase
          .from('profiles')
          .update(profileData)
          .eq('user_id', user.id);
        error = result.error;
      } else {
        // Insert new profile
        const result = await supabase
          .from('profiles')
          .insert({
            ...profileData,
            created_at: new Date().toISOString(),
          });
        error = result.error;
      }

      if (error) {
        console.error('Error saving profile:', error);
        toast.error('Failed to save profile');
      } else {
        toast.success('Profile updated successfully!');
        fetchProfile();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    }
    
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Navigation Cards */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Quick Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link to="/chats">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    My Chats
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link to="/cart">
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    My Cart
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link to="/">
                    <Package className="h-4 w-4 mr-2" />
                    Browse Products
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Account</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleSignOut}
                  variant="outline" 
                  className="w-full"
                >
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="seller-mode"
                    checked={isSeller}
                    onCheckedChange={setIsSeller}
                  />
                  <Label htmlFor="seller-mode">
                    {isSeller ? 'Seller Account' : 'Buyer Account'}
                  </Label>
                </div>
                <p className="text-sm text-gray-600">
                  {isSeller 
                    ? 'You can sell products and receive messages from buyers.'
                    : 'Switch to seller mode to start selling your products.'
                  }
                </p>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Address Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="street">Street Address</Label>
                      <Input
                        id="street"
                        value={address.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        placeholder="Enter street address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        placeholder="Enter city"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={address.state}
                        onChange={(e) => setAddress({ ...address, state: e.target.value })}
                        placeholder="Enter state"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP Code</Label>
                      <Input
                        id="zip"
                        value={address.zip}
                        onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                        placeholder="Enter ZIP code"
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>

            {/* Seller-only Sections */}
            {isSeller && (
              <Tabs defaultValue="add-product" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="add-product" className="flex items-center space-x-2">
                    <Package className="h-4 w-4" />
                    <span>Add Product</span>
                  </TabsTrigger>
                  <TabsTrigger value="my-products" className="flex items-center space-x-2">
                    <Package className="h-4 w-4" />
                    <span>My Products</span>
                  </TabsTrigger>
                  <TabsTrigger value="negotiations" className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Negotiations</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="add-product">
                  <AddProductForm />
                </TabsContent>
                
                <TabsContent value="my-products">
                  <SellerProductsTab />
                </TabsContent>
                
                <TabsContent value="negotiations">
                  <NegotiationsTab />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
