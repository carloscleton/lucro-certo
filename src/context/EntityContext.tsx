import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type EntityType = 'personal' | 'company';

export interface Entity {
    type: EntityType;
    id?: string; // null for personal
    name: string;
    role?: 'owner' | 'admin' | 'member';
    whatsapp_instance_limit?: number;
    logo_url?: string;
    legal_name?: string;
    cnpj?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    settings?: any;
    fiscal_module_enabled?: boolean;
    payments_module_enabled?: boolean;
    crm_module_enabled?: boolean;
    has_social_copilot?: boolean;
}

interface EntityContextType {
    currentEntity: Entity;
    availableEntities: Entity[];
    switchEntity: (entity: Entity) => void;
    refresh: () => Promise<void>;
    isLoading: boolean;
}

const EntityContext = createContext<EntityContextType>({
    currentEntity: { type: 'personal', name: 'Pessoal' },
    availableEntities: [],
    switchEntity: () => { },
    refresh: async () => { },
    isLoading: true,
});

const STORAGE_KEY = 'lucro-certo:selected-entity';

export function EntityProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [currentEntity, setCurrentEntity] = useState<Entity>({ type: 'personal', name: 'Pessoal' });
    const [availableEntities, setAvailableEntities] = useState<Entity[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCompanies = async () => {
        if (!user) {
            setAvailableEntities([{ type: 'personal', name: 'Pessoal' }]);
            setIsLoading(false);
            return;
        }

        try {
            // Fetch companies via membership to ensure we get all companies the user is part of
            const { data, error } = await supabase
                .from('company_members')
                .select(`
                    company:companies (
                        id,
                        trade_name,
                        legal_name,
                        cnpj,
                        whatsapp_instance_limit,
                        logo_url,
                        street,
                        number,
                        complement,
                        neighborhood,
                        city,
                        state,
                        zip_code,
                        settings,
                        fiscal_module_enabled,
                        payments_module_enabled,
                        crm_module_enabled,
                        has_social_copilot
                    ),
                    role,
                    status
                `)
                .eq('user_id', user.id);

            if (error) throw error;

            // Map nested result to Entity
            const companies: Entity[] = (data || [])
                .filter((item: any) => item.company && item.status === 'active') // Filter active only for UI
                .map((item: any) => ({
                    type: 'company',
                    id: item.company.id,
                    name: item.company.trade_name,
                    role: item.role,
                    whatsapp_instance_limit: item.company.whatsapp_instance_limit || 1,
                    logo_url: item.company.logo_url,
                    legal_name: item.company.legal_name,
                    cnpj: item.company.cnpj,
                    street: item.company.street,
                    number: item.company.number,
                    complement: item.company.complement,
                    neighborhood: item.company.neighborhood,
                    city: item.company.city,
                    state: item.company.state,
                    zip_code: item.company.zip_code,
                    settings: item.company.settings,
                    fiscal_module_enabled: item.company.fiscal_module_enabled,
                    payments_module_enabled: item.company.payments_module_enabled,
                    crm_module_enabled: item.company.crm_module_enabled,
                    has_social_copilot: item.company.has_social_copilot
                }));

            // Always include Personal option with user's settings
            const personalOption: Entity = {
                type: 'personal',
                name: 'Pessoal',
                settings: user ? (await supabase.from('profiles').select('settings').eq('id', user.id).maybeSingle()).data?.settings : {}
            };
            const allEntities = [personalOption, ...companies];
            setAvailableEntities(allEntities);

            // Restaurar preferência salva do localStorage
            const savedKey = localStorage.getItem(STORAGE_KEY);

            setCurrentEntity(prev => {
                // Se o usuário já fez uma escolha ativa (não é a primeira carga), manter
                // Atualizar dados da entidade atual sem trocar de entidade
                if (prev.type === 'company') {
                    const updated = companies.find(c => c.id === prev.id);
                    if (updated) return updated;
                }

                // Se há preferência salva no localStorage, usar ela
                if (savedKey) {
                    if (savedKey === 'personal') {
                        return personalOption;
                    }
                    const savedCompany = companies.find(c => c.id === savedKey);
                    if (savedCompany) return savedCompany;
                }

                // Primeira vez (sem preferência): auto-switch para primeira empresa se houver
                if (companies.length > 0 && prev.type === 'personal' && !savedKey) {
                    const firstCompany = companies[0];
                    localStorage.setItem(STORAGE_KEY, firstCompany.id || 'personal');
                    return firstCompany;
                }

                return prev;
            });

        } catch (err) {
            console.error('Error fetching companies for entity selector:', err);
            setAvailableEntities([{ type: 'personal', name: 'Pessoal' }]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchCompanies();
        } else {
            // Se deslogar, reseta TUDO imediatamente
            setCurrentEntity({ type: 'personal', name: 'Pessoal' });
            setAvailableEntities([{ type: 'personal', name: 'Pessoal' }]);
            localStorage.removeItem(STORAGE_KEY);
            setIsLoading(false);
        }
    }, [user]);

    const switchEntity = (entity: Entity) => {
        setCurrentEntity(entity);
        // Persistir preferência do usuário no localStorage
        const key = entity.type === 'personal' ? 'personal' : entity.id;
        localStorage.setItem(STORAGE_KEY, key || 'personal');
    };

    return (
        <EntityContext.Provider value={{ currentEntity, availableEntities, switchEntity, refresh: fetchCompanies, isLoading }}>
            {children}
        </EntityContext.Provider>
    );
}

export const useEntity = () => useContext(EntityContext);
