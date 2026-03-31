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

export function Contacts() {
    const { contacts, loading, addContact, updateContact, deleteContact } = useContacts();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'client' | 'supplier'>('all');
    const [searchTerm, setSearchTerm] = useState('');
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

    const isLoyaltyEnabled = currentEntity.type === 'company' && (currentEntity as any).loyalty_module_enabled;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="text-blue-600" />
                        {t('contacts.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">{t('contacts.subtitle')}</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={20} className="mr-2" />
                    {t('contacts.new_contact')}
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder={t('contacts.search_placeholder') || "Pesquisar contatos..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm italic"
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'all'
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700 dark:hover:bg-slate-700'
                            }`}
                    >
                        {t('common.all')}
                    </button>
                    <button
                        onClick={() => setFilterType('client')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'client'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700 dark:hover:bg-slate-700'
                            }`}
                    >
                        {t('contacts.clients')}
                    </button>
                    <button
                        onClick={() => setFilterType('supplier')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'supplier'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700 dark:hover:bg-slate-700'
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
                onDelete={async (id) => {
                    if (!canDelete) {
                        alert(t('contacts.no_permission_delete'));
                        return;
                    }
                    if (confirm(t('common.confirm_delete'))) {
                        await deleteContact(id);
                    }
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
        </div>
    );
}
