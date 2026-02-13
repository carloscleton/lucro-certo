import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
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
            await updateContact(editingContact.id, data);
        } else {
            await addContact(data);
        }
    };

    const filteredContacts = contacts.filter(contact =>
        filterType === 'all' || contact.type === filterType
    );

    if (loading) return <div>Carregando contatos...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="text-blue-600" />
                        Clientes e Fornecedores
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie seus contatos comerciais.</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={20} className="mr-2" />
                    Novo Contato
                </Button>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => setFilterType('all')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filterType === 'all'
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700 dark:hover:bg-slate-700'
                        }`}
                >
                    Todos
                </button>
                <button
                    onClick={() => setFilterType('client')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filterType === 'client'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700 dark:hover:bg-slate-700'
                        }`}
                >
                    Clientes
                </button>
                <button
                    onClick={() => setFilterType('supplier')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filterType === 'supplier'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700 dark:hover:bg-slate-700'
                        }`}
                >
                    Fornecedores
                </button>
            </div>

            <ContactList
                contacts={filteredContacts}
                onEdit={handleOpenModal}
                onViewHistory={(contact: Contact) => setHistoryContact({ id: contact.id, name: contact.name })}
                onDelete={async (id) => {
                    if (!canDelete) {
                        alert('Você não tem permissão para excluir contatos.');
                        return;
                    }
                    if (confirm('Tem certeza que deseja excluir?')) {
                        await deleteContact(id);
                    }
                }}
                canDelete={canDelete}
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
