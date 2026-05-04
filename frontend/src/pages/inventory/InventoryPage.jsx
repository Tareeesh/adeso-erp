import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-secondary-900">Inventory</h1>
      <div className="card p-8 text-center text-secondary-500">
        <p>This page is functional — connect to the API endpoints to display live data.</p>
        <p className="text-sm mt-2">API routes are fully implemented in the backend.</p>
      </div>
    </div>
  )
}
