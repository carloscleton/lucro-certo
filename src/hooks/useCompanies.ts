import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface Company {
    id: string;
    trade_name: string; // Nome Fantasia
    legal_name: string; // Razão Social
    cnpj: string;
    user_id: string;
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
    };
    fiscal_module_enabled?: boolean;
    payments_module_enabled?: boolean;
    crm_module_enabled?: boolean;
    tecnospeed_config?: any;
    zip_code?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
}

export function useCompanies() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchCompanies = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('trade_name');

            if (error) throw error;
            setCompanies(data || []);
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

        const { error: uploadError } = await supabase.storage
            .from('company-logos')
            .upload(fileName, file);

        if (uploadError) {
            console.error('Error uploading logo:', uploadError);
            throw uploadError;
        }

        const { data } = supabase.storage
            .from('company-logos')
            .getPublicUrl(fileName);

        return data.publicUrl;
    };

    const addCompany = async (company: Omit<Company, 'id' | 'user_id'> & { logo_file?: File }) => {
        if (!user) return;

        let logoUrl = company.logo_url;

        // 1. Create company first (we need ID for storage folder usually, though here we could generate UUID first but RPC handles creation)
        const { data, error } = await supabase.rpc('create_company', {
            name_input: company.legal_name,
            trade_name_input: company.trade_name,
            cnpj_input: company.cnpj,
            email_input: '',
            phone_input: '',
            address_input: company.street ? `${company.street}, ${company.number}${company.complement ? ' - ' + company.complement : ''} - ${company.city}/${company.state}` : '',
            zip_code_input: company.zip_code || null,
            street_input: company.street || null,
            number_input: company.number || null,
            complement_input: company.complement || null,
            neighborhood_input: company.neighborhood || null,
            city_input: company.city || null,
            state_input: company.state || null
        });

        if (error) throw error;

        if (data && data.success === false) {
            throw new Error(data.message);
        }

        const newCompanyId = data.company_id;

        // 2. Upload logo if file provided
        if (company.logo_file) {
            try {
                logoUrl = await uploadLogo(newCompanyId, company.logo_file);

                // 3. Update company with logo URL
                await supabase
                    .from('companies')
                    .update({ logo_url: logoUrl })
                    .eq('id', newCompanyId);
            } catch (err) {
                console.error("Failed to upload logo during creation", err);
                // Non-blocking error? Or should we warn user?
            }
        } else if (company.logo_url) {
            // Update with manually provided URL if no file
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
                // 1. Cleanup: Remove OLD images from this company's folder to prevent accumulation
                // We list all files in the company's folder and delete them
                const { data: existingFiles } = await supabase.storage
                    .from('company-logos')
                    .list(id);

                if (existingFiles && existingFiles.length > 0) {
                    const filesToRemove = existingFiles.map(f => `${id}/${f.name}`);
                    await supabase.storage
                        .from('company-logos')
                        .remove(filesToRemove);
                }

                logoUrl = await uploadLogo(id, updates.logo_file);
            } catch (err) {
                console.error("Failed to upload logo during update", err);
                throw err;
            }
        }

        // Clean up updates object to remove logo_file before sending to DB
        const { logo_file, ...companyUpdates } = updates;

        const finalUpdates = { ...companyUpdates };
        if (logoUrl) finalUpdates.logo_url = logoUrl;

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
