
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingCart, Star, MessageSquare, DollarSign, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  stock_quantity: number;
  seller_id: string;
}

const ProductPage = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [proposedPrice, setProposedPrice] = useState('');
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [submittingNegotiation, setSubmittingNegotiation] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    if (!id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching product:', error);
      toast.error('Failed to load product');
    } else {
      console.log('Fetched product:', data);
      setProduct(data);
      setProposedPrice(data.price.toString());
    }
    setLoading(false);
  };

  const handleAddToCart = async () => {
    if (!product) return;
    await addToCart(product.id, quantity);
  };

  const handleContactSeller = async () => {
    if (!product || !user) {
      toast.error('Please sign in to contact seller');
      return;
    }

    if (!product.seller_id) {
      toast.error('This product does not have a seller assigned. Please contact support.');
      return;
    }

    if (user.id === product.seller_id) {
      toast.error("You can't contact yourself!");
      return;
    }

    try {
      console.log('Creating conversation with seller_id:', product.seller_id);
      
      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('seller_id', product.seller_id)
        .eq('product_id', product.id)
        .single();

      if (existingConv) {
        // Redirect to existing conversation
        window.location.href = '/chats';
        return;
      }

      // Create new conversation
      const { error } = await supabase
        .from('conversations')
        .insert({
          buyer_id: user.id,
          seller_id: product.seller_id,
          product_id: product.id,
        });

      if (error) {
        console.error('Error creating conversation:', error);
        toast.error('Failed to start conversation');
      } else {
        toast.success('Conversation started! Check your chats.');
        // Redirect to chats page
        window.location.href = '/chats';
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to contact seller');
    }
  };

  const handleNegotiation = async () => {
    if (!product || !user) {
      toast.error('Please sign in to negotiate');
      return;
    }

    if (!product.seller_id) {
      toast.error('This product does not have a seller assigned. Please contact support.');
      return;
    }

    if (!proposedPrice || parseFloat(proposedPrice) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    setSubmittingNegotiation(true);

    try {
      console.log('Creating negotiation with seller_id:', product.seller_id);
      
      const { error } = await supabase
        .from('negotiations')
        .insert({
          product_id: product.id,
          buyer_id: user.id,
          seller_id: product.seller_id,
          original_price: product.price,
          proposed_price: parseFloat(proposedPrice),
          message: negotiationMessage,
          status: 'pending',
        });

      if (error) {
        console.error('Error submitting negotiation:', error);
        toast.error('Failed to submit negotiation');
      } else {
        toast.success('Negotiation submitted! The seller will be notified.');
        setShowNegotiation(false);
        setNegotiationMessage('');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to submit negotiation');
    }

    setSubmittingNegotiation(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-12 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-8">
            <h2 className="text-2xl font-bold mb-2">Product not found</h2>
            <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
            <Button asChild>
              <Link to="/">
                Back to Home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="aspect-square overflow-hidden rounded-lg bg-white shadow-sm">
            <img
              src={product.image_url || '/placeholder-product.jpg'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Badge variant="secondary">{product.category}</Badge>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm text-gray-600">4.5 (127 reviews)</span>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>
              <p className="text-gray-600 text-lg leading-relaxed">{product.description}</p>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl font-bold text-gray-900">
                  ${product.price}
                </span>
                {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
                  <span className="text-orange-600 font-medium">
                    Only {product.stock_quantity} left!
                  </span>
                )}
                {product.stock_quantity === 0 && (
                  <span className="text-red-600 font-medium">Out of stock</span>
                )}
              </div>

              {product.stock_quantity > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium">Quantity:</label>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        -
                      </Button>
                      <span className="w-12 text-center">{quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      onClick={handleAddToCart}
                      className="w-full"
                      size="lg"
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Add to Cart
                    </Button>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={handleContactSeller}
                        size="lg"
                        disabled={!user || !product.seller_id}
                      >
                        <MessageSquare className="h-5 w-5 mr-2" />
                        Contact Seller
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowNegotiation(!showNegotiation)}
                        size="lg"
                        disabled={!user || !product.seller_id}
                      >
                        <DollarSign className="h-5 w-5 mr-2" />
                        Negotiate Price
                      </Button>
                    </div>
                  </div>

                  {!user && (
                    <p className="text-sm text-gray-600">
                      <Link to="/auth" className="text-blue-600 hover:underline">
                        Sign in
                      </Link>{' '}
                      to contact seller and negotiate prices
                    </p>
                  )}

                  {user && !product.seller_id && (
                    <p className="text-sm text-orange-600">
                      This product doesn't have a seller assigned. Contact and negotiation features are disabled.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Negotiation Form */}
            {showNegotiation && user && product.seller_id && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <span>Negotiate Price</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Your Proposed Price
                    </label>
                    <Input
                      type="number"
                      value={proposedPrice}
                      onChange={(e) => setProposedPrice(e.target.value)}
                      placeholder="Enter your price"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Message to Seller (Optional)
                    </label>
                    <Textarea
                      value={negotiationMessage}
                      onChange={(e) => setNegotiationMessage(e.target.value)}
                      placeholder="Explain why you're proposing this price..."
                      rows={3}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleNegotiation}
                      disabled={submittingNegotiation}
                      className="flex-1"
                    >
                      {submittingNegotiation ? 'Submitting...' : 'Submit Negotiation'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowNegotiation(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Product Features */}
            <Card>
              <CardHeader>
                <CardTitle>Product Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-600">
                  <li>• Free shipping on orders over $50</li>
                  <li>• 30-day return policy</li>
                  <li>• Secure payment processing</li>
                  <li>• Customer support available 24/7</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
