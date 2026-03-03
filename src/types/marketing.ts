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
    created_at: string;
    updated_at: string;
}
