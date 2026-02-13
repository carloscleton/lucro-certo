import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';

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

export function useCRM() {
    const [stages, setStages] = useState<CRMStage[]>([]);
    const [deals, setDeals] = useState<CRMDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchCRMData = async () => {
        if (!user || currentEntity.type !== 'company') return;
        setLoading(true);
        try {
            // Fetch Stages
            const { data: stagesData, error: stagesError } = await supabase
                .from('crm_stages')
                .select('*')
                .eq('company_id', currentEntity.id)
                .order('position');

            if (stagesError) throw stagesError;

            // Fetch Deals
            const { data: dealsData, error: dealsError } = await supabase
                .from('crm_deals')
                .select('*')
                .eq('company_id', currentEntity.id);

            if (dealsError) throw dealsError;

            setStages(stagesData || []);
            setDeals(dealsData || []);
        } catch (error) {
            console.error('Error fetching CRM data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCRMData();
    }, [user, currentEntity]);

    const addStage = async (stage: Omit<CRMStage, 'id' | 'company_id'>) => {
        if (!currentEntity.id) return;
        const { error } = await supabase
            .from('crm_stages')
            .insert([{ ...stage, company_id: currentEntity.id }]);
        if (error) throw error;
        await fetchCRMData();
    };

    const updateDealStage = async (dealId: string, stageId: string) => {
        const { error } = await supabase
            .from('crm_deals')
            .update({ stage_id: stageId, updated_at: new Date().toISOString() })
            .eq('id', dealId);
        if (error) throw error;
        await fetchCRMData();
    };

    const addDeal = async (deal: Omit<CRMDeal, 'id' | 'company_id' | 'created_at'>) => {
        if (!currentEntity.id) return;
        const { error } = await supabase
            .from('crm_deals')
            .insert([{ ...deal, company_id: currentEntity.id }]);
        if (error) throw error;
        await fetchCRMData();
    };

    return { stages, deals, loading, addStage, updateDealStage, addDeal, refresh: fetchCRMData };
}
