import { useState } from 'react';
import { Plus, Users, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useContacts, type Contact } from '../hooks/useContacts';
import { ContactList } from '../components/contacts/ContactList';
import { ContactForm } from '../components/contacts/ContactForm';
import { ContactHistoryModal } from '../components/contacts/ContactHistoryModal';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { useCompanies } from '../hooks/useCompanies';
import { useTeam } from '../hooks/useTeam';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { ResultModal } from '../components/ui/ResultModal';

export function Contacts() {
    const { contacts, loading, addContact, updateContact, deleteContact } = useContacts();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'client' | 'supplier'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal States
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [contactToDelete, setContactToDelete] = useState<string | null>(null);
    const [resultModal, setResultModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error'}>({
        isOpen: false, title: '', message: '', type: 'success'
    });
    const { t } = useTranslation();

    // History Modal state
    const [historyContact, setHistoryContact] = useState<{ id: string, name: string } | null>(null);

    // Permission Check
    const { user } = useAuth();
    const { currentEntity } = useEntity();
    const { companies } = useCompanies();
    const { members } = useTeam();

    let canDelete = true;
    if (currentEntity.type === 'company' && user) {
        const company = companies.find(c => c.id === currentEntity.id);
        const myMembership = members.find(m => m.user_id === user.id);

        const isOwnerOrAdmin = myMembership?.role === 'owner' || myMembership?.role === 'admin';
        const memberCanDelete = company?.settings?.member_can_delete ?? false;

        if (!isOwnerOrAdmin && !memberCanDelete) {
            canDelete = false;
        }
    }

    const handleOpenModal = (contact?: Contact) => {
        if (contact) {
            setEditingContact(contact);
        } else {
            setEditingContact(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingContact(null);
    };

    const handleSubmit = async (data: any) => {
        if (editingContact) {
            return await updateContact(editingContact.id, data);
        } else {
            return await addContact(data);
        }
    };

    const filteredContacts = contacts.filter(contact => {
        const matchesFilter = filterType === 'all' || contact.type === filterType;
        const matchesSearch = !searchTerm || 
            contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.whatsapp?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesFilter && matchesSearch;
    });

    if (loading) return <div>{t('contacts.loading')}</div>;

    const currentCompany = companies.find(c => c.id === currentEntity.id);
    const isLoyaltyEnabled = currentEntity.type === 'company' && currentCompany?.loyalty_module_enabled;

    const executeDelete = async () => {
        if (!contactToDelete) return;

        try {
            await deleteContact(contactToDelete);
            setDeleteConfirmOpen(false);
            setContactToDelete(null);
            setResultModal({
                isOpen: true,
                title: t('common.success') || 'Sucesso',
                message: 'Contato removido com sucesso.',
                type: 'success'
            });
        } catch (error: any) {
            setResultModal({
                isOpen: true,
                title: t('common.error') || 'Erro',
                message: error.message || 'Erro ao excluir contato',
                type: 'error'
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <Users size={24} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {t('contacts.title')}
                        </h1>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 ml-11">
                        {t('contacts.subtitle')}
                    </p>
                </div>
                <Button 
                    onClick={() => handleOpenModal()}
                    className="h-12 px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 rounded-2xl font-bold text-sm"
                >
                    <Plus size={20} className="mr-2" />
                    {t('contacts.new_contact')}
                </Button>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-4 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                <div className="relative w-full xl:w-[450px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder={t('contacts.search_placeholder') || "Pesquisar por nome, e-mail ou telefone..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-800 border-2 border-gray-50 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 transition-all text-sm font-medium shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-2 w-full xl:w-auto p-1 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`h-10 px-6 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filterType === 'all'
                            ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        {t('common.all')}
                    </button>
                    <button
                        onClick={() => setFilterType('client')}
                        className={`h-10 px-6 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filterType === 'client'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-gray-500 hover:text-blue-600'
                            }`}
                    >
                        {t('contacts.clients')}
                    </button>
                    <button
                        onClick={() => setFilterType('supplier')}
                        className={`h-10 px-6 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filterType === 'supplier'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'text-gray-500 hover:text-purple-600'
                            }`}
                    >
                        {t('contacts.suppliers')}
                    </button>
                </div>
            </div>

            <ContactList
                contacts={filteredContacts}
                onEdit={handleOpenModal}
                onViewHistory={(contact: Contact) => setHistoryContact({ id: contact.id, name: contact.name })}
                onDelete={(id) => {
                    if (!canDelete) {
                        setResultModal({
                            isOpen: true,
                            title: 'Sem Permissão',
                            message: t('contacts.no_permission_delete'),
                            type: 'error'
                        });
                        return;
                    }
                    setContactToDelete(id);
                    setDeleteConfirmOpen(true);
                }}
                canDelete={canDelete}
                isLoyaltyEnabled={isLoyaltyEnabled}
            />

            <ContactForm
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                initialData={editingContact}
            />

            {historyContact && (
                <ContactHistoryModal
                    isOpen={!!historyContact}
                    onClose={() => setHistoryContact(null)}
                    contactId={historyContact.id}
                    contactName={historyContact.name}
                />
            )}

            <ConfirmationModal
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={executeDelete}
                title={t('common.confirm_delete') || 'Confirmar Exclusão'}
                message="Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita."
                variant="danger"
                confirmLabel="Sim, Excluir"
            />

            <ResultModal
                isOpen={resultModal.isOpen}
                onClose={() => setResultModal(prev => ({ ...prev, isOpen: false }))}
                title={resultModal.title}
                message={resultModal.message}
                type={resultModal.type}
            />
        </div>
    );
}
}
