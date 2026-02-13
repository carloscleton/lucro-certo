import { useCRM as useCRMFromContext } from '../context/CRMContext';

export interface CRMStage {
    id: string;
    company_id: string;
    name: string;
    color: string;
    position: number;
}

export interface CRMDeal {
    id: string;
    company_id: string;
    contact_id?: string | null;
    stage_id?: string | null;
    title: string;
    description?: string;
    value: number;
    probability: number;
    expected_closing_date?: string;
    status: 'active' | 'won' | 'lost';
    tags: string[];
    created_at: string;
}

export const useCRM = useCRMFromContext;
