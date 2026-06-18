'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  RotateCcw,
  Plus,
  Upload,
  Edit,
  Trash2,
  Users,
  Package,
  LayoutDashboard,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Save,
  X,
  FileUp,
  Download,
  Shield,
  Key,
  Building2,
  Warehouse,
  Database,
  AlertTriangle,
  RefreshCw,
  BoxIcon,
  Scissors,
  Ruler,
  Truck,
  UserCircle,
  ChevronDown,
  ArrowRightLeft,
  ArrowDownToLine,
  ShoppingCart,
  DollarSign,
  FileText,
  TrendingUp,
  BarChart3,
  Settings2,
  ArrowUpDown,
  Store,
  ClipboardList,
  Receipt,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from 'recharts'

// Types
interface ColumnAccess { columnName: string; canView: boolean }
interface EntityAccess { entityId: string; entityName: string }
interface MenuAccess { menuKey: string; visible: boolean }
interface MasterDataAccess { masterDataKey: string; visible: boolean }
interface EntityData { id: string; name: string; description?: string; _count?: { stocks: number; userAccess: number } }

interface UserData {
  id: string; username: string; displayName: string; role: string
  canCreateItem: boolean; canModifyItem: boolean
  columnAccess: ColumnAccess[]; entityAccess: EntityAccess[]; menuAccess: MenuAccess[]
  masterDataAccess?: MasterDataAccess[]
}

interface ItemData {
  id?: string; serial?: number; year?: string; lcNo?: string
  group?: string; subGroup?: string; itemName?: string
  price?: number; uom?: string; stockQty?: number
}

interface StockDetail { id: string; entityId: string; entityName: string; quantity: number }

interface TailorData { id: string; name: string; phone: string; address: string; specialization: string; status: string }
interface MakingInfoData { id: string; name: string; description: string; cost: number; unit: string; status: string }
interface UoMData { id: string; name: string; description: string }
interface SupplierData { id: string; name: string; phone: string; email: string; address: string; status: string; _count?: { items: number } }
interface CustomerData { id: string; name: string; phone: string; email: string; address: string; type: string; status: string }

interface ItemAdjustmentData { id: string; itemId: string; itemName: string; entityId: string; entityName: string; adjustmentType: string; quantity: number; reason: string; createdBy?: string; createdAt: string }
interface TransferData { id: string; itemId: string; itemName: string; fromEntityId: string; fromEntityName: string; toEntityId: string; toEntityName: string; quantity: number; status: string; notes?: string; createdAt: string }
interface ReceiveData { id: string; itemId: string; itemName: string; entityId: string; entityName: string; quantity: number; sourceEntityId?: string; sourceEntityName?: string; referenceNo?: string; notes?: string; createdAt: string }
interface SalesOrderData { id: string; itemId: string; itemName: string; entityId: string; entityName: string; customerId: string; customerName: string; quantity: number; price: number; makingCharge: number; deliveryDate?: string; status: string; notes?: string; createdAt: string }
interface SalesReturnData { id: string; itemId: string; itemName: string; entityId: string; entityName: string; customerId: string; customerName: string; quantity: number; price: number; reason: string; status: string; createdAt: string }
interface IncentiveData { id: string; itemId: string; itemName: string; entityId: string; entityName: string; tailorId?: string; tailorName?: string; amount: number; type: string; status: string; notes?: string; createdAt: string }

// Report types
interface ReportStock {
  totalItems: number; totalQty: number; totalValue: number
  topItems: { itemId: string; itemName: string; qty: number; value: number; uom: string }[]
  entityStock: { entityName: string; qty: number; value: number }[]
  lowStock: { itemId: string; itemName: string; qty: number; value: number; uom: string }[]
}
interface ReportSales {
  orderCount: number; returnCount: number; grossRevenue: number; returnsValue: number; netRevenue: number
  totalUnitsSold: number; totalUnitsReturned: number
  trend: { date: string; revenue: number; returns: number }[]
  byStatus: { key: string; count: number }[]
  byCustomer: { name: string; value: number }[]
  byItem: { name: string; value: number; qty: number }[]
  recentOrders: { id: string; itemName: string; entityName: string; customerName: string; quantity: number; price: number; makingCharge: number; total: number; status: string; createdAt: string }[]
}
interface ReportTransfer {
  totalCount: number; totalQty: number
  byStatus: { key: string; count: number }[]
  byFromEntity: { name: string; value: number }[]
  byToEntity: { name: string; value: number }[]
  trend: { date: string; value: number; count: number }[]
  recent: { id: string; itemName: string; fromEntity: string; toEntity: string; quantity: number; status: string; createdAt: string }[]
}
interface ReportAdjustment {
  totalCount: number; totalIncrease: number; totalDecrease: number
  byType: { key: string; count: number }[]
  byEntity: { name: string; value: number }[]
  trend: { date: string; value: number; count: number }[]
  recent: { id: string; itemName: string; entityName: string; adjustmentType: string; quantity: number; reason: string; createdAt: string }[]
}
interface ReportIncentive {
  totalCount: number; totalAmount: number; paidAmount: number; pendingAmount: number
  byType: { key: string; count: number }[]
  byStatus: { key: string; count: number }[]
  byTailor: { name: string; value: number; count: number }[]
  trend: { date: string; value: number; count: number }[]
  recent: { id: string; itemName: string; entityName: string; tailorName: string; amount: number; type: string; status: string; createdAt: string }[]
}
interface ReportData {
  from: string; to: string
  stock: ReportStock | null
  sales: ReportSales | null
  transfer: ReportTransfer | null
  adjustment: ReportAdjustment | null
  incentive: ReportIncentive | null
}

type ViewType =
  | 'entitySelect'
  | 'itemPrice' | 'myEntityStock' | 'allEntityStock'
  | 'itemAdjustment' | 'transfer' | 'receive'
  | 'salesOrder' | 'salesReturn'
  | 'incentive' | 'reports'
  | 'items' | 'newItem' | 'editItem' | 'upload'
  | 'users' | 'entities'
  | 'tailors' | 'makingInfo' | 'uom' | 'suppliers' | 'customers'
  | 'stockDetail' | 'stockEntry' | 'stockUpload'
  | 'settings'

const ALL_COLUMNS = [
  { key: 'serial', label: 'Serial', alwaysVisible: true },
  { key: 'year', label: 'Year' },
  { key: 'lcNo', label: 'LC No' },
  { key: 'group', label: 'Group' },
  { key: 'subGroup', label: 'Sub Group' },
  { key: 'itemName', label: 'Item Name' },
  { key: 'price', label: 'Price' },
  { key: 'uom', label: 'UoM' },
  { key: 'stockQty', label: 'Stock' },
]

const ALL_MENU_ITEMS = [
  { key: 'itemPrice', label: 'Item Price', group: 'Function' },
  { key: 'myEntityStock', label: 'My Entity Stock', group: 'Stock View' },
  { key: 'allEntityStock', label: 'All Entity Stock', group: 'Stock View' },
  { key: 'itemAdjustment', label: 'Item Adjustment', group: 'Function' },
  { key: 'transfer', label: 'Transfer', group: 'Function' },
  { key: 'receive', label: 'Receive', group: 'Function' },
  { key: 'salesOrder', label: 'Sales Order', group: 'Sales' },
  { key: 'salesReturn', label: 'Sales Return', group: 'Sales' },
  { key: 'incentive', label: 'Incentive', group: 'Function' },
  { key: 'reports', label: 'Reports', group: 'Function' },
]

// Master Data sub-pages that can be granted/revoked per user
const ALL_MASTER_DATA_ITEMS = [
  { key: 'items', label: 'Item Information' },
  { key: 'newItem', label: 'New Item' },
  { key: 'upload', label: 'Upload CSV' },
  { key: 'entities', label: 'Entity' },
  { key: 'users', label: 'Users' },
  { key: 'tailors', label: 'Tailors' },
  { key: 'makingInfo', label: 'Making Information' },
  { key: 'uom', label: 'UoM' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'customers', label: 'Customer Database' },
]

// Auth-aware fetch helper: always sends token via Authorization header + credentials
function getAuthHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const h: Record<string, string> = { ...headers }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = getAuthHeaders(
    options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : Array.isArray(options.headers)
        ? Object.fromEntries(options.headers as [string, string][])
        : (options.headers as Record<string, string>) || {}
  )
  const res = await fetch(url, { ...options, headers, credentials: 'include' })
  // Auto-logout on 401 ONLY if user had a token (session expired while logged in)
  // Don't reload if no token existed (user simply isn't logged in yet)
  if (res.status === 401) {
    const hadToken = !!localStorage.getItem('auth_token')
    localStorage.removeItem('auth_token')
    if (hadToken) {
      // Session expired while user was logged in - force reload to show login
      window.location.reload()
    }
  }
  return res
}

export default function Home() {
  const [user, setUser] = useState<UserData | null>(null)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [currentView, setCurrentView] = useState<ViewType>('items')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [masterDataOpen, setMasterDataOpen] = useState(true)
  const [stockViewOpen, setStockViewOpen] = useState(false)
  const [salesOpen, setSalesOpen] = useState(false)

  // Working entity (selected after login)
  const [workingEntity, setWorkingEntity] = useState<{ id: string; name: string } | null>(null)

  // Transaction state
  const [adjustments, setAdjustments] = useState<ItemAdjustmentData[]>([])
  const [adjustmentForm, setAdjustmentForm] = useState({ itemId: '', adjustmentType: 'increase', quantity: '', reason: '' })
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false)

  const [transfers, setTransfers] = useState<TransferData[]>([])
  const [transferForm, setTransferForm] = useState({ itemId: '', toEntityId: '', quantity: '', notes: '' })
  const [showTransferDialog, setShowTransferDialog] = useState(false)

  const [receives, setReceives] = useState<ReceiveData[]>([])
  const [receiveForm, setReceiveForm] = useState({ itemId: '', quantity: '', sourceEntityId: '', referenceNo: '', notes: '' })
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)

  const [salesOrders, setSalesOrders] = useState<SalesOrderData[]>([])
  const [salesOrderForm, setSalesOrderForm] = useState({ itemId: '', customerId: '', quantity: '', price: '', makingCharge: '0', deliveryDate: '', notes: '' })
  const [showSalesOrderDialog, setShowSalesOrderDialog] = useState(false)

  const [salesReturns, setSalesReturns] = useState<SalesReturnData[]>([])
  const [salesReturnForm, setSalesReturnForm] = useState({ itemId: '', customerId: '', salesOrderId: '', quantity: '', price: '', reason: '' })
  const [showSalesReturnDialog, setShowSalesReturnDialog] = useState(false)

  const [incentives, setIncentives] = useState<IncentiveData[]>([])
  const [incentiveForm, setIncentiveForm] = useState({ itemId: '', tailorId: '', amount: '', type: 'tailor', notes: '' })
  const [showIncentiveDialog, setShowIncentiveDialog] = useState(false)

  // Item search for transaction forms
  const [txItemSearch, setTxItemSearch] = useState('')
  const [txItemResults, setTxItemResults] = useState<ItemData[]>([])
  const [txItemLoading, setTxItemLoading] = useState(false)

  // Items state
  const [items, setItems] = useState<ItemData[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalPages, setTotalPages] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all')

  // Entity state
  const [entities, setEntities] = useState<EntityData[]>([])
  const [entityForm, setEntityForm] = useState({ name: '', description: '' })
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null)
  const [showEntityDialog, setShowEntityDialog] = useState(false)

  // Item form state
  const [itemForm, setItemForm] = useState({ year: '', lcNo: '', group: '', subGroup: '', itemName: '', price: '', uom: 'PCS' })
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Users state
  const [users, setUsers] = useState<UserData[]>([])
  const [userForm, setUserForm] = useState({ username: '', password: '', displayName: '', role: 'user', canCreateItem: false, canModifyItem: false })
  const [userEntityIds, setUserEntityIds] = useState<string[]>([])
  const [userMenuAccess, setUserMenuAccess] = useState<MenuAccess[]>(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true })))
  const [userMasterDataAccess, setUserMasterDataAccess] = useState<MasterDataAccess[]>(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true })))
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [columnAccessForm, setColumnAccessForm] = useState<ColumnAccess[]>([])
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [showColumnDialog, setShowColumnDialog] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Stock detail state
  const [stockDetailItem, setStockDetailItem] = useState<ItemData | null>(null)
  const [stockDetails, setStockDetails] = useState<StockDetail[]>([])
  const [stockForm, setStockForm] = useState({ itemId: '', entityId: '', quantity: '' })
  const [showStockDialog, setShowStockDialog] = useState(false)

  // Stock entry state (standalone page)
  const [stockEntryForm, setStockEntryForm] = useState({ itemNameSearch: '', itemId: '', entityId: '', quantity: '' })
  const [stockEntryItems, setStockEntryItems] = useState<ItemData[]>([])
  const [stockEntryLoading, setStockEntryLoading] = useState(false)

  // Stock upload state
  const [stockUploadFile, setStockUploadFile] = useState<File | null>(null)
  const [stockUploading, setStockUploading] = useState(false)

  // Master Data state
  const [tailors, setTailors] = useState<TailorData[]>([])
  const [tailorForm, setTailorForm] = useState({ name: '', phone: '', address: '', specialization: '', status: 'active' })
  const [editingTailorId, setEditingTailorId] = useState<string | null>(null)
  const [showTailorDialog, setShowTailorDialog] = useState(false)

  const [makingInfoList, setMakingInfoList] = useState<MakingInfoData[]>([])
  const [makingInfoForm, setMakingInfoForm] = useState({ name: '', description: '', cost: '', unit: 'PCS', status: 'active' })
  const [editingMakingInfoId, setEditingMakingInfoId] = useState<string | null>(null)
  const [showMakingInfoDialog, setShowMakingInfoDialog] = useState(false)

  const [uomList, setUomList] = useState<UoMData[]>([])
  const [uomForm, setUomForm] = useState({ name: '', description: '' })
  const [editingUomId, setEditingUomId] = useState<string | null>(null)
  const [showUomDialog, setShowUomDialog] = useState(false)

  const [suppliers, setSuppliers] = useState<SupplierData[]>([])
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', address: '', status: 'active' })
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const [showSupplierDialog, setShowSupplierDialog] = useState(false)

  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', address: '', type: 'regular', status: 'active' })
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [showCustomerDialog, setShowCustomerDialog] = useState(false)

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Export state (for Excel download)
  const [exporting, setExporting] = useState(false)

  // Reports state
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportTab, setReportTab] = useState<'overview' | 'stock' | 'sales' | 'transfer' | 'adjustment' | 'incentive'>('overview')
  const [reportRange, setReportRange] = useState<'7' | '30' | '90' | '365' | 'all'>('30')
  const [reportEntity, setReportEntity] = useState<string>('__all__') // '__all__' = all my entities

  const { toast } = useToast()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await authFetch('/api/auth/me')
      if (res.ok) { const data = await res.json(); setUser(data.user) }
      else { localStorage.removeItem('auth_token') }
    } catch { /* not authenticated */ } finally { setIsLoading(false) }
  }

  useEffect(() => {
    if (user) { fetchItems() }
  }, [user, currentPage, searchQuery, selectedEntityId])

  useEffect(() => {
    if (user) { fetchEntities() }
  }, [user])

  const fetchItems = useCallback(async () => {
    setItemsLoading(true)
    try {
      const params = new URLSearchParams({ page: currentPage.toString(), pageSize: pageSize.toString(), search: searchQuery, entityId: selectedEntityId === 'all' ? '' : selectedEntityId })
      const res = await authFetch(`/api/items?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items); setTotalItems(data.total); setTotalPages(data.totalPages); setVisibleColumns(data.visibleColumns)
      }
    } catch { toast({ title: 'Error', description: 'Failed to fetch items', variant: 'destructive' }) }
    finally { setItemsLoading(false) }
  }, [currentPage, pageSize, searchQuery, selectedEntityId, toast])

  const fetchEntities = useCallback(async () => {
    try {
      const res = await authFetch('/api/entities')
      if (res.ok) { const data = await res.json(); setEntities(data.entities) }
    } catch { /* ignore */ }
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await authFetch('/api/users')
      if (res.ok) { const data = await res.json(); setUsers(data.users) }
    } catch { toast({ title: 'Error', description: 'Failed to fetch users', variant: 'destructive' }) }
  }

  useEffect(() => {
    if (currentView === 'users' && user?.role === 'admin') fetchUsers()
  }, [currentView, user])

  // Auth handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginError('')
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUsername, password: loginPassword }) })
      const data = await res.json()
      if (res.ok) { localStorage.setItem('auth_token', data.token); setUser(data.user); setLoginUsername(''); setLoginPassword('') }
      else { setLoginError(data.error || 'Login failed') }
    } catch { setLoginError('Network error') }
  }

  const handleLogout = async () => {
    await authFetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('auth_token')
    setUser(null); setWorkingEntity(null); setCurrentView('entitySelect')
  }

  // Item handlers
  const handleSearch = () => { setCurrentPage(1); fetchItems() }
  const handleSearchReset = () => { setSearchQuery(''); setCurrentPage(1); setSelectedEntityId('all') }

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await authFetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemForm) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: 'Item created successfully' }); setItemForm({ year: '', lcNo: '', group: '', subGroup: '', itemName: '', price: '', uom: 'PCS' }); setCurrentView('items'); fetchItems() }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to create item', variant: 'destructive' }) }
  }

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItemId) return
    try {
      const res = await authFetch(`/api/items/${editingItemId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemForm) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: 'Item updated' }); setEditingItemId(null); setItemForm({ year: '', lcNo: '', group: '', subGroup: '', itemName: '', price: '', uom: 'PCS' }); setCurrentView('items'); fetchItems() }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' }) }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    try {
      const res = await authFetch(`/api/items/${id}`, { method: 'DELETE' })
      if (res.ok) { toast({ title: 'Success', description: 'Item deleted' }); fetchItems() }
      else { const data = await res.json(); toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' }) }
  }

  const handleEditItem = (item: ItemData) => {
    setEditingItemId(item.id || null)
    setItemForm({ year: item.year || '', lcNo: item.lcNo || '', group: item.group || '', subGroup: item.subGroup || '', itemName: item.itemName || '', price: item.price?.toString() || '', uom: item.uom || 'PCS' })
    setCurrentView('editItem')
  }

  // Stock handlers
  const handleViewStock = async (item: ItemData) => {
    if (!item.id) return
    setStockDetailItem(item)
    try {
      const res = await authFetch(`/api/stock/${item.id}`)
      if (res.ok) {
        const data = await res.json()
        const details: StockDetail[] = data.stocks.map((s: { id: string; entityId: string; entity: { name: string }; quantity: number }) => ({
          id: s.id, entityId: s.entityId, entityName: s.entity.name, quantity: s.quantity,
        }))
        setStockDetails(details)
      }
    } catch { /* ignore */ }
    setCurrentView('stockDetail')
  }

  const handleSaveStock = async () => {
    if (!stockForm.itemId || !stockForm.entityId || stockForm.quantity === '') return
    try {
      const res = await authFetch('/api/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stockForm) })
      if (res.ok) { toast({ title: 'Success', description: 'Stock updated' }); setShowStockDialog(false); handleViewStock(stockDetailItem!); fetchItems() }
      else { const data = await res.json(); toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to update stock', variant: 'destructive' }) }
  }

  const handleDeleteStock = async (id: string) => {
    if (!confirm('Delete this stock entry?')) return
    try {
      const res = await authFetch(`/api/stock/${id}`, { method: 'DELETE' })
      if (res.ok) { toast({ title: 'Success', description: 'Stock entry deleted' }); if (stockDetailItem) handleViewStock(stockDetailItem); fetchItems() }
    } catch { /* ignore */ }
  }

  // Stock entry search handler
  const handleStockItemSearch = useCallback(async () => {
    if (!stockEntryForm.itemNameSearch.trim()) return
    setStockEntryLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '20', search: stockEntryForm.itemNameSearch })
      const res = await authFetch(`/api/items?${params}`)
      if (res.ok) {
        const data = await res.json()
        setStockEntryItems(data.items)
      }
    } catch { /* ignore */ }
    finally { setStockEntryLoading(false) }
  }, [stockEntryForm.itemNameSearch])

  const handleStockEntrySave = async () => {
    if (!stockEntryForm.itemId || !stockEntryForm.entityId || stockEntryForm.quantity === '') {
      toast({ title: 'Error', description: 'Please select an item, entity, and enter quantity', variant: 'destructive' })
      return
    }
    try {
      const res = await authFetch('/api/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stockEntryForm) })
      if (res.ok) {
        toast({ title: 'Success', description: 'Stock entry saved successfully' })
        setStockEntryForm({ itemNameSearch: '', itemId: '', entityId: '', quantity: '' })
        setStockEntryItems([])
        fetchItems()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Failed to save stock entry', variant: 'destructive' }) }
  }

  // Stock upload handler
  const handleStockUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockUploadFile) { toast({ title: 'Error', description: 'Select a CSV file', variant: 'destructive' }); return }
    setStockUploading(true)
    try {
      const formData = new FormData(); formData.append('file', stockUploadFile)
      const res = await authFetch('/api/stock/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Success', description: `Uploaded ${data.upserted} stock entries${data.skipped > 0 ? `, skipped ${data.skipped}` : ''}` })
        setStockUploadFile(null)
        setCurrentView('items')
        fetchItems()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' }) }
    finally { setStockUploading(false) }
  }

  // Master Data fetch & handlers
  const fetchTailors = async () => { try { const res = await authFetch('/api/tailors'); if (res.ok) { const d = await res.json(); setTailors(d.tailors) } } catch {} }
  const fetchMakingInfo = async () => { try { const res = await authFetch('/api/making-info'); if (res.ok) { const d = await res.json(); setMakingInfoList(d.makingInfo) } } catch {} }
  const fetchUom = async () => { try { const res = await authFetch('/api/uom'); if (res.ok) { const d = await res.json(); setUomList(d.uomList) } } catch {} }
  const fetchSuppliers = async () => { try { const res = await authFetch('/api/suppliers'); if (res.ok) { const d = await res.json(); setSuppliers(d.suppliers) } } catch {} }
  const fetchCustomers = async () => { try { const res = await authFetch('/api/customers'); if (res.ok) { const d = await res.json(); setCustomers(d.customers) } } catch {} }

  // Transaction fetch handlers
  const fetchAdjustments = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/item-adjustments?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setAdjustments(d.adjustments.map((a: any) => ({ ...a, itemName: a.item?.itemName || '', entityName: a.entity?.name || '' }))) } } catch {} }
  const fetchTransfers = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/transfers?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setTransfers(d.transfers.map((t: any) => ({ ...t, itemName: t.item?.itemName || '', fromEntityName: t.fromEntity?.name || '', toEntityName: t.toEntity?.name || '' }))) } } catch {} }
  const fetchReceives = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/receives?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setReceives(d.receives.map((r: any) => ({ ...r, itemName: r.item?.itemName || '', entityName: r.entity?.name || '', sourceEntityName: r.sourceEntity?.name || '' }))) } } catch {} }
  const fetchSalesOrders = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/sales-orders?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setSalesOrders(d.salesOrders.map((s: any) => ({ ...s, itemName: s.item?.itemName || '', entityName: s.entity?.name || '', customerName: s.customer?.name || '' }))) } } catch {} }
  const fetchSalesReturns = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/sales-returns?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setSalesReturns(d.salesReturns.map((s: any) => ({ ...s, itemName: s.item?.itemName || '', entityName: s.entity?.name || '', customerName: s.customer?.name || '' }))) } } catch {} }
  const fetchIncentives = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/incentives?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setIncentives(d.incentives.map((i: any) => ({ ...i, itemName: i.item?.itemName || '', entityName: i.entity?.name || '', tailorName: i.tailor?.name || '' }))) } } catch {} }

  // Transaction item search
  const handleTxItemSearch = useCallback(async () => {
    if (!txItemSearch.trim()) return
    setTxItemLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '20', search: txItemSearch })
      const res = await authFetch(`/api/items?${params}`)
      if (res.ok) { const data = await res.json(); setTxItemResults(data.items) }
    } catch {} finally { setTxItemLoading(false) }
  }, [txItemSearch])

  // Transaction save handlers
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !adjustmentForm.itemId || !adjustmentForm.quantity) return
    try {
      const res = await authFetch('/api/item-adjustments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...adjustmentForm, entityId: workingEntity.id, quantity: parseInt(adjustmentForm.quantity) }) })
      if (res.ok) { toast({ title: 'Success', description: 'Adjustment saved' }); setShowAdjustmentDialog(false); setAdjustmentForm({ itemId: '', adjustmentType: 'increase', quantity: '', reason: '' }); fetchAdjustments() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !transferForm.itemId || !transferForm.toEntityId || !transferForm.quantity) return
    try {
      const res = await authFetch('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...transferForm, fromEntityId: workingEntity.id, quantity: parseInt(transferForm.quantity) }) })
      if (res.ok) { toast({ title: 'Success', description: 'Transfer created' }); setShowTransferDialog(false); setTransferForm({ itemId: '', toEntityId: '', quantity: '', notes: '' }); fetchTransfers() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  const handleSaveReceive = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !receiveForm.itemId || !receiveForm.quantity) return
    try {
      const res = await authFetch('/api/receives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...receiveForm, entityId: workingEntity.id, quantity: parseInt(receiveForm.quantity), sourceEntityId: receiveForm.sourceEntityId || undefined }) })
      if (res.ok) { toast({ title: 'Success', description: 'Receive saved' }); setShowReceiveDialog(false); setReceiveForm({ itemId: '', quantity: '', sourceEntityId: '', referenceNo: '', notes: '' }); fetchReceives() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  const handleSaveSalesOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !salesOrderForm.itemId || !salesOrderForm.customerId || !salesOrderForm.quantity) return
    try {
      const res = await authFetch('/api/sales-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...salesOrderForm, entityId: workingEntity.id, quantity: parseInt(salesOrderForm.quantity), price: parseFloat(salesOrderForm.price), makingCharge: parseFloat(salesOrderForm.makingCharge), deliveryDate: salesOrderForm.deliveryDate || undefined }) })
      if (res.ok) { toast({ title: 'Success', description: 'Sales order created' }); setShowSalesOrderDialog(false); setSalesOrderForm({ itemId: '', customerId: '', quantity: '', price: '', makingCharge: '0', deliveryDate: '', notes: '' }); fetchSalesOrders() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  const handleSaveSalesReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !salesReturnForm.itemId || !salesReturnForm.customerId || !salesReturnForm.quantity) return
    try {
      const res = await authFetch('/api/sales-returns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...salesReturnForm, entityId: workingEntity.id, quantity: parseInt(salesReturnForm.quantity), price: parseFloat(salesReturnForm.price), salesOrderId: salesReturnForm.salesOrderId || undefined }) })
      if (res.ok) { toast({ title: 'Success', description: 'Sales return created' }); setShowSalesReturnDialog(false); setSalesReturnForm({ itemId: '', customerId: '', salesOrderId: '', quantity: '', price: '', reason: '' }); fetchSalesReturns() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  const handleSaveIncentive = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !incentiveForm.itemId || !incentiveForm.amount) return
    try {
      const res = await authFetch('/api/incentives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...incentiveForm, entityId: workingEntity.id, amount: parseFloat(incentiveForm.amount), tailorId: incentiveForm.tailorId || undefined }) })
      if (res.ok) { toast({ title: 'Success', description: 'Incentive saved' }); setShowIncentiveDialog(false); setIncentiveForm({ itemId: '', tailorId: '', amount: '', type: 'tailor', notes: '' }); fetchIncentives() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  useEffect(() => { if (currentView === 'tailors') fetchTailors() }, [currentView])
  useEffect(() => { if (currentView === 'makingInfo') fetchMakingInfo() }, [currentView])
  useEffect(() => { if (currentView === 'uom') fetchUom() }, [currentView])
  useEffect(() => { if (currentView === 'suppliers') fetchSuppliers() }, [currentView])
  useEffect(() => { if (currentView === 'customers') fetchCustomers() }, [currentView])
  useEffect(() => { if (currentView === 'itemAdjustment') fetchAdjustments() }, [currentView])
  useEffect(() => { if (currentView === 'transfer') fetchTransfers() }, [currentView])
  useEffect(() => { if (currentView === 'receive') fetchReceives() }, [currentView])
  useEffect(() => { if (currentView === 'salesOrder') fetchSalesOrders() }, [currentView])
  useEffect(() => { if (currentView === 'salesReturn') fetchSalesReturns() }, [currentView])
  useEffect(() => { if (currentView === 'incentive') fetchIncentives() }, [currentView])

  // Reports fetch
  const fetchReports = useCallback(async () => {
    setReportLoading(true)
    try {
      const params = new URLSearchParams()
      const entityId = reportEntity === '__all__' ? '' : reportEntity
      if (entityId) params.set('entityId', entityId)
      if (reportRange !== 'all') {
        const days = parseInt(reportRange)
        const to = new Date()
        const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
        params.set('from', from.toISOString())
        params.set('to', to.toISOString())
      }
      const res = await authFetch(`/api/reports?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReportData(data as ReportData)
      } else {
        toast({ title: 'Error', description: 'Failed to load reports', variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Failed to load reports', variant: 'destructive' }) }
    finally { setReportLoading(false) }
  }, [reportEntity, reportRange, toast])

  useEffect(() => { if (currentView === 'reports' && user) fetchReports() }, [currentView, user, reportRange, reportEntity])

  const handleSaveTailor = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = editingTailorId
        ? await authFetch(`/api/tailors/${editingTailorId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tailorForm) })
        : await authFetch('/api/tailors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tailorForm) })
      if (res.ok) { toast({ title: 'Success', description: editingTailorId ? 'Tailor updated' : 'Tailor created' }); setShowTailorDialog(false); setTailorForm({ name: '', phone: '', address: '', specialization: '', status: 'active' }); setEditingTailorId(null); fetchTailors() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const handleDeleteTailor = async (id: string) => { if (!confirm('Delete this tailor?')) return; try { const res = await authFetch(`/api/tailors/${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Deleted' }); fetchTailors() } } catch {} }

  const handleSaveMakingInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = editingMakingInfoId
        ? await authFetch(`/api/making-info/${editingMakingInfoId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makingInfoForm) })
        : await authFetch('/api/making-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makingInfoForm) })
      if (res.ok) { toast({ title: 'Success', description: editingMakingInfoId ? 'Making info updated' : 'Making info created' }); setShowMakingInfoDialog(false); setMakingInfoForm({ name: '', description: '', cost: '', unit: 'PCS', status: 'active' }); setEditingMakingInfoId(null); fetchMakingInfo() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const handleDeleteMakingInfo = async (id: string) => { if (!confirm('Delete?')) return; try { const res = await authFetch(`/api/making-info/${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Deleted' }); fetchMakingInfo() } } catch {} }

  const handleSaveUom = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = editingUomId
        ? await authFetch(`/api/uom/${editingUomId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uomForm) })
        : await authFetch('/api/uom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uomForm) })
      if (res.ok) { toast({ title: 'Success', description: editingUomId ? 'UoM updated' : 'UoM created' }); setShowUomDialog(false); setUomForm({ name: '', description: '' }); setEditingUomId(null); fetchUom() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const handleDeleteUom = async (id: string) => { if (!confirm('Delete?')) return; try { const res = await authFetch(`/api/uom/${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Deleted' }); fetchUom() } } catch {} }

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = editingSupplierId
        ? await authFetch(`/api/suppliers/${editingSupplierId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(supplierForm) })
        : await authFetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(supplierForm) })
      if (res.ok) { toast({ title: 'Success', description: editingSupplierId ? 'Supplier updated' : 'Supplier created' }); setShowSupplierDialog(false); setSupplierForm({ name: '', phone: '', email: '', address: '', status: 'active' }); setEditingSupplierId(null); fetchSuppliers() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const handleDeleteSupplier = async (id: string) => { if (!confirm('Delete?')) return; try { const res = await authFetch(`/api/suppliers/${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Deleted' }); fetchSuppliers() } } catch {} }

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = editingCustomerId
        ? await authFetch(`/api/customers/${editingCustomerId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customerForm) })
        : await authFetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customerForm) })
      if (res.ok) { toast({ title: 'Success', description: editingCustomerId ? 'Customer updated' : 'Customer created' }); setShowCustomerDialog(false); setCustomerForm({ name: '', phone: '', email: '', address: '', type: 'regular', status: 'active' }); setEditingCustomerId(null); fetchCustomers() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const handleDeleteCustomer = async (id: string) => { if (!confirm('Delete?')) return; try { const res = await authFetch(`/api/customers/${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Deleted' }); fetchCustomers() } } catch {} }

  // Upload handler
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) { toast({ title: 'Error', description: 'Select a CSV file', variant: 'destructive' }); return }
    setUploading(true)
    try {
      const formData = new FormData(); formData.append('file', uploadFile)
      const res = await authFetch('/api/items/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        const parts = [`Uploaded ${data.inserted} items`]
        if (data.duplicate > 0) parts.push(`${data.duplicate} duplicates skipped`)
        if (data.skipped > 0) parts.push(`${data.skipped} skipped`)
        toast({ title: 'Success', description: parts.join(', ') })
        setUploadFile(null); setCurrentView('items'); fetchItems()
      }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' }) }
    finally { setUploading(false) }
  }

  // Download items CSV template
  const downloadItemsTemplate = () => {
    const csv = 'year,lcNo,group,subGroup,itemName,price,uom\n' +
                '2024,LC-2024-0001,Electronics,Mobile,Samsung Galaxy S23,75000.00,PCS\n' +
                '2024,LC-2024-0002,Electronics,Laptop,Dell Inspiron 15,55000.00,PCS\n' +
                '2024,LC-2024-0003,Hardware,Hinge,Concealed Hinge,80.50,KG\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'items-upload-format.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({ title: 'Downloaded', description: 'items-upload-format.csv' })
  }

  // Export items to Excel/CSV — downloads all items (respecting search + entity filters)
  const handleExportItems = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (selectedEntityId && selectedEntityId !== 'all') params.set('entityId', selectedEntityId)
      params.set('format', 'xlsx')

      const res = await authFetch(`/api/items/export?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Export failed' }))
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }

      // Get the binary data and trigger download
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      // Extract filename from Content-Disposition header, fallback to default
      const disposition = res.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
      link.download = filenameMatch ? filenameMatch[1] : `items-export-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({ title: 'Downloaded', description: link.download })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  // Download stock CSV template
  const downloadStockTemplate = () => {
    const csv = 'itemName,entityName,quantity\n' +
                'Samsung Galaxy S23,Head Office,100\n' +
                'Dell Inspiron 15,Head Office,50\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'stock-upload-format.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({ title: 'Downloaded', description: 'stock-upload-format.csv' })
  }

  // Entity handlers
  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await authFetch('/api/entities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entityForm) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: 'Entity created' }); setEntityForm({ name: '', description: '' }); setShowEntityDialog(false); fetchEntities() }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to create entity', variant: 'destructive' }) }
  }

  const handleUpdateEntity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEntityId) return
    try {
      const res = await authFetch(`/api/entities/${editingEntityId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entityForm) })
      if (res.ok) { toast({ title: 'Success', description: 'Entity updated' }); setEditingEntityId(null); setEntityForm({ name: '', description: '' }); setShowEntityDialog(false); fetchEntities() }
      else { const data = await res.json(); toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to update entity', variant: 'destructive' }) }
  }

  const handleDeleteEntity = async (id: string) => {
    if (!confirm('Delete this entity? All related stock data will also be deleted.')) return
    try {
      const res = await authFetch(`/api/entities/${id}`, { method: 'DELETE' })
      if (res.ok) { toast({ title: 'Success', description: 'Entity deleted' }); fetchEntities() }
      else { const data = await res.json(); toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to delete entity', variant: 'destructive' }) }
  }

  const openEditEntityDialog = (entity: EntityData) => {
    setEditingEntityId(entity.id); setEntityForm({ name: entity.name, description: entity.description || '' }); setShowEntityDialog(true)
  }

  const openNewEntityDialog = () => {
    setEditingEntityId(null); setEntityForm({ name: '', description: '' }); setShowEntityDialog(true)
  }

  // User handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await authFetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, entityIds: userEntityIds, menuAccess: userMenuAccess, masterDataAccess: userMasterDataAccess, columnAccess: columnAccessForm }) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: 'User created' }); setUserForm({ username: '', password: '', displayName: '', role: 'user', canCreateItem: false, canModifyItem: false }); setUserEntityIds([]); setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true }))); setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true }))); setColumnAccessForm(ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => ({ columnName: col.key, canView: true }))); setShowUserDialog(false); fetchUsers() }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to create user', variant: 'destructive' }) }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUserId) return
    try {
      const updateData: Record<string, unknown> = { ...userForm, entityIds: userEntityIds, menuAccess: userMenuAccess, masterDataAccess: userMasterDataAccess, columnAccess: columnAccessForm }
      if (!updateData.password) delete updateData.password
      const res = await authFetch(`/api/users/${editingUserId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateData) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: 'User updated' }); setEditingUserId(null); setUserForm({ username: '', password: '', displayName: '', role: 'user', canCreateItem: false, canModifyItem: false }); setUserEntityIds([]); setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true }))); setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true }))); setColumnAccessForm(ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => ({ columnName: col.key, canView: true }))); setShowUserDialog(false); fetchUsers() }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to update user', variant: 'destructive' }) }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) return
    try {
      const res = await authFetch(`/api/users/${id}`, { method: 'DELETE' })
      if (res.ok) { toast({ title: 'Success', description: 'User deleted' }); fetchUsers() }
      else { const data = await res.json(); toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' }) }
  }

  const openColumnAccessDialog = (userId: string, currentAccess: ColumnAccess[]) => {
    setSelectedUserId(userId)
    const configurableCols = ALL_COLUMNS.filter(c => !c.alwaysVisible)
    setColumnAccessForm(configurableCols.map(col => {
      const existing = currentAccess.find(ca => ca.columnName === col.key)
      return { columnName: col.key, canView: existing ? existing.canView : true }
    }))
    setShowColumnDialog(true)
  }

  const handleSaveColumnAccess = async () => {
    if (!selectedUserId) return
    try {
      const res = await authFetch(`/api/users/${selectedUserId}/columns`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ columnAccess: columnAccessForm }) })
      if (res.ok) { toast({ title: 'Success', description: 'Column access updated' }); setShowColumnDialog(false); fetchUsers() }
      else { const data = await res.json(); toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to update column access', variant: 'destructive' }) }
  }

  const openEditUserDialog = (u: UserData) => {
    setEditingUserId(u.id)
    setUserForm({ username: u.username, password: '', displayName: u.displayName, role: u.role, canCreateItem: u.canCreateItem, canModifyItem: u.canModifyItem })
    setUserEntityIds(u.entityAccess.map(ea => ea.entityId))
    setUserMenuAccess(u.menuAccess.length > 0
      ? ALL_MENU_ITEMS.map(m => {
          const existing = u.menuAccess.find(ma => ma.menuKey === m.key)
          return { menuKey: m.key, visible: existing ? existing.visible : true }
        })
      : ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true }))
    )
    // Load masterDataAccess (defaults to visible=true for legacy users with no records)
    setUserMasterDataAccess(u.masterDataAccess && u.masterDataAccess.length > 0
      ? ALL_MASTER_DATA_ITEMS.map(m => {
          const existing = u.masterDataAccess!.find(mda => mda.masterDataKey === m.key)
          return { masterDataKey: m.key, visible: existing ? existing.visible : true }
        })
      : ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true }))
    )
    setColumnAccessForm(ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => {
      const existing = u.columnAccess.find(ca => ca.columnName === col.key)
      return { columnName: col.key, canView: existing ? existing.canView : true }
    }))
    setShowUserDialog(true)
  }

  const openNewUserDialog = () => {
    setEditingUserId(null)
    setUserForm({ username: '', password: '', displayName: '', role: 'user', canCreateItem: false, canModifyItem: false })
    setUserEntityIds([])
    setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true })))
    setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true })))
    setColumnAccessForm(ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => ({ columnName: col.key, canView: true })))
    setShowUserDialog(true)
  }

  // System handlers
  const handleReset = async () => {
    if (!confirm('WARNING: This will delete ALL data including items, entities, users, and stock. Only the admin account will remain. Are you sure?')) return
    try {
      const res = await authFetch('/api/reset', { method: 'POST' })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: data.message }); handleLogout() }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Reset failed', variant: 'destructive' }) }
  }

  const handleBackup = async () => {
    if (!confirm('Create a backup of the current database?')) return
    try {
      const res = await authFetch('/api/backup', { method: 'POST' })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Backup Created', description: `Backup saved with ${data.counts?.items || 0} items, ${data.counts?.entities || 0} entities, ${data.counts?.stocks || 0} stock entries` }) }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Backup failed', variant: 'destructive' }) }
  }

  const handleRestore = async () => {
    if (!confirm('WARNING: This will restore the database from the latest backup. Any data entered after the backup will be lost. Continue?')) return
    try {
      const res = await authFetch('/api/backup', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Restored', description: 'Database restored from backup. Please refresh the page.' }) }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Restore failed', variant: 'destructive' }) }
  }

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarOpen(false)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">Item Management</CardTitle>
            <p className="text-muted-foreground mt-1">Sign in to your account</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">{loginError}</div>}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="Enter your username" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg">Sign In</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main app
  // Roles: admin = full access, manager = see all entities + data + create/modify, user = assigned entities only
  const isAdmin = user.role === 'admin'
  const isManager = user.role === 'manager'
  const isManagerOrAdmin = isAdmin || isManager
  const canCreate = isManagerOrAdmin || user.canCreateItem
  const canModify = isManagerOrAdmin || user.canModifyItem

  // Menu access helper: admin/manager always see all menus; user sees only what's granted
  const isMenuVisible = (menuKey: string): boolean => {
    if (isManagerOrAdmin) return true
    const entry = user.menuAccess?.find(ma => ma.menuKey === menuKey)
    // If no menuAccess data at all (legacy users), default to visible
    return entry ? entry.visible : true
  }

  // If no working entity selected, show entity selection page (after all vars defined)

  // Function menu items (main working area, shown after entity selection)
  const functionItems = [
    { key: 'itemPrice' as ViewType, label: 'Item Price', icon: TrendingUp },
    { key: 'stockView' as ViewType, label: 'Stock View', icon: BarChart3, isParent: true, children: [
      { key: 'myEntityStock' as ViewType, label: 'My Entity Stock', icon: Warehouse },
      { key: 'allEntityStock' as ViewType, label: 'All Entity Stock', icon: BarChart3 },
    ]},
    { key: 'itemAdjustment' as ViewType, label: 'Item Adjustment', icon: Settings2 },
    { key: 'transfer' as ViewType, label: 'Transfer', icon: ArrowRightLeft },
    { key: 'receive' as ViewType, label: 'Receive', icon: ArrowDownToLine },
    { key: 'sales' as ViewType, label: 'Sales', icon: ShoppingCart, isParent: true, children: [
      { key: 'salesOrder' as ViewType, label: 'Sales Order', icon: ClipboardList },
      { key: 'salesReturn' as ViewType, label: 'Sales Return', icon: RotateCcw },
    ]},
    { key: 'incentive' as ViewType, label: 'Incentive', icon: DollarSign },
    { key: 'reports' as ViewType, label: 'Reports', icon: FileText },
  ].filter(item => {
    // Filter top-level items: show if item itself is visible OR any child is visible
    if (item.isParent && item.children) {
      const visibleChildren = item.children.filter(c => isMenuVisible(c.key))
      return visibleChildren.length > 0
    }
    return isMenuVisible(item.key)
  }).map(item => {
    // Also filter children within parent items
    if (item.isParent && item.children) {
      return { ...item, children: item.children.filter(c => isMenuVisible(c.key)) }
    }
    return item
  })

  // Master Data sub-menu items — checks both role-based perm AND user-specific masterDataAccess
  const hasMasterDataAccess = (key: string): boolean => {
    if (isManagerOrAdmin) return true // admins/managers see everything
    // Check user-specific masterDataAccess (defaults to visible=true if no record exists)
    const access = user.masterDataAccess?.find(mda => mda.masterDataKey === key)
    return access ? access.visible : false
  }

  const masterDataItems = [
    { key: 'items' as ViewType, label: 'Item Information', icon: LayoutDashboard, perm: hasMasterDataAccess('items') },
    { key: 'newItem' as ViewType, label: 'New Item', icon: Plus, perm: hasMasterDataAccess('newItem') && canCreate },
    { key: 'upload' as ViewType, label: 'Upload CSV', icon: Upload, perm: hasMasterDataAccess('upload') && canCreate },
    { key: 'entities' as ViewType, label: 'Entity', icon: Building2, perm: isAdmin && hasMasterDataAccess('entities') },
    { key: 'users' as ViewType, label: 'Users', icon: Users, perm: isAdmin && hasMasterDataAccess('users') },
    { key: 'tailors' as ViewType, label: 'Tailors', icon: Scissors, perm: hasMasterDataAccess('tailors') },
    { key: 'makingInfo' as ViewType, label: 'Making Information', icon: Ruler, perm: hasMasterDataAccess('makingInfo') },
    { key: 'uom' as ViewType, label: 'UoM', icon: Package, perm: hasMasterDataAccess('uom') },
    { key: 'suppliers' as ViewType, label: 'Suppliers', icon: Truck, perm: hasMasterDataAccess('suppliers') },
    { key: 'customers' as ViewType, label: 'Customer Database', icon: UserCircle, perm: hasMasterDataAccess('customers') },
  ]

  const visibleMasterDataItems = masterDataItems.filter(item => item.perm === undefined || item.perm)

  const isMasterDataActive = visibleMasterDataItems.some(item => item.key === currentView)
  const isStockViewActive = ['myEntityStock', 'allEntityStock'].includes(currentView)
  const isSalesActive = ['salesOrder', 'salesReturn'].includes(currentView)

  // Helper: render Master Data section
  const renderMasterDataSection = (onNavigate?: () => void) => (
    <>
      <button onClick={() => setMasterDataOpen(!masterDataOpen)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isMasterDataActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
        <Database className="w-4 h-4 shrink-0" /><span className="flex-1 text-left">Master Data</span><ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${masterDataOpen ? 'rotate-180' : ''}`} />
      </button>
      {masterDataOpen && (
        <div className="ml-3 pl-3 border-l-2 border-muted space-y-0.5">
          {visibleMasterDataItems.map(item => (
            <button key={item.key} onClick={() => { setCurrentView(item.key); onNavigate?.() }} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${currentView === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <item.icon className="w-3.5 h-3.5 shrink-0" />{item.label}
            </button>
          ))}
        </div>
      )}
    </>
  )

  // Helper: render function menu section
  const renderFunctionMenu = (onNavigate?: () => void) => (
    <div className="space-y-0.5">
      {functionItems.map(item => {
        if (item.isParent && item.children) {
          const isOpen = item.key === 'stockView' ? stockViewOpen : salesOpen
          const isActive = item.key === 'stockView' ? isStockViewActive : isSalesActive
          const toggleOpen = item.key === 'stockView' ? () => setStockViewOpen(!stockViewOpen) : () => setSalesOpen(!salesOpen)
          return (
            <div key={item.key}>
              <button onClick={toggleOpen} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
                <item.icon className="w-4 h-4 shrink-0" /><span className="flex-1 text-left">{item.label}</span><ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="ml-3 pl-3 border-l-2 border-muted space-y-0.5">
                  {item.children.map(child => (
                    <button key={child.key} onClick={() => { setCurrentView(child.key); onNavigate?.() }} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${currentView === child.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                      <child.icon className="w-3.5 h-3.5 shrink-0" />{child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        }
        return (
          <button key={item.key} onClick={() => { setCurrentView(item.key); onNavigate?.() }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
            <item.icon className="w-4 h-4 shrink-0" />{item.label}
          </button>
        )
      })}
    </div>
  )

  const getVisibleTableColumns = () => ALL_COLUMNS.filter(col => col.alwaysVisible || visibleColumns.includes(col.key))

  // Status badge helper
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800', completed: 'bg-green-100 text-green-800', delivered: 'bg-green-100 text-green-800', ready: 'bg-blue-100 text-blue-800', processing: 'bg-blue-100 text-blue-800', making: 'bg-purple-100 text-purple-800', cancelled: 'bg-red-100 text-red-800', rejected: 'bg-red-100 text-red-800', paid: 'bg-green-100 text-green-800', increase: 'bg-green-100 text-green-800', decrease: 'bg-red-100 text-red-800' }
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>
  }

  // Item search component for transaction dialogs
  const renderItemSearchField = (selectedItemId: string, onSelectItem: (item: ItemData) => void) => (
    <div className="space-y-2">
      <Label>Search Item*</Label>
      <div className="flex gap-2">
        <Input placeholder="Type item name..." value={txItemSearch} onChange={e => setTxItemSearch(e.target.value)} />
        <Button type="button" variant="outline" onClick={handleTxItemSearch} disabled={txItemLoading}><Search className="w-4 h-4" /></Button>
      </div>
      {txItemResults.length > 0 && !selectedItemId && (
        <div className="border rounded-lg max-h-40 overflow-y-auto">
          {txItemResults.map(item => (
            <button key={item.id} type="button" onClick={() => { onSelectItem(item); setTxItemSearch(''); setTxItemResults([]) }} className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0">
              <span className="font-medium">{item.itemName}</span><span className="text-muted-foreground ml-2">{item.group} - {item.subGroup}</span>
            </button>
          ))}
        </div>
      )}
      {selectedItemId && <p className="text-sm text-green-600">Item selected</p>}
    </div>
  )

  // ====== NEW FUNCTION PAGES ======

  const renderItemPricePage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Item Price - {workingEntity?.name}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Input placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-64" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <Button variant="outline" onClick={handleSearch}><Search className="w-4 h-4" /></Button>
          <Button variant="ghost" onClick={handleSearchReset}><RotateCcw className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={handleExportItems} disabled={exporting} title="Download as Excel file">
            {exporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? 'Exporting...' : 'Excel'}
          </Button>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Serial</TableHead>
            <TableHead className="font-semibold">Year</TableHead>
            <TableHead className="font-semibold">LC No</TableHead>
            <TableHead className="font-semibold">Group</TableHead>
            <TableHead className="font-semibold">Sub Group</TableHead>
            <TableHead className="font-semibold">Item Name</TableHead>
            <TableHead className="font-semibold">Price</TableHead>
            <TableHead className="font-semibold">UoM</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {itemsLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
            : items.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No items found</TableCell></TableRow>
            : items.map((item, i) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell>{(currentPage - 1) * pageSize + i + 1}</TableCell>
                <TableCell>{item.year}</TableCell>
                <TableCell>{item.lcNo}</TableCell>
                <TableCell>{item.group}</TableCell>
                <TableCell>{item.subGroup}</TableCell>
                <TableCell className="font-medium">{item.itemName}</TableCell>
                <TableCell className="text-right">{item.price?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{item.uom}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {((currentPage-1)*pageSize)+1}-{Math.min(currentPage*pageSize, totalItems)} of {totalItems}</p>
          <div className="flex gap-1">{generatePageNumbers(currentPage, totalPages).map((p, i) => typeof p === 'string' ? <span key={i} className="px-2 py-1 text-sm">...</span> : <Button key={i} variant={p === currentPage ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(p)}>{p}</Button>)}</div>
        </div>
      )}
    </div>
  )

  const renderMyEntityStockPage = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">My Entity Stock - {workingEntity?.name}</h2>
      <StockTable entityId={workingEntity?.id || ''} entityLabel={workingEntity?.name || ''} />
    </div>
  )

  const renderAllEntityStockPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">All Entity Stock</h2>
        <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Entities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <StockTable entityId={selectedEntityId === 'all' ? '' : selectedEntityId} entityLabel="All Entities" />
    </div>
  )

  // Reusable stock table component
  const StockTable = ({ entityId, entityLabel }: { entityId: string; entityLabel: string }) => {
    const [stockData, setStockData] = useState<{ itemId: string; itemName: string; group: string; subGroup: string; uom: string; entityName: string; quantity: number }[]>([])
    const [stkLoading, setStkLoading] = useState(false)
    const [stkSearch, setStkSearch] = useState('')

    useEffect(() => {
      const fetchStock = async () => {
        setStkLoading(true)
        try {
          const params = new URLSearchParams()
          if (entityId) params.set('entityId', entityId)
          const res = await authFetch(`/api/stock?${params}`)
          if (res.ok) {
            const data = await res.json()
            const mapped = data.stocks.map((s: any) => ({
              itemId: s.itemId, itemName: s.item?.itemName || '', group: s.item?.group || '', subGroup: s.item?.subGroup || '', uom: s.item?.uom || 'PCS', entityName: s.entity?.name || '', quantity: s.quantity
            }))
            setStockData(mapped)
          }
        } catch {} finally { setStkLoading(false) }
      }
      fetchStock()
    }, [entityId])

    const filtered = stkSearch ? stockData.filter(s => s.itemName.toLowerCase().includes(stkSearch.toLowerCase()) || s.entityName.toLowerCase().includes(stkSearch.toLowerCase())) : stockData

    return (
      <div className="space-y-3">
        <Input placeholder="Search..." value={stkSearch} onChange={e => setStkSearch(e.target.value)} className="w-64" />
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Item Name</TableHead>
              <TableHead className="font-semibold">Group</TableHead>
              <TableHead className="font-semibold">Sub Group</TableHead>
              {!entityId && <TableHead className="font-semibold">Entity</TableHead>}
              <TableHead className="font-semibold">UoM</TableHead>
              <TableHead className="font-semibold text-right">Quantity</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {stkLoading ? <TableRow><TableCell colSpan={entityId ? 5 : 6} className="text-center py-8">Loading...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={entityId ? 5 : 6} className="text-center py-8 text-muted-foreground">No stock data</TableCell></TableRow>
              : filtered.map((s, i) => (
                <TableRow key={i} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{s.itemName}</TableCell>
                  <TableCell>{s.group}</TableCell>
                  <TableCell>{s.subGroup}</TableCell>
                  {!entityId && <TableCell>{s.entityName}</TableCell>}
                  <TableCell>{s.uom}</TableCell>
                  <TableCell className="text-right font-semibold">{s.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  const renderItemAdjustmentPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Item Adjustment - {workingEntity?.name}</h2>
        <Button onClick={() => { setShowAdjustmentDialog(true); setTxItemSearch(''); setTxItemResults([]) }}><Plus className="w-4 h-4 mr-2" />New Adjustment</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Item</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold text-right">Qty</TableHead>
            <TableHead className="font-semibold">Reason</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {adjustments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No adjustments</TableCell></TableRow>
            : adjustments.map(a => (
              <TableRow key={a.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{a.itemName}</TableCell>
                <TableCell>{statusBadge(a.adjustmentType)}</TableCell>
                <TableCell className="text-right">{a.quantity}</TableCell>
                <TableCell>{a.reason}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent><DialogHeader><DialogTitle>New Item Adjustment</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveAdjustment} className="space-y-4">
            {renderItemSearchField(adjustmentForm.itemId, (item) => setAdjustmentForm(f => ({ ...f, itemId: item.id || '' })))}
            <div className="space-y-2"><Label>Adjustment Type*</Label><Select value={adjustmentForm.adjustmentType} onValueChange={v => setAdjustmentForm(f => ({ ...f, adjustmentType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="increase">Increase (+)</SelectItem><SelectItem value="decrease">Decrease (-)</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Quantity*</Label><Input type="number" value={adjustmentForm.quantity} onChange={e => setAdjustmentForm(f => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
            <div className="space-y-2"><Label>Reason*</Label><Input value={adjustmentForm.reason} onChange={e => setAdjustmentForm(f => ({ ...f, reason: e.target.value }))} required /></div>
            <DialogFooter><Button type="submit">Save Adjustment</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderTransferPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Transfer - {workingEntity?.name}</h2>
        <Button onClick={() => { setShowTransferDialog(true); setTxItemSearch(''); setTxItemResults([]) }}><Plus className="w-4 h-4 mr-2" />New Transfer</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Item</TableHead>
            <TableHead className="font-semibold">From</TableHead>
            <TableHead className="font-semibold">To</TableHead>
            <TableHead className="font-semibold text-right">Qty</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {transfers.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transfers</TableCell></TableRow>
            : transfers.map(t => (
              <TableRow key={t.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{t.itemName}</TableCell>
                <TableCell>{t.fromEntityName}</TableCell>
                <TableCell>{t.toEntityName}</TableCell>
                <TableCell className="text-right">{t.quantity}</TableCell>
                <TableCell>{statusBadge(t.status)}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent><DialogHeader><DialogTitle>New Transfer</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveTransfer} className="space-y-4">
            {renderItemSearchField(transferForm.itemId, (item) => setTransferForm(f => ({ ...f, itemId: item.id || '' })))}
            <div className="space-y-2"><Label>From Entity</Label><Input value={workingEntity?.name || ''} disabled /></div>
            <div className="space-y-2"><Label>To Entity*</Label><Select value={transferForm.toEntityId} onValueChange={v => setTransferForm(f => ({ ...f, toEntityId: v }))}><SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger><SelectContent>{entities.filter(e => e.id !== workingEntity?.id).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Quantity*</Label><Input type="number" value={transferForm.quantity} onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={transferForm.notes} onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <DialogFooter><Button type="submit">Create Transfer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderReceivePage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Receive - {workingEntity?.name}</h2>
        <Button onClick={() => { setShowReceiveDialog(true); setTxItemSearch(''); setTxItemResults([]) }}><Plus className="w-4 h-4 mr-2" />New Receive</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Item</TableHead>
            <TableHead className="font-semibold text-right">Qty</TableHead>
            <TableHead className="font-semibold">Source</TableHead>
            <TableHead className="font-semibold">Ref No</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {receives.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No receives</TableCell></TableRow>
            : receives.map(r => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{r.itemName}</TableCell>
                <TableCell className="text-right">{r.quantity}</TableCell>
                <TableCell>{r.sourceEntityName || '-'}</TableCell>
                <TableCell>{r.referenceNo || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent><DialogHeader><DialogTitle>New Receive</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveReceive} className="space-y-4">
            {renderItemSearchField(receiveForm.itemId, (item) => setReceiveForm(f => ({ ...f, itemId: item.id || '' })))}
            <div className="space-y-2"><Label>Entity</Label><Input value={workingEntity?.name || ''} disabled /></div>
            <div className="space-y-2"><Label>Quantity*</Label><Input type="number" value={receiveForm.quantity} onChange={e => setReceiveForm(f => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
            <div className="space-y-2"><Label>Source Entity</Label><Select value={receiveForm.sourceEntityId} onValueChange={v => setReceiveForm(f => ({ ...f, sourceEntityId: v }))}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent><SelectItem value="">None</SelectItem>{entities.filter(e => e.id !== workingEntity?.id).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Reference No</Label><Input value={receiveForm.referenceNo} onChange={e => setReceiveForm(f => ({ ...f, referenceNo: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={receiveForm.notes} onChange={e => setReceiveForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <DialogFooter><Button type="submit">Save Receive</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderSalesOrderPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sales Order - {workingEntity?.name}</h2>
        <Button onClick={() => { setShowSalesOrderDialog(true); setTxItemSearch(''); setTxItemResults([]); fetchCustomers() }}><Plus className="w-4 h-4 mr-2" />New Sales Order</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Item</TableHead>
            <TableHead className="font-semibold">Customer</TableHead>
            <TableHead className="font-semibold text-right">Qty</TableHead>
            <TableHead className="font-semibold text-right">Price</TableHead>
            <TableHead className="font-semibold text-right">Making</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Delivery</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {salesOrders.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No sales orders</TableCell></TableRow>
            : salesOrders.map(s => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{s.itemName}</TableCell>
                <TableCell>{s.customerName}</TableCell>
                <TableCell className="text-right">{s.quantity}</TableCell>
                <TableCell className="text-right">{s.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right">{s.makingCharge.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{statusBadge(s.status)}</TableCell>
                <TableCell className="text-muted-foreground">{s.deliveryDate ? new Date(s.deliveryDate).toLocaleDateString() : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showSalesOrderDialog} onOpenChange={setShowSalesOrderDialog}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>New Sales Order</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveSalesOrder} className="space-y-4">
            {renderItemSearchField(salesOrderForm.itemId, (item) => setSalesOrderForm(f => ({ ...f, itemId: item.id || '', price: item.price?.toString() || '' })))}
            <div className="space-y-2"><Label>Customer*</Label><Select value={salesOrderForm.customerId} onValueChange={v => setSalesOrderForm(f => ({ ...f, customerId: v }))}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity*</Label><Input type="number" value={salesOrderForm.quantity} onChange={e => setSalesOrderForm(f => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
              <div className="space-y-2"><Label>Price*</Label><Input type="number" step="0.01" value={salesOrderForm.price} onChange={e => setSalesOrderForm(f => ({ ...f, price: e.target.value }))} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Making Charge</Label><Input type="number" step="0.01" value={salesOrderForm.makingCharge} onChange={e => setSalesOrderForm(f => ({ ...f, makingCharge: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Delivery Date</Label><Input type="date" value={salesOrderForm.deliveryDate} onChange={e => setSalesOrderForm(f => ({ ...f, deliveryDate: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Input value={salesOrderForm.notes} onChange={e => setSalesOrderForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <DialogFooter><Button type="submit">Create Sales Order</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderSalesReturnPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sales Return - {workingEntity?.name}</h2>
        <Button onClick={() => { setShowSalesReturnDialog(true); setTxItemSearch(''); setTxItemResults([]); fetchCustomers() }}><Plus className="w-4 h-4 mr-2" />New Return</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Item</TableHead>
            <TableHead className="font-semibold">Customer</TableHead>
            <TableHead className="font-semibold text-right">Qty</TableHead>
            <TableHead className="font-semibold text-right">Price</TableHead>
            <TableHead className="font-semibold">Reason</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {salesReturns.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No returns</TableCell></TableRow>
            : salesReturns.map(s => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{s.itemName}</TableCell>
                <TableCell>{s.customerName}</TableCell>
                <TableCell className="text-right">{s.quantity}</TableCell>
                <TableCell className="text-right">{s.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{s.reason}</TableCell>
                <TableCell>{statusBadge(s.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showSalesReturnDialog} onOpenChange={setShowSalesReturnDialog}>
        <DialogContent><DialogHeader><DialogTitle>New Sales Return</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveSalesReturn} className="space-y-4">
            {renderItemSearchField(salesReturnForm.itemId, (item) => setSalesReturnForm(f => ({ ...f, itemId: item.id || '', price: item.price?.toString() || '' })))}
            <div className="space-y-2"><Label>Customer*</Label><Select value={salesReturnForm.customerId} onValueChange={v => setSalesReturnForm(f => ({ ...f, customerId: v }))}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity*</Label><Input type="number" value={salesReturnForm.quantity} onChange={e => setSalesReturnForm(f => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
              <div className="space-y-2"><Label>Price*</Label><Input type="number" step="0.01" value={salesReturnForm.price} onChange={e => setSalesReturnForm(f => ({ ...f, price: e.target.value }))} required /></div>
            </div>
            <div className="space-y-2"><Label>Reason*</Label><Input value={salesReturnForm.reason} onChange={e => setSalesReturnForm(f => ({ ...f, reason: e.target.value }))} required /></div>
            <DialogFooter><Button type="submit">Create Return</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderIncentivePage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Incentive - {workingEntity?.name}</h2>
        <Button onClick={() => { setShowIncentiveDialog(true); setTxItemSearch(''); setTxItemResults([]); fetchTailors() }}><Plus className="w-4 h-4 mr-2" />New Incentive</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Item</TableHead>
            <TableHead className="font-semibold">Tailor</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {incentives.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No incentives</TableCell></TableRow>
            : incentives.map(i => (
              <TableRow key={i.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{i.itemName}</TableCell>
                <TableCell>{i.tailorName || '-'}</TableCell>
                <TableCell className="capitalize">{i.type}</TableCell>
                <TableCell className="text-right">{i.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{statusBadge(i.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showIncentiveDialog} onOpenChange={setShowIncentiveDialog}>
        <DialogContent><DialogHeader><DialogTitle>New Incentive</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveIncentive} className="space-y-4">
            {renderItemSearchField(incentiveForm.itemId, (item) => setIncentiveForm(f => ({ ...f, itemId: item.id || '' })))}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tailor</Label><Select value={incentiveForm.tailorId} onValueChange={v => setIncentiveForm(f => ({ ...f, tailorId: v }))}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent><SelectItem value="">None</SelectItem>{tailors.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Type*</Label><Select value={incentiveForm.type} onValueChange={v => setIncentiveForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tailor">Tailor</SelectItem><SelectItem value="sales">Sales</SelectItem><SelectItem value="bonus">Bonus</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Amount*</Label><Input type="number" step="0.01" value={incentiveForm.amount} onChange={e => setIncentiveForm(f => ({ ...f, amount: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={incentiveForm.notes} onChange={e => setIncentiveForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <DialogFooter><Button type="submit">Save Incentive</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  // ---- Reports page helpers ----
  const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0)
  const fmtNum = (n: number) => new Intl.NumberFormat('en-US').format(n || 0)
  const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }) } catch { return s } }
  const fmtDay = (s: string) => { try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) } catch { return s } }

  const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1', '#14b8a6']

  const renderKPI = (label: string, value: string, sub?: string, icon?: React.ReactNode, accent: 'green' | 'red' | 'amber' | 'violet' | 'cyan' = 'green') => {
    const accentMap = { green: 'text-emerald-600 bg-emerald-50', red: 'text-red-600 bg-red-50', amber: 'text-amber-600 bg-amber-50', violet: 'text-violet-600 bg-violet-50', cyan: 'text-cyan-600 bg-cyan-50' }
    return (
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </div>
            {icon && <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>{icon}</div>}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderChartCard = (title: string, subtitle: string, children: React.ReactNode, action?: React.ReactNode) => (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{subtitle}</CardDescription>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )

  const renderReportsPage = () => {
    const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager'
    const entityOptions = isManagerOrAdmin ? entities : entities.filter(e => user?.entityAccess.some(ea => ea.entityId === e.id))

    const tabs: { key: typeof reportTab; label: string; icon: React.ReactNode }[] = [
      { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
      { key: 'stock', label: 'Stock', icon: <BarChart3 className="w-4 h-4" /> },
      { key: 'sales', label: 'Sales', icon: <ShoppingCart className="w-4 h-4" /> },
      { key: 'transfer', label: 'Transfer', icon: <ArrowRightLeft className="w-4 h-4" /> },
      { key: 'adjustment', label: 'Adjustment', icon: <Settings2 className="w-4 h-4" /> },
      { key: 'incentive', label: 'Incentive', icon: <DollarSign className="w-4 h-4" /> },
    ]

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Reports</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {workingEntity ? `Working entity: ${workingEntity.name}` : 'All accessible entities'}
              {reportData?.from && reportData?.to ? ` • ${fmtDate(reportData.from)} → ${fmtDate(reportData.to)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={reportEntity} onValueChange={setReportEntity}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All entities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All my entities</SelectItem>
                {entityOptions.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={reportRange} onValueChange={(v) => setReportRange(v as typeof reportRange)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => fetchReports()} title="Refresh"><RefreshCw className={`w-4 h-4 ${reportLoading ? 'animate-spin' : ''}`} /></Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setReportTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                reportTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {reportLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading report…</span>
          </div>
        ) : !reportData ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No data available.</CardContent></Card>
        ) : (
          <>
            {/* OVERVIEW */}
            {reportTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {renderKPI('Total Stock Value', fmtMoney(reportData.stock?.totalValue || 0), `${fmtNum(reportData.stock?.totalQty || 0)} units`, <Package className="w-5 h-5" />, 'cyan')}
                  {renderKPI('Net Revenue', fmtMoney(reportData.sales?.netRevenue || 0), `${reportData.sales?.orderCount || 0} orders`, <ShoppingCart className="w-5 h-5" />, 'green')}
                  {renderKPI('Transfers', fmtNum(reportData.transfer?.totalCount || 0), `${fmtNum(reportData.transfer?.totalQty || 0)} units moved`, <ArrowRightLeft className="w-5 h-5" />, 'violet')}
                  {renderKPI('Incentives', fmtMoney(reportData.incentive?.totalAmount || 0), `${reportData.incentive?.totalCount || 0} entries`, <DollarSign className="w-5 h-5" />, 'amber')}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {renderChartCard('Sales Trend', 'Revenue vs returns over time', (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={reportData.sales?.trend || []} margin={{ left: -10, right: 10, top: 5 }}>
                        <defs>
                          <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gRet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} stroke="#94a3b8" />
                        <YAxis fontSize={11} stroke="#94a3b8" />
                        <RTooltip />
                        <Legend />
                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="url(#gRev)" strokeWidth={2} />
                        <Area type="monotone" dataKey="returns" name="Returns" stroke="#ef4444" fill="url(#gRet)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ))}
                  {renderChartCard('Stock by Entity', 'Current valuation across entities', (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={reportData.stock?.entityStock || []} margin={{ left: -10, right: 10, top: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="entityName" fontSize={11} stroke="#94a3b8" />
                        <YAxis fontSize={11} stroke="#94a3b8" />
                        <RTooltip />
                        <Bar dataKey="value" name="Stock Value" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {renderChartCard('Top 5 Selling Items', 'By revenue', (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={(reportData.sales?.byItem || []).slice(0, 5)} layout="vertical" margin={{ left: 30, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" fontSize={11} stroke="#94a3b8" />
                        <YAxis type="category" dataKey="name" fontSize={11} width={120} stroke="#94a3b8" />
                        <RTooltip />
                        <Bar dataKey="value" name="Revenue" fill="#10b981" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ))}
                  {renderChartCard('Incentive Status', 'Pending vs paid', (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={reportData.incentive?.byStatus || []} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={90} label>
                          {(reportData.incentive?.byStatus || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ))}
                </div>

                {/* Low stock alert */}
                {reportData.stock && reportData.stock.lowStock.length > 0 && (
                  renderChartCard('Low Stock Alert', `${reportData.stock.lowStock.length} items at or below 5 units`, (
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {reportData.stock.lowStock.map(it => (
                            <TableRow key={it.itemId}>
                              <TableCell className="font-medium">{it.itemName}</TableCell>
                              <TableCell className="text-right"><Badge variant={it.qty <= 0 ? 'destructive' : 'secondary'}>{it.qty} {it.uom}</Badge></TableCell>
                              <TableCell className="text-right">{fmtMoney(it.value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* STOCK */}
            {reportTab === 'stock' && reportData.stock && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {renderKPI('Distinct Items', fmtNum(reportData.stock.totalItems), '', <Package className="w-5 h-5" />, 'cyan')}
                  {renderKPI('Total Units', fmtNum(reportData.stock.totalQty), '', <BoxIcon className="w-5 h-5" />, 'violet')}
                  {renderKPI('Total Value', fmtMoney(reportData.stock.totalValue), '', <DollarSign className="w-5 h-5" />, 'green')}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {renderChartCard('Top 10 Items by Value', 'Stock valuation per item', (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={reportData.stock.topItems} layout="vertical" margin={{ left: 30, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" fontSize={11} stroke="#94a3b8" />
                        <YAxis type="category" dataKey="itemName" fontSize={11} width={140} stroke="#94a3b8" />
                        <RTooltip />
                        <Bar dataKey="value" name="Value" fill="#06b6d4" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ))}
                  {renderChartCard('Stock Distribution by Entity', 'Value share', (
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie data={reportData.stock.entityStock} dataKey="value" nameKey="entityName" cx="50%" cy="50%" outerRadius={110} label>
                          {reportData.stock.entityStock.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ))}
                </div>
                {renderChartCard('Stock Detail by Entity', 'Per-entity breakdown', (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {reportData.stock.entityStock.map((e, i) => (
                          <TableRow key={i}><TableCell className="font-medium">{e.entityName}</TableCell><TableCell className="text-right">{fmtNum(e.qty)}</TableCell><TableCell className="text-right">{fmtMoney(e.value)}</TableCell></TableRow>
                        ))}
                        {reportData.stock.entityStock.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No stock data</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}

            {/* SALES */}
            {reportTab === 'sales' && reportData.sales && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {renderKPI('Gross Revenue', fmtMoney(reportData.sales.grossRevenue), `${reportData.sales.orderCount} orders`, <ShoppingCart className="w-5 h-5" />, 'green')}
                  {renderKPI('Returns', fmtMoney(reportData.sales.returnsValue), `${reportData.sales.returnCount} returns`, <RotateCcw className="w-5 h-5" />, 'red')}
                  {renderKPI('Net Revenue', fmtMoney(reportData.sales.netRevenue), '', <DollarSign className="w-5 h-5" />, 'cyan')}
                  {renderKPI('Units Sold', fmtNum(reportData.sales.totalUnitsSold), `${fmtNum(reportData.sales.totalUnitsReturned)} returned`, <Package className="w-5 h-5" />, 'violet')}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {renderChartCard('Revenue vs Returns Trend', 'Daily', (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={reportData.sales.trend} margin={{ left: -10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} stroke="#94a3b8" />
                        <YAxis fontSize={11} stroke="#94a3b8" />
                        <RTooltip />
                        <Legend />
                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
                        <Area type="monotone" dataKey="returns" name="Returns" stroke="#ef4444" fill="#ef444433" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ))}
                  {renderChartCard('Orders by Status', 'Lifecycle distribution', (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={reportData.sales.byStatus} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={100} label>
                          {reportData.sales.byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {renderChartCard('Top 10 Customers', 'By revenue', (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {reportData.sales.byCustomer.map((c, i) => <TableRow key={i}><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-right">{fmtMoney(c.value)}</TableCell></TableRow>)}
                          {reportData.sales.byCustomer.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                  {renderChartCard('Top 10 Items', 'By revenue', (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {reportData.sales.byItem.map((it, i) => <TableRow key={i}><TableCell className="font-medium">{it.name}</TableCell><TableCell className="text-right">{fmtNum(it.qty)}</TableCell><TableCell className="text-right">{fmtMoney(it.value)}</TableCell></TableRow>)}
                          {reportData.sales.byItem.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
                {renderChartCard('Recent Orders', 'Last 20', (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {reportData.sales.recentOrders.map(o => (
                          <TableRow key={o.id}>
                            <TableCell className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</TableCell>
                            <TableCell className="font-medium">{o.itemName}</TableCell>
                            <TableCell>{o.customerName}</TableCell>
                            <TableCell className="text-right">{o.quantity}</TableCell>
                            <TableCell className="text-right">{fmtMoney(o.total)}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{o.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                        {reportData.sales.recentOrders.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No orders in this period</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}

            {/* TRANSFER */}
            {reportTab === 'transfer' && reportData.transfer && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {renderKPI('Total Transfers', fmtNum(reportData.transfer.totalCount), '', <ArrowRightLeft className="w-5 h-5" />, 'violet')}
                  {renderKPI('Total Units Moved', fmtNum(reportData.transfer.totalQty), '', <Package className="w-5 h-5" />, 'cyan')}
                  {renderKPI('Pending', fmtNum(reportData.transfer.byStatus.find(s => s.key === 'pending')?.count || 0), '', <AlertTriangle className="w-5 h-5" />, 'amber')}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {renderChartCard('Transfer Trend', 'Daily unit count', (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={reportData.transfer.trend} margin={{ left: -10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} stroke="#94a3b8" />
                        <YAxis fontSize={11} stroke="#94a3b8" />
                        <RTooltip />
                        <Line type="monotone" dataKey="value" name="Units" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ))}
                  {renderChartCard('Transfers by Status', 'Distribution', (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={reportData.transfer.byStatus} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={100} label>
                          {reportData.transfer.byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {renderChartCard('Top Source Entities', 'Units shipped from', (
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>From</TableHead><TableHead className="text-right">Units</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {reportData.transfer.byFromEntity.map((e, i) => <TableRow key={i}><TableCell className="font-medium">{e.name}</TableCell><TableCell className="text-right">{fmtNum(e.value)}</TableCell></TableRow>)}
                          {reportData.transfer.byFromEntity.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                  {renderChartCard('Top Destination Entities', 'Units shipped to', (
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>To</TableHead><TableHead className="text-right">Units</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {reportData.transfer.byToEntity.map((e, i) => <TableRow key={i}><TableCell className="font-medium">{e.name}</TableCell><TableCell className="text-right">{fmtNum(e.value)}</TableCell></TableRow>)}
                          {reportData.transfer.byToEntity.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
                {renderChartCard('Recent Transfers', 'Last 20', (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {reportData.transfer.recent.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs text-muted-foreground">{fmtDate(t.createdAt)}</TableCell>
                            <TableCell className="font-medium">{t.itemName}</TableCell>
                            <TableCell>{t.fromEntity}</TableCell>
                            <TableCell>{t.toEntity}</TableCell>
                            <TableCell className="text-right">{t.quantity}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{t.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                        {reportData.transfer.recent.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No transfers in this period</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}

            {/* ADJUSTMENT */}
            {reportTab === 'adjustment' && reportData.adjustment && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {renderKPI('Total Adjustments', fmtNum(reportData.adjustment.totalCount), '', <Settings2 className="w-5 h-5" />, 'violet')}
                  {renderKPI('Total Increased', fmtNum(reportData.adjustment.totalIncrease), '', <TrendingUp className="w-5 h-5" />, 'green')}
                  {renderKPI('Total Decreased', fmtNum(reportData.adjustment.totalDecrease), '', <AlertTriangle className="w-5 h-5" />, 'red')}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {renderChartCard('Adjustment Trend', 'Daily units adjusted', (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={reportData.adjustment.trend} margin={{ left: -10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} stroke="#94a3b8" />
                        <YAxis fontSize={11} stroke="#94a3b8" />
                        <RTooltip />
                        <Bar dataKey="value" name="Units" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ))}
                  {renderChartCard('By Type', 'Increase vs Decrease', (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={reportData.adjustment.byType} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={100} label>
                          {reportData.adjustment.byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ))}
                </div>
                {renderChartCard('Adjustments by Entity', 'Top 10', (
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead className="text-right">Units Adjusted</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {reportData.adjustment.byEntity.map((e, i) => <TableRow key={i}><TableCell className="font-medium">{e.name}</TableCell><TableCell className="text-right">{fmtNum(e.value)}</TableCell></TableRow>)}
                        {reportData.adjustment.byEntity.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                ))}
                {renderChartCard('Recent Adjustments', 'Last 20', (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Entity</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {reportData.adjustment.recent.map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs text-muted-foreground">{fmtDate(a.createdAt)}</TableCell>
                            <TableCell className="font-medium">{a.itemName}</TableCell>
                            <TableCell>{a.entityName}</TableCell>
                            <TableCell><Badge variant={a.adjustmentType === 'increase' ? 'default' : 'destructive'} className="capitalize">{a.adjustmentType}</Badge></TableCell>
                            <TableCell className="text-right">{a.quantity}</TableCell>
                            <TableCell className="text-xs">{a.reason}</TableCell>
                          </TableRow>
                        ))}
                        {reportData.adjustment.recent.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No adjustments in this period</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}

            {/* INCENTIVE */}
            {reportTab === 'incentive' && reportData.incentive && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {renderKPI('Total Amount', fmtMoney(reportData.incentive.totalAmount), `${reportData.incentive.totalCount} entries`, <DollarSign className="w-5 h-5" />, 'green')}
                  {renderKPI('Paid', fmtMoney(reportData.incentive.paidAmount), '', <Receipt className="w-5 h-5" />, 'cyan')}
                  {renderKPI('Pending', fmtMoney(reportData.incentive.pendingAmount), '', <AlertTriangle className="w-5 h-5" />, 'amber')}
                  {renderKPI('Tailors Paid', fmtNum(reportData.incentive.byTailor.length), '', <Scissors className="w-5 h-5" />, 'violet')}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {renderChartCard('Incentive Trend', 'Daily amount', (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={reportData.incentive.trend} margin={{ left: -10, right: 10 }}>
                        <defs>
                          <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} stroke="#94a3b8" />
                        <YAxis fontSize={11} stroke="#94a3b8" />
                        <RTooltip />
                        <Area type="monotone" dataKey="value" name="Amount" stroke="#10b981" fill="url(#gInc)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ))}
                  {renderChartCard('Incentive by Status', 'Distribution', (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={reportData.incentive.byStatus} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={100} label>
                          {reportData.incentive.byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ))}
                </div>
                {renderChartCard('Top Tailors by Incentive', 'Last period', (
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Tailor</TableHead><TableHead className="text-right">Entries</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {reportData.incentive.byTailor.map((t, i) => <TableRow key={i}><TableCell className="font-medium">{t.name}</TableCell><TableCell className="text-right">{t.count}</TableCell><TableCell className="text-right">{fmtMoney(t.value)}</TableCell></TableRow>)}
                        {reportData.incentive.byTailor.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No tailor incentives in this period</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                ))}
                {renderChartCard('Recent Incentives', 'Last 20', (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Tailor</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {reportData.incentive.recent.map(i => (
                          <TableRow key={i.id}>
                            <TableCell className="text-xs text-muted-foreground">{fmtDate(i.createdAt)}</TableCell>
                            <TableCell className="font-medium">{i.itemName}</TableCell>
                            <TableCell>{i.tailorName}</TableCell>
                            <TableCell className="text-right">{fmtMoney(i.amount)}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{i.type}</Badge></TableCell>
                            <TableCell><Badge variant={i.status === 'paid' ? 'default' : 'secondary'} className="capitalize">{i.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                        {reportData.incentive.recent.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No incentives in this period</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // Entity selection page
  const renderEntitySelection = () => {
    const availableEntities = isManagerOrAdmin ? entities : entities.filter(e => user.entityAccess.some(ea => ea.entityId === e.id))
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4"><Package className="w-8 h-8 text-primary-foreground" /></div>
            <h1 className="text-2xl font-bold">Select Entity</h1>
            <p className="text-muted-foreground mt-1">Choose the entity you want to work with</p>
            <p className="text-sm text-muted-foreground">Logged in as <span className="font-medium">{user.displayName}</span></p>
          </div>
          {availableEntities.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-lg font-medium">No Entity Available</p>
                {isManagerOrAdmin ? (
                  <>
                    <p className="text-muted-foreground mb-4">No entities exist yet. Create your first entity to get started.</p>
                    <Button onClick={openNewEntityDialog} className="gap-2">
                      <Plus className="w-4 h-4" />Create New Entity
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">Contact your administrator to get entity access.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableEntities.map(entity => (
                  <Card key={entity.id} className="hover:shadow-lg transition-all cursor-pointer hover:border-primary group" onClick={() => { setWorkingEntity({ id: entity.id, name: entity.name }); setCurrentView('itemPrice') }}>
                    <CardContent className="pt-6 text-center">
                      <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors"><Building2 className="w-7 h-7 text-primary" /></div>
                      <h3 className="font-semibold text-lg">{entity.name}</h3>
                      {entity.description && <p className="text-sm text-muted-foreground mt-1">{entity.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {isManagerOrAdmin && (
                <div className="mt-6 text-center">
                  <Button variant="outline" onClick={openNewEntityDialog} className="gap-2">
                    <Plus className="w-4 h-4" />Create New Entity
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Logout button at bottom */}
          <div className="mt-8 text-center">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />Sign Out
            </Button>
          </div>
        </div>

        {/* Entity Creation Dialog (also available from entity selection screen) */}
        <Dialog open={showEntityDialog} onOpenChange={setShowEntityDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />{editingEntityId ? 'Edit Entity' : 'Create New Entity'}</DialogTitle></DialogHeader>
            <form onSubmit={editingEntityId ? handleUpdateEntity : handleCreateEntity} className="space-y-4">
              <div className="space-y-2"><Label>Entity Name *</Label><Input placeholder="e.g. Dhaka Main Warehouse" value={entityForm.name} onChange={e => setEntityForm({ ...entityForm, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Description</Label><Input placeholder="Optional description" value={entityForm.description} onChange={e => setEntityForm({ ...entityForm, description: e.target.value })} /></div>
              <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingEntityId ? 'Update' : 'Create'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const renderSettingsPage = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center"><Settings2 className="w-5 h-5" /></div>
        <div><h2 className="text-xl font-bold">Settings</h2><p className="text-sm text-muted-foreground">Manage backup, restore, and system reset</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
        {/* Backup Card */}
        <Card className="border-blue-200 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Database className="w-5 h-5 text-blue-600" /></div>
              <div><CardTitle className="text-base">Backup Data</CardTitle><CardDescription className="text-xs">Create a snapshot of current database</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Saves all items, entities, stock, and user data as a backup file. You can restore from this backup anytime.</p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleBackup}><Database className="w-4 h-4 mr-2" />Create Backup</Button>
          </CardContent>
        </Card>
        {/* Restore Card */}
        <Card className="border-green-200 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><RotateCcw className="w-5 h-5 text-green-600" /></div>
              <div><CardTitle className="text-base">Restore Data</CardTitle><CardDescription className="text-xs">Revert to the last backup</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Restores the database from the latest backup. Any data entered after the backup was created will be lost.</p>
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleRestore}><RotateCcw className="w-4 h-4 mr-2" />Restore from Backup</Button>
          </CardContent>
        </Card>
        {/* Reset Card */}
        <Card className="border-red-200 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><RefreshCw className="w-5 h-5 text-red-600" /></div>
              <div><CardTitle className="text-base">Reset System</CardTitle><CardDescription className="text-xs">Clear all data and start fresh</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Deletes all items, stock, entities, and user data except the admin account. This action cannot be undone.</p>
            <Button variant="destructive" className="w-full" onClick={handleReset}><RefreshCw className="w-4 h-4 mr-2" />Reset All Data</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (currentView) {
      case 'items': return renderItemList()
      case 'newItem': return renderItemForm(false)
      case 'editItem': return renderItemForm(true)
      case 'upload': return renderUploadForm()
      case 'stockEntry': return renderStockEntryPage()
      case 'stockUpload': return renderStockUploadPage()
      case 'itemPrice': return renderItemPricePage()
      case 'myEntityStock': return renderMyEntityStockPage()
      case 'allEntityStock': return renderAllEntityStockPage()
      case 'itemAdjustment': return renderItemAdjustmentPage()
      case 'transfer': return renderTransferPage()
      case 'receive': return renderReceivePage()
      case 'salesOrder': return renderSalesOrderPage()
      case 'salesReturn': return renderSalesReturnPage()
      case 'incentive': return renderIncentivePage()
      case 'reports': return renderReportsPage()
      case 'tailors': return renderMasterDataPage<TailorData>('Tailors', tailors, ['name','phone','address','specialization','status'], tailorForm, setTailorForm, editingTailorId, setEditingTailorId, showTailorDialog, setShowTailorDialog, handleSaveTailor, handleDeleteTailor, { name:{label:'Name*',type:'text'},phone:{label:'Phone',type:'text'},address:{label:'Address',type:'text'},specialization:{label:'Specialization',type:'text',placeholder:'e.g. Shirt, Pant, Suit'},status:{label:'Status',type:'select',options:['active','inactive']} })
      case 'makingInfo': return renderMasterDataPage<MakingInfoData>('Making Information', makingInfoList, ['name','description','cost','unit','status'], makingInfoForm, setMakingInfoForm, editingMakingInfoId, setEditingMakingInfoId, showMakingInfoDialog, setShowMakingInfoDialog, handleSaveMakingInfo, handleDeleteMakingInfo, { name:{label:'Process Name*',type:'text',placeholder:'e.g. Stitching, Cutting, Finishing'},description:{label:'Description',type:'text'},cost:{label:'Cost',type:'number'},unit:{label:'Unit',type:'select',options:['PCS','KG','LTR','MTR','SET']},status:{label:'Status',type:'select',options:['active','inactive']} })
      case 'uom': return renderMasterDataPage<UoMData>('Unit of Measure (UoM)', uomList, ['name','description'], uomForm, setUomForm, editingUomId, setEditingUomId, showUomDialog, setShowUomDialog, handleSaveUom, handleDeleteUom, { name:{label:'UoM Name*',type:'text',placeholder:'e.g. PCS, KG, LTR'},description:{label:'Description',type:'text'} })
      case 'suppliers': return renderMasterDataPage<SupplierData>('Suppliers', suppliers, ['name','phone','email','address','status'], supplierForm, setSupplierForm, editingSupplierId, setEditingSupplierId, showSupplierDialog, setShowSupplierDialog, handleSaveSupplier, handleDeleteSupplier, { name:{label:'Supplier Name*',type:'text'},phone:{label:'Phone',type:'text'},email:{label:'Email',type:'text'},address:{label:'Address',type:'text'},status:{label:'Status',type:'select',options:['active','inactive']} })
      case 'customers': return renderMasterDataPage<CustomerData>('Customer Database', customers, ['name','phone','email','address','type','status'], customerForm, setCustomerForm, editingCustomerId, setEditingCustomerId, showCustomerDialog, setShowCustomerDialog, handleSaveCustomer, handleDeleteCustomer, { name:{label:'Customer Name*',type:'text'},phone:{label:'Phone',type:'text'},email:{label:'Email',type:'text'},address:{label:'Address',type:'text'},type:{label:'Type',type:'select',options:['regular','wholesale','corporate']},status:{label:'Status',type:'select',options:['active','inactive']} })
      case 'users': return renderUserManagement()
      case 'entities': return renderEntityManagement()
      case 'settings': return renderSettingsPage()
      case 'stockDetail': return renderStockDetail()
      default: return renderItemPricePage()
    }
  }

  // Generic Master Data CRUD Page renderer
  const renderMasterDataPage = <T extends Record<string, any>>(
    title: string,
    data: T[],
    columns: string[],
    form: Record<string, string>,
    setForm: (f: Record<string, string>) => void,
    editingId: string | null,
    setEditingId: (id: string | null) => void,
    showDialog: boolean,
    setShowDialog: (v: boolean) => void,
    handleSave: (e: React.FormEvent) => Promise<void>,
    handleDelete: (id: string) => Promise<void>,
    fieldConfig: Record<string, { label: string; type: string; placeholder?: string; options?: string[] }>
  ) => {
    const colLabels: Record<string, string> = {}
    for (const col of columns) { colLabels[col] = fieldConfig[col]?.label || col }
    const openNew = () => { setEditingId(null); setForm(Object.fromEntries(columns.map(c => [c, c === 'status' ? 'active' : c === 'type' ? 'regular' : '']))) as unknown as Record<string, string>; setShowDialog(true) }
    const openEdit = (item: T) => { setEditingId(item.id); setForm(Object.fromEntries(columns.map(c => [c, String(item[c] ?? '')]))) as unknown as Record<string, string>; setShowDialog(true) }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />New</Button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columns.map(col => <TableHead key={col} className="font-semibold">{colLabels[col]}</TableHead>)}
                <TableHead className="font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length + 1} className="text-center py-12 text-muted-foreground">No data found</TableCell></TableRow>
              ) : data.map(item => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  {columns.map(col => (
                    <TableCell key={col}>
                      {col === 'status' ? <Badge variant={item[col] === 'active' ? 'default' : 'secondary'} className={item[col] === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{item[col]}</Badge>
                        : col === 'type' ? <Badge variant="outline" className="capitalize">{item[col]}</Badge>
                        : col === 'cost' ? Number(item[col]).toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : String(item[col] ?? '-')}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} title="Edit"><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingId ? `Edit ${title.slice(0, -1)}` : `New ${title.slice(0, -1)}`}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              {columns.map(col => {
                const cfg = fieldConfig[col]
                if (!cfg) return null
                return (
                  <div key={col} className="space-y-2">
                    <Label>{cfg.label}</Label>
                    {cfg.type === 'select' && cfg.options ? (
                      <Select value={form[col] || ''} onValueChange={v => setForm({ ...form, [col]: v })}>
                        <SelectTrigger><SelectValue placeholder={`Select ${col}`} /></SelectTrigger>
                        <SelectContent>{cfg.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input type={cfg.type} placeholder={cfg.placeholder || ''} value={form[col] || ''} onChange={e => setForm({ ...form, [col]: e.target.value })} required={col === 'name'} />
                    )}
                  </div>
                )
              })}
              <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingId ? 'Update' : 'Create'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const renderItemList = () => (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by Item Name, LC No, Group, Sub Group, etc..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedEntityId} onValueChange={v => { setSelectedEntityId(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Entities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {(isManagerOrAdmin ? entities : entities.filter(e => user.entityAccess.some(ea => ea.entityId === e.id))).map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSearch}><Search className="w-4 h-4 mr-2" />Search</Button>
          <Button variant="outline" onClick={handleSearchReset}><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>
          <Button variant="outline" onClick={handleExportItems} disabled={exporting} title="Download as Excel file">
            {exporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? 'Exporting...' : 'Excel'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {getVisibleTableColumns().map(col => (
                  <TableHead key={col.key} className="font-semibold whitespace-nowrap">{col.label}</TableHead>
                ))}
                <TableHead className="font-semibold text-center">Stock</TableHead>
                {canModify && <TableHead className="font-semibold text-center">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={getVisibleTableColumns().length + 2} className="text-center py-12"><div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /><span className="text-muted-foreground">Loading...</span></div></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={getVisibleTableColumns().length + 2} className="text-center py-12 text-muted-foreground">No items found</TableCell></TableRow>
              ) : items.map((item, index) => (
                <TableRow key={item.id || index} className="hover:bg-muted/30 transition-colors">
                  {getVisibleTableColumns().map(col => (
                    <TableCell key={col.key} className="whitespace-nowrap">
                      {col.key === 'stockQty' ? (item.stockQty ?? 0)
                        : col.key === 'price' && item[col.key] != null ? Number(item[col.key]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : String(item[col.key] ?? '')}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" onClick={() => handleViewStock(item)} title="View Stock">
                      <Warehouse className="w-4 h-4" />
                    </Button>
                  </TableCell>
                  {canModify && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditItem(item)} title="Edit"><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id!)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} entries</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
          {generatePageNumbers(currentPage, totalPages).map((page, i) => page === '...' ? <span key={`e-${i}`} className="px-2 text-muted-foreground">...</span> : (
            <Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" className="min-w-[36px]" onClick={() => setCurrentPage(page as number)}>{page}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Per page:</Label>
          <Select value={pageSize.toString()} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1) }}>
            <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  const renderItemForm = (isEdit: boolean) => (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2">{isEdit ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}{isEdit ? 'Edit Item' : 'New Item Entry'}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={isEdit ? handleUpdateItem : handleCreateItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Year *</Label><Input placeholder="e.g. 2024" value={itemForm.year} onChange={e => setItemForm({ ...itemForm, year: e.target.value })} required /></div>
            <div className="space-y-2"><Label>LC No</Label><Input placeholder="e.g. LC-2024-0001" value={itemForm.lcNo} onChange={e => setItemForm({ ...itemForm, lcNo: e.target.value })} /></div>
            <div className="space-y-2"><Label>Group</Label><Input placeholder="e.g. Electronics" value={itemForm.group} onChange={e => setItemForm({ ...itemForm, group: e.target.value })} /></div>
            <div className="space-y-2"><Label>Sub Group</Label><Input placeholder="e.g. Mobile" value={itemForm.subGroup} onChange={e => setItemForm({ ...itemForm, subGroup: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Item Name *</Label><Input placeholder="e.g. Samsung Galaxy S23" value={itemForm.itemName} onChange={e => setItemForm({ ...itemForm, itemName: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Price</Label><Input type="number" step="0.01" placeholder="0.00" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} /></div>
            <div className="space-y-2"><Label>UoM</Label><Select value={itemForm.uom} onValueChange={v => setItemForm({ ...itemForm, uom: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['PCS','KG','LTR','MTR','BOX','SET','DOZ','PACK'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit"><Save className="w-4 h-4 mr-2" />{isEdit ? 'Update Item' : 'Create Item'}</Button>
            <Button type="button" variant="outline" onClick={() => { setCurrentView('items'); setEditingItemId(null) }}><X className="w-4 h-4 mr-2" />Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )

  const renderUploadForm = () => (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="w-5 h-5" />Upload Items via CSV</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-6">
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">Drop your CSV file here or click to browse</p>
            <p className="text-sm text-muted-foreground mb-4">Columns: year, lcNo, group, subGroup, itemName, price, uom</p>
            <Input type="file" accept=".csv" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="max-w-sm mx-auto" />
            {uploadFile && <p className="mt-3 text-sm text-primary font-medium">Selected: {uploadFile.name}</p>}
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">CSV Format Example:</p>
            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">{`year,lcNo,group,subGroup,itemName,price,uom\n2024,LC-2024-0001,Electronics,Mobile,Samsung Galaxy S23,75000.00,PCS\n2024,LC-2024-0002,Electronics,Laptop,Dell Inspiron 15,55000.00,PCS`}</pre>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button type="submit" disabled={!uploadFile || uploading}><Upload className="w-4 h-4 mr-2" />{uploading ? 'Uploading...' : 'Upload CSV'}</Button>
            <Button type="button" variant="outline" onClick={downloadItemsTemplate}><Download className="w-4 h-4 mr-2" />Download Format</Button>
            <Button type="button" variant="ghost" onClick={() => { setCurrentView('items'); setUploadFile(null) }}><X className="w-4 h-4 mr-2" />Cancel</Button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>💡 Tip:</strong> Click "Download Format" to get a CSV template. Empty cells will be automatically filled with "N/A". Required columns: <code>year</code> and <code>itemName</code>.
          </div>
        </form>
      </CardContent>
    </Card>
  )

  const renderEntityManagement = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Entity Management</h2>
        <Button onClick={openNewEntityDialog}><Plus className="w-4 h-4 mr-2" />New Entity</Button>
      </div>
      <p className="text-sm text-muted-foreground">Entities represent warehouses, stores, branches or any location where stock is maintained.</p>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Description</TableHead>
              <TableHead className="font-semibold text-center">Stock Entries</TableHead>
              <TableHead className="font-semibold text-center">Users Assigned</TableHead>
              <TableHead className="font-semibold text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entities.map(entity => (
              <TableRow key={entity.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{entity.name}</TableCell>
                <TableCell className="text-muted-foreground">{entity.description || '-'}</TableCell>
                <TableCell className="text-center"><Badge variant="secondary">{entity._count?.stocks || 0}</Badge></TableCell>
                <TableCell className="text-center"><Badge variant="secondary">{entity._count?.userAccess || 0}</Badge></TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditEntityDialog(entity)} title="Edit"><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteEntity(entity.id)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Entity Dialog */}
      <Dialog open={showEntityDialog} onOpenChange={setShowEntityDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />{editingEntityId ? 'Edit Entity' : 'Create New Entity'}</DialogTitle></DialogHeader>
          <form onSubmit={editingEntityId ? handleUpdateEntity : handleCreateEntity} className="space-y-4">
            <div className="space-y-2"><Label>Entity Name *</Label><Input placeholder="e.g. Dhaka Main Warehouse" value={entityForm.name} onChange={e => setEntityForm({ ...entityForm, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Description</Label><Input placeholder="Optional description" value={entityForm.description} onChange={e => setEntityForm({ ...entityForm, description: e.target.value })} /></div>
            <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingEntityId ? 'Update' : 'Create'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderStockDetail = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setCurrentView('items')}><ChevronLeft className="w-4 h-4 mr-1" />Back to Items</Button>
        <h2 className="text-xl font-semibold">Stock Detail: {stockDetailItem?.itemName}</h2>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => { setStockForm({ itemId: stockDetailItem?.id || '', entityId: '', quantity: '' }); setShowStockDialog(true) }}>
          <Plus className="w-4 h-4 mr-2" />Add Stock Entry
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Entity / Warehouse</TableHead>
              <TableHead className="font-semibold text-right">Quantity</TableHead>
              {canModify && <TableHead className="font-semibold text-center">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockDetails.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">No stock entries found</TableCell></TableRow>
            ) : stockDetails.map(sd => (
              <TableRow key={sd.id} className="hover:bg-muted/30">
                <TableCell><div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" />{sd.entityName}</div></TableCell>
                <TableCell className="text-right font-mono font-medium">{sd.quantity.toLocaleString()}</TableCell>
                {canModify && (
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteStock(sd.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm font-medium">Total Stock: <span className="text-lg font-bold">{stockDetails.reduce((sum, sd) => sum + sd.quantity, 0).toLocaleString()}</span></p>
      </div>

      {/* Add Stock Dialog */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Warehouse className="w-5 h-5" />Add / Update Stock</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Item</Label><Input value={stockDetailItem?.itemName || ''} disabled /></div>
            <div className="space-y-2">
              <Label>Entity / Warehouse *</Label>
              <Select value={stockForm.entityId} onValueChange={v => setStockForm({ ...stockForm, entityId: v })}>
                <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
                <SelectContent>{entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Quantity *</Label><Input type="number" placeholder="0" value={stockForm.quantity} onChange={e => setStockForm({ ...stockForm, quantity: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveStock} disabled={!stockForm.entityId || stockForm.quantity === ''}><Save className="w-4 h-4 mr-2" />Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderStockEntryPage = () => (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Warehouse className="w-5 h-5" />
          Stock Entry
        </CardTitle>
        <p className="text-sm text-muted-foreground">Add or update stock quantity for items across entities/warehouses.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Step 1: Search Item */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Step 1: Search & Select Item</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by item name, LC No..."
                  className="pl-10"
                  value={stockEntryForm.itemNameSearch}
                  onChange={e => setStockEntryForm({ ...stockEntryForm, itemNameSearch: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleStockItemSearch()}
                />
              </div>
              <Button onClick={handleStockItemSearch} disabled={stockEntryLoading}>
                <Search className="w-4 h-4 mr-2" />Search
              </Button>
            </div>

            {/* Search Results */}
            {stockEntryItems.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Item Name</TableHead>
                      <TableHead className="font-semibold">LC No</TableHead>
                      <TableHead className="font-semibold">Year</TableHead>
                      <TableHead className="font-semibold text-center">Select</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockEntryItems.map(item => (
                      <TableRow key={item.id} className={stockEntryForm.itemId === item.id ? 'bg-primary/10' : 'hover:bg-muted/30'}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell>{item.lcNo || '-'}</TableCell>
                        <TableCell>{item.year || '-'}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant={stockEntryForm.itemId === item.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStockEntryForm({ ...stockEntryForm, itemId: item.id! })}
                          >
                            {stockEntryForm.itemId === item.id ? 'Selected' : 'Select'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {stockEntryForm.itemId && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Selected: {stockEntryItems.find(i => i.id === stockEntryForm.itemId)?.itemName || 'Item'}</span>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setStockEntryForm({ ...stockEntryForm, itemId: '' })}>Change</Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Step 2: Select Entity */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Step 2: Select Entity / Warehouse</Label>
            <Select value={stockEntryForm.entityId} onValueChange={v => setStockEntryForm({ ...stockEntryForm, entityId: v })}>
              <SelectTrigger><SelectValue placeholder="Select entity / warehouse" /></SelectTrigger>
              <SelectContent>
                {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Step 3: Enter Quantity */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Step 3: Enter Quantity</Label>
            <Input
              type="number"
              placeholder="Enter stock quantity"
              value={stockEntryForm.quantity}
              onChange={e => setStockEntryForm({ ...stockEntryForm, quantity: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              If stock already exists for this item and entity, the quantity will be updated.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleStockEntrySave} disabled={!stockEntryForm.itemId || !stockEntryForm.entityId || stockEntryForm.quantity === ''}>
              <Save className="w-4 h-4 mr-2" />Save Stock Entry
            </Button>
            <Button variant="outline" onClick={() => { setStockEntryForm({ itemNameSearch: '', itemId: '', entityId: '', quantity: '' }); setStockEntryItems([]) }}>
              <RotateCcw className="w-4 h-4 mr-2" />Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderStockUploadPage = () => (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Upload Stock via CSV
        </CardTitle>
        <p className="text-sm text-muted-foreground">Bulk upload stock quantities for items across entities using a CSV file.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleStockUpload} className="space-y-6">
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">Drop your CSV file here or click to browse</p>
            <p className="text-sm text-muted-foreground mb-4">Upload stock data for multiple items at once</p>
            <Input type="file" accept=".csv" onChange={e => setStockUploadFile(e.target.files?.[0] || null)} className="max-w-sm mx-auto" />
            {stockUploadFile && <p className="mt-3 text-sm text-primary font-medium">Selected: {stockUploadFile.name}</p>}
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">CSV Format Requirements:</p>
            <p className="text-xs text-muted-foreground">The CSV must have a <strong>quantity</strong> column and either an <strong>entityName</strong> or <strong>entityId</strong> column to identify the entity. To identify items, use either <strong>itemName</strong> or <strong>lcNo</strong> (optionally with <strong>year</strong>).</p>
            <p className="text-sm font-medium mt-2">CSV Format Example:</p>
            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">{`itemName,entityName,quantity
Samsung Galaxy S23,Dhaka Warehouse,150
Samsung Galaxy S23,Chittagong Store,75
Dell Inspiron 15,Dhaka Warehouse,30`}</pre>
            <p className="text-sm font-medium mt-2">Alternative with LC No:</p>
            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">{`lcNo,year,entityName,quantity
LC-2024-0001,2024,Dhaka Warehouse,150
LC-2024-0002,2024,Chittagong Store,75`}</pre>
            <p className="text-xs text-muted-foreground mt-2">Supported headers: itemName/item_name/item, entityName/entity_name/entity/warehouse/store, entityId/entity_id, quantity/qty/stock, lcNo/lc_no/lc, year/yr</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button type="submit" disabled={!stockUploadFile || stockUploading}>
              <Upload className="w-4 h-4 mr-2" />{stockUploading ? 'Uploading...' : 'Upload Stock CSV'}
            </Button>
            <Button type="button" variant="outline" onClick={downloadStockTemplate}>
              <Download className="w-4 h-4 mr-2" />Download Format
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setCurrentView('items'); setStockUploadFile(null) }}>
              <X className="w-4 h-4 mr-2" />Cancel
            </Button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>💡 Tip:</strong> Click "Download Format" to get a CSV template. Empty cells will be automatically filled with "N/A". Required columns: <code>itemName</code>, <code>entityName</code>, and <code>quantity</code>.
          </div>
        </form>
      </CardContent>
    </Card>
  )

  const renderUserManagement = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">User Management</h2>
        <Button onClick={openNewUserDialog}><Plus className="w-4 h-4 mr-2" />New User</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Username</TableHead>
              <TableHead className="font-semibold">Display Name</TableHead>
              <TableHead className="font-semibold">Role</TableHead>
              <TableHead className="font-semibold text-center">Can Create</TableHead>
              <TableHead className="font-semibold text-center">Can Modify</TableHead>
              <TableHead className="font-semibold">Assigned Entities</TableHead>
              <TableHead className="font-semibold">Menu Access</TableHead>
              <TableHead className="font-semibold text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell>{u.displayName}</TableCell>
                <TableCell><Badge variant={u.role === 'admin' ? 'default' : u.role === 'manager' ? 'secondary' : 'outline'} className={u.role === 'manager' ? 'bg-blue-100 text-blue-800' : ''}>{u.role}</Badge></TableCell>
                <TableCell className="text-center">{u.canCreateItem ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                <TableCell className="text-center">{u.canModifyItem ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.entityAccess.length === 0 ? <span className="text-xs text-muted-foreground">None</span> :
                      u.entityAccess.map(ea => <Badge key={ea.entityId} variant="outline" className="text-xs">{ea.entityName}</Badge>)
                    }
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.menuAccess.length === 0 ? <Badge variant="outline" className="text-xs">All</Badge> :
                      u.menuAccess.filter(ma => ma.visible).length === ALL_MENU_ITEMS.length ? <Badge variant="outline" className="text-xs bg-green-50 text-green-700">All</Badge> :
                        u.menuAccess.filter(ma => ma.visible).map(ma => {
                          const label = ALL_MENU_ITEMS.find(m => m.key === ma.menuKey)?.label || ma.menuKey
                          return <Badge key={ma.menuKey} variant="outline" className="text-xs">{label}</Badge>
                        })
                    }
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditUserDialog(u)} title="Edit"><Edit className="w-4 h-4" /></Button>
                    {u.username !== 'admin' && <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5" />{editingUserId ? 'Edit User' : 'Create New User'}</DialogTitle></DialogHeader>
          <form onSubmit={editingUserId ? handleUpdateUser : handleCreateUser} className="space-y-4">
            <div className="space-y-2"><Label>Username *</Label><Input value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} required disabled={!!editingUserId} /></div>
            <div className="space-y-2"><Label>{editingUserId ? 'New Password (leave blank to keep)' : 'Password *'}</Label><Input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required={!editingUserId} /></div>
            <div className="space-y-2"><Label>Display Name *</Label><Input value={userForm.displayName} onChange={e => setUserForm({ ...userForm, displayName: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Role</Label><Select value={userForm.role} onValueChange={v => setUserForm({ ...userForm, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
            <div className="flex items-center justify-between"><Label>Can Create Items</Label><Switch checked={userForm.canCreateItem} onCheckedChange={v => setUserForm({ ...userForm, canCreateItem: v })} /></div>
            <div className="flex items-center justify-between"><Label>Can Modify/Delete Items</Label><Switch checked={userForm.canModifyItem} onCheckedChange={v => setUserForm({ ...userForm, canModifyItem: v })} /></div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Assign Entities</Label>
              <p className="text-xs text-muted-foreground">Select which entities this user can access.</p>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {entities.length === 0 ? <p className="text-sm text-muted-foreground">No entities created yet. Create entities first.</p> :
                  entities.map(entity => (
                    <div key={entity.id} className="flex items-center gap-2">
                      <Checkbox id={`entity-${entity.id}`} checked={userEntityIds.includes(entity.id)} onCheckedChange={checked => {
                        if (checked) setUserEntityIds([...userEntityIds, entity.id])
                        else setUserEntityIds(userEntityIds.filter(id => id !== entity.id))
                      }} />
                      <Label htmlFor={`entity-${entity.id}`} className="text-sm cursor-pointer">{entity.name}</Label>
                    </div>
                  ))
                }
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Menu Access</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true })))}>Select All</Button>
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: false })))}>Deselect All</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Control which menus and sub-menus this user can see. Admin &amp; Manager always see all menus.</p>
              {(() => {
                const groups = [...new Set(ALL_MENU_ITEMS.map(m => m.group))]
                return groups.map(group => (
                  <div key={group} className="border rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{group}</p>
                    <div className="space-y-2">
                      {ALL_MENU_ITEMS.filter(m => m.group === group).map(menu => {
                        const idx = userMenuAccess.findIndex(ma => ma.menuKey === menu.key)
                        const checked = idx >= 0 ? userMenuAccess[idx].visible : true
                        return (
                          <div key={menu.key} className="flex items-center gap-2">
                            <Checkbox
                              id={`menu-${menu.key}`}
                              checked={checked}
                              onCheckedChange={v => {
                                const updated = [...userMenuAccess]
                                if (idx >= 0) {
                                  updated[idx] = { ...updated[idx], visible: !!v }
                                } else {
                                  updated.push({ menuKey: menu.key, visible: !!v })
                                }
                                setUserMenuAccess(updated)
                              }}
                            />
                            <Label htmlFor={`menu-${menu.key}`} className="text-sm cursor-pointer">{menu.label}</Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              })()}
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Master Data Access</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true })))}>Select All</Button>
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: false })))}>Deselect All</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Grant access to specific Master Data tab pages. Admin &amp; Manager always see all. Entity &amp; Users are admin-only regardless of this setting.</p>
              <div className="space-y-2 border rounded-lg p-3">
                {ALL_MASTER_DATA_ITEMS.map(item => {
                  const idx = userMasterDataAccess.findIndex(mda => mda.masterDataKey === item.key)
                  const checked = idx >= 0 ? userMasterDataAccess[idx].visible : true
                  return (
                    <div key={item.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`md-${item.key}`}
                        checked={checked}
                        onCheckedChange={v => {
                          const updated = [...userMasterDataAccess]
                          if (idx >= 0) {
                            updated[idx] = { ...updated[idx], visible: !!v }
                          } else {
                            updated.push({ masterDataKey: item.key, visible: !!v })
                          }
                          setUserMasterDataAccess(updated)
                        }}
                      />
                      <Label htmlFor={`md-${item.key}`} className="text-sm cursor-pointer">{item.label}</Label>
                    </div>
                  )
                })}
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Column Access</Label>
              <p className="text-xs text-muted-foreground">Define which columns this user can view in the Item Information table.</p>
              <div className="space-y-2 border rounded-lg p-3">
                {ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => {
                  const caEntry = columnAccessForm.find(ca => ca.columnName === col.key)
                  const checked = caEntry ? caEntry.canView : true
                  return (
                    <div key={col.key} className="flex items-center justify-between py-0.5">
                      <Label className="text-sm">{col.label}</Label>
                      <Switch
                        checked={checked}
                        onCheckedChange={v => {
                          const updated = [...columnAccessForm]
                          const idx = updated.findIndex(ca => ca.columnName === col.key)
                          if (idx >= 0) {
                            updated[idx] = { ...updated[idx], canView: v }
                          } else {
                            updated.push({ columnName: col.key, canView: v })
                          }
                          setColumnAccessForm(updated)
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
            <DialogFooter className="pt-4"><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingUserId ? 'Update User' : 'Create User'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Column Access Dialog */}
      <Dialog open={showColumnDialog} onOpenChange={setShowColumnDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Column Access</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Define which columns this user can view.</p>
          <div className="space-y-3">
            {columnAccessForm.map((ca, idx) => {
              const colLabel = ALL_COLUMNS.find(c => c.key === ca.columnName)?.label || ca.columnName
              return (
                <div key={ca.columnName} className="flex items-center justify-between py-1">
                  <Label className="text-sm font-medium">{colLabel}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{ca.canView ? 'Visible' : 'Hidden'}</span>
                    <Switch checked={ca.canView} onCheckedChange={v => { const updated = [...columnAccessForm]; updated[idx] = { ...updated[idx], canView: v }; setColumnAccessForm(updated) }} />
                  </div>
                </div>
              )
            })}
          </div>
          <DialogFooter className="pt-4"><Button onClick={handleSaveColumnAccess}><Save className="w-4 h-4 mr-2" />Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  // Entity selection check
  if (!workingEntity) {
    return renderEntitySelection()
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar */}
      {sidebarOpen ? (
        <aside className="fixed md:relative inset-y-0 left-0 z-40 w-64 bg-card border-r flex flex-col shrink-0 transition-all duration-200 md:transition-none">
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-primary-foreground" /></div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm truncate">Item Management</h1>
                <button onClick={() => setWorkingEntity(null)} className="flex items-center gap-1 text-xs text-primary hover:underline" title="Switch entity">
                  <Building2 className="w-3 h-3" />{workingEntity.name}
                </button>
              </div>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <nav className="p-3 space-y-1">
              {renderFunctionMenu()}
              {isManagerOrAdmin && (<><div className="my-2"><Separator /></div>{renderMasterDataSection()}</>)}
              {isAdmin && (
                <button onClick={() => setCurrentView('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'settings' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                  <Settings2 className="w-4 h-4 shrink-0" />Settings
                </button>
              )}
            </nav>
          </ScrollArea>
          <div className="p-3 border-t space-y-2">
            <div className="px-3 py-2 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
              <Badge variant={user.role === 'admin' ? 'default' : user.role === 'manager' ? 'secondary' : 'outline'} className={`mt-1 text-[10px] ${user.role === 'manager' ? 'bg-blue-100 text-blue-800' : ''}`}>{user.role}</Badge>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" />Sign Out</Button>
          </div>
        </aside>
      ) : (
        <aside className="w-14 bg-card border-r flex flex-col items-center py-4 shrink-0 transition-all duration-200">
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="mb-4"><Menu className="w-5 h-5" /></Button></SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-4 border-b"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-primary-foreground" /></div><div><h1 className="font-bold text-sm">Item Management</h1><button onClick={() => setWorkingEntity(null)} className="flex items-center gap-1 text-xs text-primary hover:underline"><Building2 className="w-3 h-3" />{workingEntity.name}</button></div></div></div>
              <ScrollArea className="flex-1"><nav className="p-3 space-y-1">
                {renderFunctionMenu()}
                {isManagerOrAdmin && (<><div className="my-2"><Separator /></div>{renderMasterDataSection()}</>)}
                {isAdmin && <button onClick={() => { setCurrentView('settings'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'settings' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Settings2 className="w-4 h-4 shrink-0" />Settings</button>}
              </nav></ScrollArea>
              <div className="absolute bottom-0 left-0 right-0 p-3 border-t space-y-2">
                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" />Sign Out</Button>
              </div>
            </SheetContent>
          </Sheet>
          {/* Icon-only buttons */}
          <Button variant={currentView === 'itemPrice' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('itemPrice')} title="Item Price"><TrendingUp className="w-4 h-4" /></Button>
          <Button variant={['myEntityStock','allEntityStock'].includes(currentView) ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('myEntityStock')} title="Stock View"><BarChart3 className="w-4 h-4" /></Button>
          <Button variant={currentView === 'itemAdjustment' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('itemAdjustment')} title="Adjustment"><Settings2 className="w-4 h-4" /></Button>
          <Button variant={currentView === 'transfer' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('transfer')} title="Transfer"><ArrowRightLeft className="w-4 h-4" /></Button>
          <Button variant={currentView === 'receive' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('receive')} title="Receive"><ArrowDownToLine className="w-4 h-4" /></Button>
          <Button variant={['salesOrder','salesReturn'].includes(currentView) ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('salesOrder')} title="Sales"><ShoppingCart className="w-4 h-4" /></Button>
          <Button variant={currentView === 'incentive' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('incentive')} title="Incentive"><DollarSign className="w-4 h-4" /></Button>
          <Button variant={currentView === 'reports' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('reports')} title="Reports"><FileText className="w-4 h-4" /></Button>
          {isManagerOrAdmin && <Button variant={isMasterDataActive ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('items')} title="Master Data"><Database className="w-4 h-4" /></Button>}
          {isAdmin && <Button variant={currentView === 'settings' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('settings')} title="Settings"><Settings2 className="w-4 h-4" /></Button>}
          <div className="mt-auto">
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={handleLogout} title="Sign Out"><LogOut className="w-4 h-4" /></Button>
          </div>
        </aside>
      )}

      {/* Toggle sidebar */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="absolute top-3 z-50 bg-card border rounded-full w-7 h-7 flex items-center justify-center shadow-sm hover:bg-muted transition-colors" style={{ left: sidebarOpen ? '240px' : '48px' }}>
        {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-3 sm:p-4 md:p-6 pt-12 md:pt-14">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  )
}

function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | string)[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  if (total > 1) pages.push(total)
  return pages
}
