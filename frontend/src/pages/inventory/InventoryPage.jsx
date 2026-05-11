import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { Archive, Search, Filter, AlertTriangle, Paperclip } from 'lucide-react'
import RecordAttachmentsModal from '../../components/common/RecordAttachmentsModal'

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [attachingRecord, setAttachingRecord] = useState(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => api.get('/inventory/items').then(r => r.data),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => api.get('/inventory/categories').then(r => r.data),
  })

  const filtered = items.filter(item => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      (item.name || '').toLowerCase().includes(q) ||
      (item.sku || '').toLowerCase().includes(q) ||
      (item.category_name || '').toLowerCase().includes(q)
    const matchCat = !categoryId || String(item.category_id) === categoryId
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <Archive size={24} className="text-primary-600" />
          Inventory
        </h1>
        <span className="text-sm text-secondary-500">{items.length} items</span>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, SKU or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-secondary-400" />
          <select
            className="input w-48"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <Archive size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">{search || categoryId ? 'No items match your filters' : 'No inventory items'}</p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-secondary-400 uppercase tracking-wide border-b border-secondary-100">
                  <th className="text-left px-4 py-3">Item</th>
                  <th className="text-left px-4 py-3">SKU</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Unit Price</th>
                  <th className="text-right px-4 py-3">Stock</th>
                  <th className="text-right px-4 py-3">Reorder Level</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {filtered.map(item => {
                  const lowStock = item.reorder_level != null && item.total_stock != null && item.total_stock <= item.reorder_level
                  return (
                    <tr key={item.id} className="hover:bg-secondary-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-secondary-900">{item.name}</p>
                        {item.unit_of_measure && (
                          <p className="text-xs text-secondary-400">per {item.unit_of_measure}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-secondary-500 font-mono text-xs">{item.sku || '—'}</td>
                      <td className="px-4 py-3 text-secondary-600">{item.category_name || '—'}</td>
                      <td className="px-4 py-3 text-right text-secondary-700">
                        {item.unit_price != null
                          ? `${item.currency || ''} ${Number(item.unit_price).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-secondary-900">
                        {item.total_stock ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-secondary-500">
                        {item.reorder_level ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {lowStock && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5 font-medium">
                              <AlertTriangle size={11} />Low stock
                            </span>
                          )}
                          {item.is_expirable && !lowStock && (
                            <span className="text-xs text-secondary-400 bg-secondary-100 rounded px-2 py-0.5">Expirable</span>
                          )}
                          <button
                            onClick={() => setAttachingRecord(item)}
                            className="p-1.5 rounded hover:bg-secondary-100 text-secondary-400 hover:text-primary-600"
                            title="Attachments"
                          >
                            <Paperclip size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <RecordAttachmentsModal
        isOpen={!!attachingRecord}
        onClose={() => setAttachingRecord(null)}
        recordType="inventory_item"
        recordId={attachingRecord?.id}
        title={attachingRecord?.name}
      />
    </div>
  )
}
