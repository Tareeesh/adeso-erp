import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'

// Auth
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'

// Dashboard
import DashboardPage from './pages/dashboard/DashboardPage'

// Operations
import PurchaseListPage from './pages/operations/PurchaseListPage'
import PurchaseCreatePage from './pages/operations/PurchaseCreatePage'
import TravelListPage from './pages/operations/TravelListPage'
import TravelCreatePage from './pages/operations/TravelCreatePage'
import CabListPage from './pages/operations/CabListPage'
import CabCreatePage from './pages/operations/CabCreatePage'
import RFQListPage from './pages/operations/RFQListPage'
import RFQCreatePage from './pages/operations/RFQCreatePage'
import PurchaseOrderListPage from './pages/operations/PurchaseOrderListPage'
import PurchaseEditPage from './pages/operations/PurchaseEditPage'
import PaymentListPage from './pages/operations/PaymentListPage'
import PaymentCreatePage from './pages/operations/PaymentCreatePage'
import ExternalSignPage from './pages/sign/ExternalSignPage'

// HR
import EmployeesPage from './pages/hr/EmployeesPage'
import RecruitmentPage from './pages/hr/RecruitmentPage'
import OnboardingPage from './pages/hr/OnboardingPage'
import PerformancePage from './pages/hr/PerformancePage'

// Assets
import AssetsPage from './pages/assets/AssetsPage'
import AssetDetailPage from './pages/assets/AssetDetailPage'

// Inventory
import InventoryPage from './pages/inventory/InventoryPage'
import StoreRequestsPage from './pages/inventory/StoreRequestsPage'
import WarehousesPage from './pages/inventory/WarehousesPage'

// Documents
import DocumentDetailPage from './pages/documents/DocumentDetailPage'
import MyTasksPage from './pages/documents/MyTasksPage'

// Admin
import AdminPage from './pages/admin/AdminPage'
import CompaniesPage from './pages/admin/CompaniesPage'
import UsersPage from './pages/admin/UsersPage'

// Supplier Portal
import SupplierPortalPage from './pages/supplier/SupplierPortalPage'

const ProtectedRoute = ({ children, module }) => {
  const { user, loading, hasModule } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (module && !hasModule(module)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/supplier-portal/:token" element={<SupplierPortalPage />} />
          <Route path="/sign/:token" element={<ExternalSignPage />} />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="my-tasks" element={<MyTasksPage />} />
            <Route path="documents/:id" element={<DocumentDetailPage />} />

            <Route path="operations">
              <Route path="purchase" element={<ProtectedRoute module="operations"><PurchaseListPage /></ProtectedRoute>} />
              <Route path="purchase/new" element={<ProtectedRoute module="operations"><PurchaseCreatePage /></ProtectedRoute>} />
              <Route path="purchase/edit/:documentId" element={<ProtectedRoute module="operations"><PurchaseEditPage /></ProtectedRoute>} />
              <Route path="travel" element={<ProtectedRoute module="operations"><TravelListPage /></ProtectedRoute>} />
              <Route path="travel/new" element={<ProtectedRoute module="operations"><TravelCreatePage /></ProtectedRoute>} />
              <Route path="cab" element={<ProtectedRoute module="operations"><CabListPage /></ProtectedRoute>} />
              <Route path="cab/new" element={<ProtectedRoute module="operations"><CabCreatePage /></ProtectedRoute>} />
              <Route path="rfq" element={<ProtectedRoute module="operations"><RFQListPage /></ProtectedRoute>} />
              <Route path="rfq/new" element={<ProtectedRoute module="operations"><RFQCreatePage /></ProtectedRoute>} />
              <Route path="orders" element={<ProtectedRoute module="operations"><PurchaseOrderListPage /></ProtectedRoute>} />
              <Route path="payments" element={<ProtectedRoute module="operations"><PaymentListPage /></ProtectedRoute>} />
              <Route path="payments/new" element={<ProtectedRoute module="operations"><PaymentCreatePage /></ProtectedRoute>} />
            </Route>

            <Route path="hr">
              <Route path="employees" element={<ProtectedRoute module="hr"><EmployeesPage /></ProtectedRoute>} />
              <Route path="recruitment" element={<ProtectedRoute module="hr"><RecruitmentPage /></ProtectedRoute>} />
              <Route path="onboarding" element={<ProtectedRoute module="hr"><OnboardingPage /></ProtectedRoute>} />
              <Route path="performance" element={<ProtectedRoute module="hr"><PerformancePage /></ProtectedRoute>} />
            </Route>

            <Route path="assets">
              <Route index element={<ProtectedRoute module="assets"><AssetsPage /></ProtectedRoute>} />
              <Route path=":id" element={<ProtectedRoute module="assets"><AssetDetailPage /></ProtectedRoute>} />
            </Route>

            <Route path="inventory">
              <Route index element={<ProtectedRoute module="inventory"><InventoryPage /></ProtectedRoute>} />
              <Route path="store-requests" element={<ProtectedRoute module="inventory"><StoreRequestsPage /></ProtectedRoute>} />
              <Route path="warehouses" element={<ProtectedRoute module="inventory"><WarehousesPage /></ProtectedRoute>} />
            </Route>

            <Route path="admin">
              <Route index element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="companies" element={<ProtectedRoute><CompaniesPage /></ProtectedRoute>} />
              <Route path="users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
