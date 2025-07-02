
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  stock_quantity: number | null;
}

interface EditProductFormProps {
  product: Product;
  onClose: () => void;
  onUpdate: () => void;
}

const EditProductForm: React.FC<EditProductFormProps> = ({ product, onClose, onUpdate }) => {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState(product.price.toString());
  const [imageUrl, setImageUrl] = useState(product.image_url || '');
  const [category, setCategory] = useState(product.category || '');
  const [stockQuantity, setStockQuantity] = useState(product.stock_quantity?.toString() || '0');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !price) {
      toast.error('Please fill in all required fields');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    const stockNum = parseInt(stockQuantity) || 0;
    if (stockNum < 0) {
      toast.error('Stock quantity cannot be negative');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          price: priceNum,
          image_url: imageUrl.trim() || null,
          category: category || null,
          stock_quantity: stockNum,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (error) {
        console.error('Error updating product:', error);
        toast.error('Failed to update product');
      } else {
        toast.success('Product updated successfully!');
        onUpdate();
        onClose();
      }
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Product</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter product name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your product..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="clothing">Clothing</SelectItem>
                  <SelectItem value="home">Home & Garden</SelectItem>
                  <SelectItem value="books">Books</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                  <SelectItem value="toys">Toys</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Quantity</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Image URL</Label>
            <Input
              id="image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="flex space-x-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Product'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default EditProductForm;
