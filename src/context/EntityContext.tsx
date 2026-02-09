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
}

interface EntityContextType {
    currentEntity: Entity;
    availableEntities: Entity[];
    switchEntity: (entity: Entity) => void;
    isLoading: boolean;
}

const EntityContext = createContext<EntityContextType>({
    currentEntity: { type: 'personal', name: 'Pessoal' },
    availableEntities: [],
    switchEntity: () => { },
    isLoading: true,
});

export function EntityProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [currentEntity, setCurrentEntity] = useState<Entity>({ type: 'personal', name: 'Pessoal' });
    const [availableEntities, setAvailableEntities] = useState<Entity[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setAvailableEntities([]);
            setIsLoading(false);
            return;
        }

        const fetchCompanies = async () => {
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
                            zip_code
                        ),
                        role,
                        status
                    `)
                    .eq('user_id', user.id);

                if (error) throw error;
                console.log('All memberships found (any status):', data);

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
                        // Extensive mapping for "any" usage in PDF generation
                        legal_name: item.company.legal_name,
                        cnpj: item.company.cnpj,
                        street: item.company.street,
                        number: item.company.number,
                        complement: item.company.complement,
                        neighborhood: item.company.neighborhood,
                        city: item.company.city,
                        state: item.company.state,
                        zip_code: item.company.zip_code
                    }));

                // Always include Personal option
                const personalOption: Entity = { type: 'personal', name: 'Pessoal' };
                setAvailableEntities([personalOption, ...companies]);

                // Default to PJ (first company) if available
                if (companies.length > 0) {
                    setCurrentEntity(companies[0]);
                }
            } catch (err) {
                console.error('Error fetching companies for entity selector:', err);
                // Fallback to at least personal
                setAvailableEntities([{ type: 'personal', name: 'Pessoal' }]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCompanies();
    }, [user]);

    const switchEntity = (entity: Entity) => {
        setCurrentEntity(entity);
        // Persist preference logically if needed, for now just state
    };

    return (
        <EntityContext.Provider value={{ currentEntity, availableEntities, switchEntity, isLoading }}>
            {children}
        </EntityContext.Provider>
    );
}

export const useEntity = () => useContext(EntityContext);
