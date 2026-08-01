import { useState, useEffect } from 'react';
import { supabase, withRetry } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../lib/storageService';

export interface Company {
    id: string;
    trade_name: string; // Nome Fantasia
    legal_name: string; // Razão Social
    cnpj: string;
    inscricao_municipal?: string;
    entity_type: 'PF' | 'PJ';
    cpf?: string;
    user_id: string;
    slug?: string;
    logo_url?: string;
    settings?: {
        member_can_delete?: boolean;
        admins_can_access_settings?: boolean;
        members_can_access_settings?: boolean;
        modules?: {
            [key: string]: {
                member?: boolean;
                admin?: boolean;
            };
        };
        settings_tabs?: {
            [key: string]: {
                member?: boolean;
                admin?: boolean;
            };
        };
        allowed_entity_types?: string[];
        [key: string]: any;
    };
    fiscal_module_enabled?: boolean;
    payments_module_enabled?: boolean;
    crm_module_enabled?: boolean;
    has_social_copilot?: boolean;
    automations_module_enabled?: boolean;
    has_lead_radar?: boolean;
    loyalty_module_enabled?: boolean;
    warranty_module_enabled?: boolean;
    tecnospeed_config?: any;
    zip_code?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    phone?: string;
    subscription_status?: string;
    subscription_plan?: string;
    trial_ends_at?: string;
    status?: string;
}

export function useCompanies() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchCompanies = async () => {
        if (!user) return;
        try {
            const { data, error } = await withRetry(() => supabase
                .from('company_members')
                .select(`
                    company:companies (
                        *
                    )
                `)
                .eq('user_id', user.id)
            );

            if (error) throw error;

            const companiesList = (data || [])
                .map((item: any) => {
                    const c = item.company;
                    if (!c) return null;
                    return {
                        ...c,
                        inscricao_municipal: c.inscricao_municipal || c.settings?.inscricao_municipal || c.settings?.national_config?.inscricao_municipal || ''
                    };
                })
                .filter(Boolean)
                .sort((a: any, b: any) => (a.trade_name || '').localeCompare(b.trade_name || ''));

            setCompanies(companiesList as Company[]);
        } catch (error) {
            console.error('Error fetching companies:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, [user]);

    const uploadLogo = async (companyId: string, file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${companyId}/${Date.now()}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        const { publicUrl } = await storageService.upload(file, 'company-logos', filePath);
        return publicUrl;
    };

    const addCompany = async (company: Partial<Company> & { logo_file?: File }) => {
        if (!user) throw new Error("User not authenticated");

        // 1. Create company via RPC
        const { logo_file, inscricao_municipal, ...restCompany } = company as any;
        const initialSettings = {
            ...(restCompany.settings || {}),
            ...(inscricao_municipal ? { inscricao_municipal } : {})
        };

        const { data, error } = await supabase.rpc('create_company_with_admin', {
            company_data: {
                ...restCompany,
                settings: initialSettings,
                user_id: user.id
            }
        });

        if (error) throw error;

        if (data && data.success === false) {
            throw new Error(data.message);
        }

        const newCompanyId = data.company_id;

        if (inscricao_municipal) {
            try {
                const { data: cData } = await supabase.from('companies').select('settings').eq('id', newCompanyId).single();
                const updatedSettings = {
                    ...(cData?.settings || {}),
                    inscricao_municipal
                };
                await supabase.from('companies').update({ settings: updatedSettings }).eq('id', newCompanyId);
            } catch (e) {
                console.warn('Erro ao salvar inscricao_municipal em settings:', e);
            }
        }

        // 2. Upload logo if file provided
        if (company.logo_file) {
            try {
                const logoUrl = await uploadLogo(newCompanyId, company.logo_file);

                await supabase
                    .from('companies')
                    .update({ logo_url: logoUrl })
                    .eq('id', newCompanyId);
            } catch (err) {
                console.error("Failed to upload logo during creation", err);
            }
        } else if (company.logo_url) {
            await supabase
                .from('companies')
                .update({ logo_url: company.logo_url })
                .eq('id', newCompanyId);
        }

        await fetchCompanies();
    };

    const updateCompany = async (id: string, updates: Partial<Company> & { logo_file?: File }) => {
        let logoUrl = updates.logo_url;

        if (updates.logo_file) {
            try {
                const existingFiles = await storageService.list('company-logos', `logos/${id}/`);

                if (existingFiles && existingFiles.length > 0) {
                    const filesToRemove = existingFiles.map(f => `logos/${id}/${f.name}`);
                    await storageService.deleteMultiple('company-logos', filesToRemove);
                }

                logoUrl = await uploadLogo(id, updates.logo_file);
            } catch (err) {
                console.error("Failed to upload logo during update", err);
                throw err;
            }
        }

        // Clean up updates object to remove logo_file and top-level inscricao_municipal before sending to DB
        const { logo_file, inscricao_municipal, ...companyUpdates } = updates as any;

        const finalUpdates: any = { ...companyUpdates };
        if (logoUrl) finalUpdates.logo_url = logoUrl;

        if (inscricao_municipal !== undefined) {
            const currentComp = companies.find(c => c.id === id);
            const existingSettings = finalUpdates.settings || currentComp?.settings || {};
            finalUpdates.settings = {
                ...existingSettings,
                inscricao_municipal: inscricao_municipal || ''
            };
        }

        const { error } = await supabase
            .from('companies')
            .update(finalUpdates)
            .eq('id', id);

        if (error) throw error;
        await fetchCompanies();
    };

    const deleteCompany = async (id: string) => {
        const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchCompanies();
    };

    return { companies, loading, addCompany, updateCompany, deleteCompany, refresh: fetchCompanies };
}
