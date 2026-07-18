import { Edit2, Trash2, User, Truck, History, Award, CheckSquare, Square } from 'lucide-react';
import type { Contact } from '../../hooks/useContacts';
import { Tooltip } from '../ui/Tooltip';

interface ContactListProps {
    contacts: Contact[];
    onEdit: (contact: Contact) => void;
    onViewHistory: (contact: Contact) => void;
    onDelete: (id: string) => void;
    canDelete?: boolean;
    isLoyaltyEnabled?: boolean;
    selectedIds: string[];
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: () => void;
    allSelected: boolean;
}

export function ContactList({ contacts, onEdit, onViewHistory, onDelete, canDelete = true, isLoyaltyEnabled = true, selectedIds, onToggleSelect, onToggleSelectAll, allSelected }: ContactListProps) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-slate-800 overflow-hidden transition-all duration-300">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                    <tr>
                        <th className="px-6 py-5 w-12 text-center">
                            <button
                                type="button"
                                onClick={onToggleSelectAll}
                                className="p-1 text-gray-400 hover:text-blue-500"
                            >
                                {allSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                            </button>
                        </th>
                        <th className="px-6 py-5 font-bold text-[10px] uppercase tracking-widest text-gray-400">Nome / Identificação</th>
                        <th className="px-6 py-5 font-bold text-[10px] uppercase tracking-widest text-gray-400">Tipo</th>
                        <th className="px-6 py-5 font-bold text-[10px] uppercase tracking-widest text-gray-400 hidden md:table-cell">Informações de Contato</th>
                        <th className="px-6 py-5 text-right font-bold text-[10px] uppercase tracking-widest text-gray-400">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                    {contacts.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="py-20 text-center">
                                <div className="flex flex-col items-center justify-center">
                                    <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-[2rem] mb-4">
                                        <User size={40} className="text-gray-300 dark:text-slate-600" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Nenhum contato cadastrado</p>
                                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">Sua agenda está vazia</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        contacts.map((contact) => (
                            <tr key={contact.id} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-all duration-300">
                                <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        disabled={!contact.email || contact.email.trim() === ""}
                                        onClick={() => onToggleSelect(contact.id)}
                                        className="p-1 text-gray-400 disabled:opacity-30 hover:text-blue-500"
                                    >
                                        {selectedIds.includes(contact.id) ? (
                                            <CheckSquare size={18} className="text-blue-600" />
                                        ) : (
                                            <Square size={18} />
                                        )}
                                    </button>
                                </td>
                                <td className="px-6 py-4 font-medium">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-2xl shadow-sm ${contact.type === 'client'
                                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                            : contact.type === 'supplier'
                                            ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            }`}>
                                            {contact.type === 'client' || contact.type === 'both' ? <User size={18} /> : <Truck size={18} />}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 dark:text-white">{contact.name}</span>
                                                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${
                                                    contact.entity_type === 'PJ'
                                                    ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-900/30 dark:text-indigo-400'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:border-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {contact.entity_type || 'PF'}
                                                </span>
                                                {isLoyaltyEnabled && contact.loyalty_subscriptions?.[0] && (
                                                    <Tooltip content={
                                                        contact.loyalty_subscriptions[0].status === 'pending'
                                                        ? "Pagamento pendente no Gateway."
                                                        : `Plano: ${contact.loyalty_subscriptions[0].plan?.name || 'Clube VIP'}`
                                                    }>
                                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                                                            contact.loyalty_subscriptions[0].status === 'active' 
                                                            ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30' 
                                                            : 'bg-blue-50 text-blue-600 border-blue-100'
                                                        }`}>
                                                            <Award size={10} />
                                                            {contact.loyalty_subscriptions[0].status === 'active' ? 'VIP' : 'PENDENTE'}
                                                        </div>
                                                    </Tooltip>
                                                )}
                                            </div>
                                            {contact.tax_id && (
                                                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">{contact.tax_id}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="md:hidden text-xs text-gray-500 mt-2 ml-14">
                                        {contact.email} {contact.phone && `• ${contact.phone}`}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${contact.type === 'client'
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                                        : contact.type === 'supplier'
                                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/30'
                                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                                        }`}>
                                        {contact.type === 'client' ? 'Cliente' : contact.type === 'supplier' ? 'Fornecedor' : 'Ambos'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 hidden md:table-cell text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col gap-0.5">
                                        {contact.email && <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{contact.email}</span>}
                                        {(contact.phone || contact.whatsapp) && (
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                                                {contact.whatsapp || contact.phone}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Tooltip content="Ver Histórico">
                                            <button
                                                onClick={() => onViewHistory(contact)}
                                                className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 transition-all shadow-sm shadow-emerald-500/10"
                                            >
                                                <History size={16} />
                                            </button>
                                        </Tooltip>
                                        <Tooltip content="Editar">
                                            <button
                                                onClick={() => onEdit(contact)}
                                                className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition-all shadow-sm shadow-blue-500/10"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </Tooltip>
                                        {canDelete && (
                                            <Tooltip content="Excluir">
                                                <button
                                                    onClick={() => onDelete(contact.id)}
                                                    className="p-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-100 transition-all shadow-sm shadow-rose-500/10"
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
