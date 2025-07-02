
-- Create reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, user_id) -- One review per user per product
);

-- Add RLS policies for reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews
CREATE POLICY "Anyone can view reviews" 
  ON public.reviews 
  FOR SELECT 
  TO public
  USING (true);

-- Users can create their own reviews
CREATE POLICY "Users can create their own reviews" 
  ON public.reviews 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update their own reviews" 
  ON public.reviews 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete their own reviews" 
  ON public.reviews 
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- Add seller_name to conversations to fix Unknown User issue
ALTER TABLE public.conversations ADD COLUMN seller_name TEXT;
ALTER TABLE public.conversations ADD COLUMN buyer_name TEXT;

-- Update conversation_messages to include sender names
ALTER TABLE public.conversation_messages ADD COLUMN sender_name TEXT;
