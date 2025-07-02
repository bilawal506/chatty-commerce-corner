
import { supabase } from '@/integrations/supabase/client';

export const ensureUserProfile = async (userId: string, userEmail?: string) => {
  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!existingProfile) {
    // Create profile if it doesn't exist
    const displayName = userEmail ? userEmail.split('@')[0] : `User ${userId.slice(0, 8)}`;
    
    const { error } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        email: userEmail,
        full_name: displayName
      });

    if (error) {
      console.error('Error creating profile:', error);
    }
  }
};

export const getUserDisplayName = async (userId: string): Promise<string> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('user_id', userId)
    .single();

  if (profile?.full_name) {
    return profile.full_name;
  } else if (profile?.email) {
    return profile.email.split('@')[0];
  } else {
    return `User ${userId.slice(0, 8)}`;
  }
};
