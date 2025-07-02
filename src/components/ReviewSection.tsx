import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getUserDisplayName } from '@/utils/profileUtils';

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_name?: string;
}

interface ReviewSectionProps {
  productId: string;
  sellerId: string;
}

const ReviewSection: React.FC<ReviewSectionProps> = ({ productId, sellerId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    setLoading(true);
    
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      toast.error('Failed to load reviews');
      setLoading(false);
      return;
    }

    const reviewsWithNames: Review[] = [];
    
    for (const review of reviewsData || []) {
      const userName = await getUserDisplayName(review.user_id);
      
      reviewsWithNames.push({
        ...review,
        user_name: userName
      });
    }

    setReviews(reviewsWithNames);
    
    const currentUserReview = reviewsWithNames.find(review => review.user_id === user?.id);
    if (currentUserReview) {
      setUserReview(currentUserReview);
      setRating(currentUserReview.rating);
      setComment(currentUserReview.comment || '');
    }
    
    setLoading(false);
  };

  const submitReview = async () => {
    if (!user || !rating) {
      toast.error('Please select a rating');
      return;
    }

    if (user.id === sellerId) {
      toast.error("You can't review your own product");
      return;
    }

    setSubmitting(true);

    try {
      if (userReview) {
        // Update existing review
        const { error } = await supabase
          .from('reviews')
          .update({
            rating,
            comment: comment.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userReview.id);

        if (error) throw error;
        toast.success('Review updated successfully!');
      } else {
        // Create new review
        const { error } = await supabase
          .from('reviews')
          .insert({
            product_id: productId,
            user_id: user.id,
            rating,
            comment: comment.trim() || null,
          });

        if (error) throw error;
        toast.success('Review submitted successfully!');
      }

      fetchReviews();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    }

    setSubmitting(false);
  };

  const deleteReview = async () => {
    if (!userReview) return;

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', userReview.id);

      if (error) throw error;

      setUserReview(null);
      setRating(0);
      setComment('');
      toast.success('Review deleted successfully!');
      fetchReviews();
    } catch (error) {
      console.error('Error deleting review:', error);
      toast.error('Failed to delete review');
    }

    setSubmitting(false);
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

  const StarRating = ({ rating: currentRating, interactive = false, onRatingChange }: {
    rating: number;
    interactive?: boolean;
    onRatingChange?: (rating: number) => void;
  }) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= currentRating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
            onClick={interactive && onRatingChange ? () => onRatingChange(star) : undefined}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Review Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Customer Reviews</span>
            <div className="flex items-center space-x-2">
              <StarRating rating={Math.round(averageRating)} />
              <span className="text-sm text-gray-600">
                {averageRating > 0 ? averageRating.toFixed(1) : '0'} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Add/Edit Review */}
      {user && user.id !== sellerId && (
        <Card>
          <CardHeader>
            <CardTitle>
              {userReview ? 'Update Your Review' : 'Write a Review'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rating</label>
              <StarRating
                rating={rating}
                interactive={true}
                onRatingChange={setRating}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Comment (Optional)</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={3}
              />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={submitReview}
                disabled={submitting || rating === 0}
              >
                {submitting ? 'Submitting...' : userReview ? 'Update Review' : 'Submit Review'}
              </Button>
              {userReview && (
                <Button
                  variant="outline"
                  onClick={deleteReview}
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!user && (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-gray-600">
              Please sign in to write a review for this product.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-600">No reviews yet. Be the first to review this product!</p>
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="py-4">
                <div className="flex items-start space-x-3">
                  <Avatar>
                    <AvatarFallback>
                      {review.user_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">
                          {review.user_name || 'Anonymous User'}
                        </p>
                        <StarRating rating={review.rating} />
                      </div>
                      <p className="text-sm text-gray-500">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {review.comment && (
                      <p className="text-gray-700 mt-2">{review.comment}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ReviewSection;
