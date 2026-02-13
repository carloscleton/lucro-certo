import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useEntity } from './EntityContext';
import { type CRMStage, type CRMDeal } from '../hooks/useCRM';

interface CRMContextType {
    stages: CRMStage[];
    deals: CRMDeal[];
    loading: boolean;
    refresh: () => Promise<void>;
    addStage: (stage: Omit<CRMStage, 'id' | 'company_id'>) => Promise<void>;
    updateStage: (id: string, updates: Partial<CRMStage>) => Promise<void>;
    deleteStage: (id: string) => Promise<void>;
    updateDealStage: (dealId: string, stageId: string) => Promise<void>;
    addDeal: (deal: Omit<CRMDeal, 'id' | 'company_id' | 'created_at'>) => Promise<void>;
    updateDeal: (id: string, updates: Partial<CRMDeal>) => Promise<void>;
    deleteDeal: (id: string) => Promise<void>;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: React.ReactNode }) {
    const [stages, setStages] = useState<CRMStage[]>([]);
    const [deals, setDeals] = useState<CRMDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchCRMData = async () => {
        if (!user || currentEntity.type !== 'company') return;
        setLoading(true);
        try {
            const { data: stagesData, error: stagesError } = await supabase
                .from('crm_stages')
                .select('*')
                .eq('company_id', currentEntity.id)
                .order('position');

            if (stagesError) throw stagesError;

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
        const nextPosition = stages.length > 0
            ? Math.max(...stages.map(s => s.position)) + 1
            : 0;
        const { error } = await supabase
            .from('crm_stages')
            .insert([{ ...stage, company_id: currentEntity.id, position: stage.position ?? nextPosition }]);
        if (error) throw error;
        await fetchCRMData();
    };

    const updateStage = async (id: string, updates: Partial<CRMStage>) => {
        const { error } = await supabase.from('crm_stages').update(updates).eq('id', id);
        if (error) throw error;
        await fetchCRMData();
    };

    const deleteStage = async (id: string) => {
        const hasDeals = deals.some(d => d.stage_id === id);
        if (hasDeals) throw new Error('Não é possível excluir uma etapa que contém negócios.');
        const { error } = await supabase.from('crm_stages').delete().eq('id', id);
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

    const updateDeal = async (id: string, updates: Partial<CRMDeal>) => {
        const { error } = await supabase
            .from('crm_deals')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
        await fetchCRMData();
    };

    const deleteDeal = async (id: string) => {
        const { error } = await supabase.from('crm_deals').delete().eq('id', id);
        if (error) throw error;
        await fetchCRMData();
    };

    return (
        <CRMContext.Provider value={{
            stages, deals, loading, refresh: fetchCRMData,
            addStage, updateStage, deleteStage,
            updateDealStage, addDeal, updateDeal, deleteDeal
        }}>
            {children}
        </CRMContext.Provider>
    );
}

export function useCRM() {
    const context = useContext(CRMContext);
    if (!context) {
        throw new Error('useCRM must be used within a CRMProvider');
    }
    return context;
}
