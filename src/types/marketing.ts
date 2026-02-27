export interface SocialProfile {
    id: string;
    company_id: string;
    niche: string;
    tone: string;
    target_audience: string;
    created_at: string;
    updated_at: string;
}

export interface SocialPost {
    id: string;
    company_id: string;
    content: string;
    status: 'pending' | 'approved' | 'rejected' | 'posted';
    scheduled_for?: string;
    posted_at?: string;
    created_at: string;
    updated_at: string;
}
