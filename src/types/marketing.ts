export interface SocialProfile {
    id: string;
    company_id: string;
    niche: string;
    tone: string;
    target_audience: string;
    approval_whatsapp?: string;
    fb_access_token?: string;
    fb_page_id?: string;
    fb_page_name?: string;
    ig_account_id?: string;
    ig_username?: string;
    video_enabled?: boolean;
    avatar_id?: string;
    voice_id?: string;
    avatar_style?: string;
    avatar_gender?: string;
    brand_logo_url?: string;
    brand_primary_color?: string;
    brand_secondary_color?: string;
    autopilot_enabled?: boolean;
    autopilot_frequency?: 'daily' | 'thrice_weekly' | 'weekly';
    blog_autopilot_enabled?: boolean;
    blog_autopilot_frequency?: 'daily' | 'thrice_weekly' | 'weekly';
    best_posting_times?: string[];
    created_at: string;
    updated_at: string;
}

export interface SocialPost {
    id: string;
    company_id: string;
    content: string;
    image_url?: string;
    media_type?: 'feed' | 'story' | 'reels';
    status: 'pending' | 'approved' | 'rejected' | 'posted';
    scheduled_for?: string;
    posted_at?: string;
    likes_count?: number;
    comments_count?: number;
    reach_count?: number;
    impressions_count?: number;
    conversion_count?: number;
    estimated_roi_value?: number;
    created_at: string;
    updated_at: string;
}

export interface BlogPost {
    id: string;
    company_id: string;
    title: string;
    content: string;
    slug?: string;
    status: 'draft' | 'published' | 'scheduled';
    seo_score?: number;
    conversion_count?: number;
    estimated_roi_value?: number;
    created_at: string;
    updated_at: string;
}
