import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';

export interface FiscalInvoice {
    id: string;
    company_id: string;
    quote_id?: string;
    external_id?: string;
    type: 'nfe' | 'nfse';
    status: string;
    pdf_url?: string;
    xml_url?: string;
    error_message?: string;
    payload?: any;
    quote?: any;
    created_at: string;
    updated_at: string;
}

export function useInvoices() {
    const [invoices, setInvoices] = useState<FiscalInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { currentEntity } = useEntity();

    const fetchInvoices = useCallback(async () => {
        if (!currentEntity.id || currentEntity.type === 'personal') {
            setInvoices([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            let filterId = currentEntity.id;
            
            // 🔍 Se o ID não parece um UUID (ex: é um CNPJ), tenta resolver o ID real
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filterId || '');

            if (currentEntity.cnpj && (!filterId || !isUUID)) {
                const cleanCnpj = currentEntity.cnpj.replace(/\D/g, '');
                const { data: compData } = await supabase
                    .from('companies')
                    .select('id')
                    .or(`cnpj.eq.${cleanCnpj},cnpj.eq.${currentEntity.cnpj}`)
                    .maybeSingle();
                
                if (compData?.id) {
                    filterId = compData.id;
                    console.log(`🎯 [useInvoices] ID resolvido via CNPJ: ${filterId}`);
                } else {
                    console.warn(`⚠️ [useInvoices] Não foi possível resolver UUID para CNPJ: ${currentEntity.cnpj}`);
                }
            }

            console.log(`🔍 [useInvoices] Buscando notas para company_id: ${filterId}`);

            const { data, error } = await supabase
                .from('fiscal_invoices')
                .select(`
                    *,
                    quote:quote_id (
                        quote_number,
                        title,
                        contact:contact_id (
                            name,
                            tax_id
                        )
                    )
                `)
                .eq('company_id', filterId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setInvoices(data || []);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentEntity.id, currentEntity.type]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    return {
        invoices,
        isLoading,
        refresh: fetchInvoices
    };
}
