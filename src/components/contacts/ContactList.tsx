import { Edit2, Trash2, User, Truck, History } from 'lucide-react';
import type { Contact } from '../../hooks/useContacts';
import { Tooltip } from '../ui/Tooltip';

interface ContactListProps {
    contacts: Contact[];
    onEdit: (contact: Contact) => void;
    onViewHistory: (contact: Contact) => void;
    onDelete: (id: string) => void;
    canDelete?: boolean;
}

export function ContactList({ contacts, onEdit, onViewHistory, onDelete, canDelete = true }: ContactListProps) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <table className="w-full text-sm text-left">
                {/* ... existing header ... */}
                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-slate-700/50">
                    <tr>
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3 hidden md:table-cell">Contato</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {contacts.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                Nenhum contato cadastrado.
                            </td>
                        </tr>
                    ) : (
                        contacts.map((contact) => (
                            <tr key={contact.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                {/* ... existing cells ... */}
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-full ${contact.type === 'client'
                                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                            }`}>
                                            {contact.type === 'client' ? <User size={14} /> : <Truck size={14} />}
                                        </div>
                                        {contact.name}
                                    </div>
                                    <div className="md:hidden text-xs text-gray-500 mt-1">
                                        {contact.email} {contact.phone && `• ${contact.phone}`}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${contact.type === 'client'
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
                                        }`}>
                                        {contact.type === 'client' ? 'Cliente' : 'Fornecedor'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col text-xs">
                                        {contact.email && <span>{contact.email}</span>}
                                        {contact.phone && <span>{contact.phone}</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Tooltip content="Editar">
                                            <button
                                                onClick={() => onEdit(contact)}
                                                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </Tooltip>

                                        <Tooltip content="Ver Histórico">
                                            <button
                                                onClick={() => onViewHistory(contact)}
                                                className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded"
                                            >
                                                <History size={16} />
                                            </button>
                                        </Tooltip>
                                        {canDelete && (
                                            <Tooltip content="Excluir">
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Tem certeza que deseja excluir?')) {
                                                            onDelete(contact.id);
                                                        }
                                                    }}
                                                    className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 rounded"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
