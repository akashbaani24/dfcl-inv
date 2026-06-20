'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox, type ComboOption } from '@/components/ui/combobox'
import { useConfirmAction } from '@/hooks/use-confirm-action'
import { bdDate, bdDateTime, bdTime, bdNow, bdTodayISO } from '@/lib/bd-time'
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
  ArrowLeft,
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
  CheckCircle2,
  Printer,
  Phone,
  Mail,
  Barcode,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from 'recharts'

// Types
interface ColumnAccess { columnName: string; canView: boolean }
interface EntityAccess { entityId: string; entityName: string }
interface MenuAccess {
  menuKey: string; visible: boolean
  canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canUpload?: boolean; canExport?: boolean; canApprove?: boolean
}
interface MasterDataAccess {
  masterDataKey: string; visible: boolean
  canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canUpload?: boolean; canExport?: boolean
}
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

interface TailorData { id: string; name: string; phone: string; address: string; specialization: string; status: string; entityIds?: string }
interface MakingInfoData { id: string; name: string; description: string; cost: number; unit: string; status: string }
interface UoMData { id: string; name: string; description: string }
interface SupplierData { id: string; name: string; phone: string; email: string; address: string; status: string; _count?: { items: number } }
interface EmployeeData { id: string; name: string; phone: string; email: string; address: string; designation: string; roles: string; status: string; notes?: string | null; createdAt: string }
interface CustomerData { id: string; name: string; phone: string; email: string; address: string; type: string; status: string; createdByEntity?: { name: string } | null; createdAt?: string }

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
  | 'itemAdjustment' | 'newAdjustment' | 'transfer' | 'newTransfer' | 'receive' | 'newReceive'
  | 'purchase' | 'newPurchase' | 'purchaseApproval' | 'purchaseDetail'
  | 'salesOrder' | 'newSalesOrder' | 'salesReturn' | 'newSalesReturn' | 'tailorPayment' | 'newTailorPayment'
  | 'booking' | 'newBooking' | 'incentive' | 'newFormula' | 'cogsPage' | 'supplierPayments' | 'newSupplierPayment' | 'delivery' | 'damage' | 'masterData' | 'inventory' | 'newsTicker' | 'reports'
  | 'items' | 'newItem' | 'editItem' | 'upload'
  | 'users' | 'userForm' | 'entities'
  | 'tailors' | 'makingInfo' | 'uom' | 'suppliers' | 'customers' | 'employees'
  | 'groups' | 'subGroups'
  | 'bookingReasons'
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

// ⚠️ IMPORTANT: Every menu item in `functionItems` MUST also be in `ALL_MENU_ITEMS` here
// AND in `MENU_ITEMS` in src/lib/auth.ts. Otherwise regular users can't be granted access.
// When adding a new menu item, add it to ALL 3 places:
//   1. ALL_MENU_ITEMS (below) — for User Management permission UI
//   2. MENU_ITEMS in auth.ts — for backend permission system
//   3. functionItems array — for sidebar rendering
const ALL_MENU_ITEMS = [
  { key: 'itemPrice', label: 'Item Price', group: 'Function' },
  { key: 'myEntityStock', label: 'My Entity Stock', group: 'Stock View' },
  { key: 'allEntityStock', label: 'All Entity Stock', group: 'Stock View' },
  { key: 'itemAdjustment', label: 'Item Adjustment', group: 'Function' },
  { key: 'transfer', label: 'Transfer', group: 'Function' },
  { key: 'receive', label: 'Receive', group: 'Function' },
  { key: 'purchase', label: 'Purchase', group: 'Purchase' },
  { key: 'purchaseApproval', label: 'Purchase Approval', group: 'Purchase' },
  { key: 'supplierPayments', label: 'Supplier Payments', group: 'Purchase' },
  { key: 'salesOrder', label: 'Sales Order', group: 'Sales' },
  { key: 'salesReturn', label: 'Sales Return', group: 'Sales' },
  { key: 'tailorPayment', label: 'Tailor Payment', group: 'Sales' },
  { key: 'delivery', label: 'Delivery', group: 'Sales' },
  { key: 'booking', label: 'Booking', group: 'Function' },
  { key: 'damage', label: 'Damage/Wastage', group: 'Function' },
  { key: 'incentive', label: 'Incentive', group: 'Function' },
  { key: 'newsTicker', label: 'News Ticker', group: 'Function' },
  { key: 'reports', label: 'Reports', group: 'Function' },
]

// ⚠️ IMPORTANT: Every master data item must also be in MASTER_DATA_ITEMS in src/lib/auth.ts
// AND in the masterDataItems array. When adding a new master data page, add to ALL 3 places.
const ALL_MASTER_DATA_ITEMS = [
  { key: 'items', label: 'Item Information' },
  { key: 'newItem', label: 'New Item' },
  { key: 'upload', label: 'Upload CSV' },
  { key: 'entities', label: 'Entity' },
  { key: 'users', label: 'Users' },
  { key: 'groups', label: 'Groups' },
  { key: 'subGroups', label: 'Sub Groups' },
  { key: 'tailors', label: 'Tailors' },
  { key: 'makingInfo', label: 'Making Information' },
  { key: 'uom', label: 'UoM' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'customers', label: 'Customer Database' },
  { key: 'employees', label: 'Employees' },
  { key: 'bookingReasons', label: 'Booking Reasons' },
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
  // ★ Global confirmation dialog for Create/Submit/Approve actions
  const { confirm, ConfirmHost } = useConfirmAction()

  const [user, setUser] = useState<UserData | null>(null)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [currentView, setCurrentViewState] = useState<ViewType>('items')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [masterDataOpen, setMasterDataOpen] = useState(true)
  const [stockViewOpen, setStockViewOpen] = useState(false)
  const [salesOpen, setSalesOpen] = useState(false)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)

  // Working entity (selected after login)
  const [workingEntity, setWorkingEntityState] = useState<{ id: string; name: string } | null>(null)

  // Transaction state
  const [adjustments, setAdjustments] = useState<ItemAdjustmentData[]>([])
  const [adjustmentForm, setAdjustmentForm] = useState({ itemId: '', adjustmentType: 'increase', quantity: '', reason: '' })
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false)
  // ★ Multi-item adjustment state
  const [multiAdjustmentRows, setMultiAdjustmentRows] = useState<Array<{ itemId: string; itemName: string; barcode: string; itemCode: string; uom: string; quantity: string; currentStock: number | null }>>([])
  const [multiAdjustmentType, setMultiAdjustmentType] = useState<'increase' | 'decrease'>('increase')
  const [multiAdjustmentReason, setMultiAdjustmentReason] = useState('')

  const [transfers, setTransfers] = useState<TransferData[]>([])
  const [transferForm, setTransferForm] = useState({ itemId: '', toEntityId: '', quantity: '', notes: '' })
  const [transferCurrentStock, setTransferCurrentStock] = useState<number | null>(null)
  const [transferPendingOutgoing, setTransferPendingOutgoing] = useState<number>(0)
  const [showTransferDialog, setShowTransferDialog] = useState(false)

  // ★ Multi-item transfer form (full page)
  // Each row: { itemId, itemName, barcode, itemCode, uom, quantity, currentStock, pendingOutgoing }
  type MultiTransferRow = {
    itemId: string
    itemName: string
    barcode: string
    itemCode: string
    uom: string
    quantity: string
    currentStock: number | null  // fetched from /api/stock for this entity + item
    pendingOutgoing: number      // sum of pending transfers already in flight
  }
  const [multiTransferRows, setMultiTransferRows] = useState<MultiTransferRow[]>([])
  const [multiTransferToEntityId, setMultiTransferToEntityId] = useState<string>('')
  const [multiTransferNotes, setMultiTransferNotes] = useState<string>('')
  // ★ Transfer detail dialog state
  const [transferDetailData, setTransferDetailData] = useState<any>(null)
  const [showTransferDetailDialog, setShowTransferDetailDialog] = useState(false)
  const openTransferDetail = (t: any) => {
    setTransferDetailData(t)
    setShowTransferDetailDialog(true)
  }

  const [receives, setReceives] = useState<ReceiveData[]>([])
  const [receiveForm, setReceiveForm] = useState({ itemId: '', quantity: '', sourceEntityId: '', referenceNo: '', notes: '' })
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  // ★ Incoming transfers — pending transfers destined TO this entity, shown on the Receive page
  //    with a one-click "Receive" button that creates a Receive from the source entity.
  const [incomingTransfers, setIncomingTransfers] = useState<any[]>([])

  // ★ Purchase state
  const [purchases, setPurchases] = useState<any[]>([])
  const [purchaseForm, setPurchaseForm] = useState({
    purchaseDate: new Date().toISOString().split('T')[0],
    purchaseType: 'local' as 'foreign' | 'local',
    entityId: '',
    supplierId: '',
    billNo: '',
    lcNo: '',
    piNo: '',
    bankName: '',
    shippingTo: '',
    notes: '',
    items: [] as Array<{ itemId: string; itemName: string; quantity: string; unitPrice: string; uom: string }>,
  })
  const [purchaseItemSearch, setPurchaseItemSearch] = useState('')
  const [purchaseItemResults, setPurchaseItemResults] = useState<any[]>([])
  // ★ Debounced auto-search for purchase item — fires 300ms after user stops typing
  useEffect(() => {
    const q = purchaseItemSearch.trim()
    if (!q) { setPurchaseItemResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/items?search=${encodeURIComponent(q)}&pageSize=20`)
        if (res.ok) {
          const data = await res.json()
          setPurchaseItemResults(data.items || [])
        }
      } catch {}
    }, 300)
    return () => clearTimeout(timer)
  }, [purchaseItemSearch])
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null)
  const [showPurchaseDetailDialog, setShowPurchaseDetailDialog] = useState(false)
  // ★ COGS page state (full page, not dialog)
  const [cogsPagePurchase, setCogsPagePurchase] = useState<any>(null)
  const [cogsItems, setCogsItems] = useState<Array<{ id: string; itemId: string; itemName: string; quantity: number; unitPrice: number; cogsPerUnit: string; cogsNotes: string; landedCostPerUnit: number }>>([])
  const [cogsSaving, setCogsSaving] = useState(false)

  const [salesOrders, setSalesOrders] = useState<Array<any>>([])
  const [salesOrderForm, setSalesOrderForm] = useState({
    customerId: '', salesPersonId: '', discount: '', orderDate: new Date().toISOString().split('T')[0], deliveryDate: '', status: 'pending', notes: '',
    items: [] as Array<{ itemId: string; itemName: string; quantity: string; unitPrice: string; makingEntries: Array<{ name: string; unitPrice: string; quantity: string }> }>,
    payments: [] as Array<{ amount: string; paymentType: string; paymentMode: string; paymentDate: string; chequeNo: string; bankName: string; notes: string }>,
    newCustomerName: '', newCustomerPhone: '', newCustomerEmail: '', newCustomerAddress: '',
  })
  const [showSalesOrderDialog, setShowSalesOrderDialog] = useState(false)
  const [editingSalesOrderId, setEditingSalesOrderId] = useState<string | null>(null)
  const [salesCustomerMode, setSalesCustomerMode] = useState<'existing' | 'new'>('existing')
  const [salesCustomerSearch, setSalesCustomerSearch] = useState('')
  const [salesItemSearch, setSalesItemSearch] = useState('')
  const [salesItemResults, setSalesItemResults] = useState<ItemData[]>([])
  // ★ Delivery page state — sales order search + barcode picking
  const [deliverySalesSearch, setDeliverySalesSearch] = useState('')
  const [deliverySelectedOrder, setDeliverySelectedOrder] = useState<any>(null)
  const [deliveryBarcodeInput, setDeliveryBarcodeInput] = useState('')
  const [deliveryPickedItems, setDeliveryPickedItems] = useState<Array<{ salesOrderItemId: string; itemId: string; itemName: string; barcode: string; itemCode: string; uom: string; orderedQty: number; deliverQty: string }>>([])
  const [deliveryPerson, setDeliveryPerson] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [delivering, setDelivering] = useState(false)
  const [showSalesDetailDialog, setShowSalesDetailDialog] = useState(false)
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<any>(null)
  const [addPaymentForm, setAddPaymentForm] = useState({ amount: '', paymentType: 'cash', paymentMode: 'collection', paymentDate: new Date().toISOString().split('T')[0], chequeNo: '', bankName: '', notes: '' })
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false)

  const [salesReturns, setSalesReturns] = useState<SalesReturnData[]>([])
  const [salesReturnForm, setSalesReturnForm] = useState({ itemId: '', customerId: '', salesOrderId: '', quantity: '', price: '', reason: '' })
  const [showSalesReturnDialog, setShowSalesReturnDialog] = useState(false)

  const [incentives, setIncentives] = useState<IncentiveData[]>([])
  const [incentiveForm, setIncentiveForm] = useState({ itemId: '', tailorId: '', amount: '', type: 'tailor', notes: '' })
  const [showIncentiveDialog, setShowIncentiveDialog] = useState(false)
  const [incentiveSubTab, setIncentiveSubTab] = useState<'formulas' | 'manual'>('formulas')

  // ★ Incentive Formula state — multi-range with Outlet/HeadOffice commission
  const [incentiveFormulas, setIncentiveFormulas] = useState<any[]>([])
  const [formulaForm, setFormulaForm] = useState({
    name: '', description: '',
    ranges: [] as Array<{ priceFrom: string; priceTo: string; outletCommission: string; headOfficeCommission: string }>,
    status: 'active', notes: '',
    itemIds: [] as string[],
    itemNames: {} as Record<string, string>, // ★ map itemId → itemName for display
  })
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null)
  const [formulaItemSearch, setFormulaItemSearch] = useState('')
  const [formulaItemResults, setFormulaItemResults] = useState<any[]>([])

  // Booking state
  const [bookings, setBookings] = useState<Array<any>>([])
  const [bookingForm, setBookingForm] = useState({
    forEntityId: '', customerId: '', bookingDate: new Date().toISOString().split('T')[0],
    tillDate: '', status: 'pending', reason: '', notes: '',
    items: [] as Array<{ itemId: string; itemName: string; fromEntityId: string; quantity: string }>,
    // New customer fields
    newCustomerName: '', newCustomerPhone: '', newCustomerEmail: '', newCustomerAddress: '',
  })
  const [showBookingDialog, setShowBookingDialog] = useState(false)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)
  const [bookingItemSearch, setBookingItemSearch] = useState('')
  const [bookingItemResults, setBookingItemResults] = useState<ItemData[]>([])
  const [bookingCustomerMode, setBookingCustomerMode] = useState<'existing' | 'new'>('existing')
  const [bookingCustomerSearch, setBookingCustomerSearch] = useState('')
  const [bookingReasons, setBookingReasons] = useState<Array<{ id: string; name: string; description: string; status: string }>>([])
  const [bookingReasonForm, setBookingReasonForm] = useState({ name: '', description: '', status: 'active' })
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null)
  const [showReasonDialog, setShowReasonDialog] = useState(false)
  const [bookingDateFrom, setBookingDateFrom] = useState('')
  const [bookingDateTo, setBookingDateTo] = useState('')

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; view: ViewType } | null>(null)
  // Item search for transaction forms
  const [txItemSearch, setTxItemSearch] = useState('')
  const [txItemResults, setTxItemResults] = useState<ItemData[]>([])
  const [txItemLoading, setTxItemLoading] = useState(false)
  // ★ Track the last-selected item so the search field can show its details after the results list is cleared.
  const [txSelectedItem, setTxSelectedItem] = useState<ItemData | null>(null)

  // Items state
  const [items, setItems] = useState<ItemData[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // ★ Debounce search — wait 400ms after user stops typing before fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all')

  // Entity state
  const [entities, setEntities] = useState<EntityData[]>([])
  const [entitiesLoading, setEntitiesLoading] = useState(false)
  const [entityForm, setEntityForm] = useState({ name: '', description: '', entityType: 'outlet' })
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null)
  const [showEntityDialog, setShowEntityDialog] = useState(false)

  // Item form state
  const [itemForm, setItemForm] = useState({ year: '', lcNo: '', group: '', subGroup: '', itemName: '', price: '', uom: 'PCS', barcode: '', itemCode: '', color: '', pattern: '', supplierCode: '', dimension: '', description: '' })
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Users state
  const [users, setUsers] = useState<UserData[]>([])
  const [userForm, setUserForm] = useState({ username: '', password: '', displayName: '', role: 'user', canCreateItem: false, canModifyItem: false })
  const [userEntityIds, setUserEntityIds] = useState<string[]>([])
  const [userMenuAccess, setUserMenuAccess] = useState<MenuAccess[]>(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false })))
  const [userMasterDataAccess, setUserMasterDataAccess] = useState<MasterDataAccess[]>(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false })))
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [columnAccessForm, setColumnAccessForm] = useState<ColumnAccess[]>([])
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [showColumnDialog, setShowColumnDialog] = useState(false)
  // ★ Password change dialog
  const [showPasswordChangeDialog, setShowPasswordChangeDialog] = useState(false)
  const [passwordChangeForm, setPasswordChangeForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordChanging, setPasswordChanging] = useState(false)
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
  // ★ Entity selector for the standalone stock upload page (renderStockUploadPage)
  const [stockUploadEntityId, setStockUploadEntityId] = useState<string>('')
  const [stockUploadResult, setStockUploadResult] = useState<any>(null)

  // Master Data state
  const [tailors, setTailors] = useState<TailorData[]>([])
  const [tailorForm, setTailorForm] = useState({ name: '', phone: '', address: '', specialization: '', status: 'active', entityIds: [] as string[] })
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

  // ★ Employee master data state
  const [employees, setEmployees] = useState<EmployeeData[]>([])
  const [employeeForm, setEmployeeForm] = useState({ name: '', phone: '', email: '', address: '', designation: '', roles: [] as string[], status: 'active', notes: '' })
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false)

  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', address: '', type: 'regular', status: 'active' })
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [showCustomerDialog, setShowCustomerDialog] = useState(false)

  // Group & SubGroup state
  const [groups, setGroups] = useState<Array<{ id: string; name: string; description: string; status: string; _count?: { subGroups: number } }>>([])
  const [groupForm, setGroupForm] = useState({ name: '', description: '', status: 'active' })
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [showGroupDialog, setShowGroupDialog] = useState(false)

  const [subGroups, setSubGroups] = useState<Array<{ id: string; name: string; groupId: string; groupName?: string; description: string; status: string }>>([])
  const [subGroupForm, setSubGroupForm] = useState({ name: '', groupId: '', description: '', status: 'active' })
  const [editingSubGroupId, setEditingSubGroupId] = useState<string | null>(null)
  const [showSubGroupDialog, setShowSubGroupDialog] = useState(false)

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Export state (for Excel download)
  const [exporting, setExporting] = useState(false)

  // Reports state
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportTab, setReportTab] = useState<'overview' | 'stock' | 'sales' | 'transfer' | 'adjustment' | 'incentive'>('overview')
  const [reportRange, setReportRange] = useState<'7' | '30' | '90' | '365' | 'all' | 'custom'>('30')
  const [reportEntity, setReportEntity] = useState<string>('__all__') // '__all__' = all my entities
  const [reportCustomFrom, setReportCustomFrom] = useState('') // YYYY-MM-DD
  const [reportCustomTo, setReportCustomTo] = useState('') // YYYY-MM-DD
  const [reportExporting, setReportExporting] = useState(false)
  const [entitySearch, setEntitySearch] = useState('') // entity selection page search

  // ★ Supplier Payments state (must be at top-level before any early return)
  const [spPayments, setSpPayments] = useState<any[]>([])
  const [spLoading, setSpLoading] = useState(false)
  const [showSpDialog, setShowSpDialog] = useState(false)

  // ★ Tailor Payments state
  const [tailorPayments, setTailorPayments] = useState<any[]>([])
  const [tailorPaymentLoading, setTailorPaymentLoading] = useState(false)
  const [tailorPaymentForm, setTailorPaymentForm] = useState({
    salesOrderId: '',
    tailorId: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentType: 'cash',
    referenceNo: '',
    notes: '',
  })
  const [tpSearch, setTpSearch] = useState('')
  const [spForm, setSpForm] = useState({ supplierId: '', purchaseId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentType: 'cash', chequeNo: '', bankName: '', notes: '' })
  const [spSearch, setSpSearch] = useState('')

  // ★ Chat state (top-level, before any early return)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatPartnerId, setChatPartnerId] = useState('')
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatPartners, setChatPartners] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const [chatMentionUsers, setChatMentionUsers] = useState<any[]>([])
  const [chatMentionQuery, setChatMentionQuery] = useState('')
  const [chatMentionStart, setChatMentionStart] = useState(-1)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // ★ News Ticker state (top-level)
  const [tickerMessages, setTickerMessages] = useState<string[]>([])
  const [tickerSettings, setTickerSettings] = useState({ speed: 30, bgColor: '#1e3a8a', textColor: '#ffffff', fontSize: 'sm' })
  const [showTickerInput, setShowTickerInput] = useState(false)
  const [tickerInput, setTickerInput] = useState('')
  const [showTickerSettings, setShowTickerSettings] = useState(false)

  const { toast } = useToast()

  // ★ Persist currentView + workingEntity in localStorage so refresh keeps the same page
  const setCurrentView = (view: ViewType) => {
    setCurrentViewState(view)
    if (typeof window !== 'undefined') localStorage.setItem('currentView', view)
  }
  const setWorkingEntity = (entity: { id: string; name: string } | null) => {
    setWorkingEntityState(entity)
    if (typeof window !== 'undefined') {
      if (entity) localStorage.setItem('workingEntity', JSON.stringify(entity))
      else localStorage.removeItem('workingEntity')
    }
  }

  // ★ Restore saved view + entity on mount (after login check)
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return
    const savedView = localStorage.getItem('currentView') as ViewType | null
    const savedEntity = localStorage.getItem('workingEntity')
    if (savedView) setCurrentViewState(savedView)
    if (savedEntity) {
      try { setWorkingEntityState(JSON.parse(savedEntity)) } catch {}
    }
  }, [user])

  // ★ Force-clean any leftover service worker + caches when NOT logged in (login screen)
  //    This makes the new login UI appear even if an old SW is still registered.
  useEffect(() => {
    if (typeof window === 'undefined' || user) return
    // Only runs on login screen
    const cleanup = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map(r => r.unregister()))
        }
      } catch {}
      try {
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
      } catch {}
    }
    cleanup()
  }, [user])

  // Close context menu on any click
  useEffect(() => {
    if (contextMenu && typeof window !== 'undefined') {
      const close = () => setContextMenu(null)
      window.addEventListener('click', close)
      window.addEventListener('scroll', close)
      return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close) }
    }
  }, [contextMenu])

  useEffect(() => { checkAuth() }, [])

  // Open menu in new tab (declared early, before conditional returns)
  const openInNewTab = (view: ViewType) => {
    if (typeof window === 'undefined') return
    const entityId = workingEntity?.id || ''
    window.open(`/?view=${view}&entityId=${entityId}`, '_blank')
  }
  const isNewTabClick = (e: React.MouseEvent): boolean => e.ctrlKey || e.metaKey || e.button === 1
  const handleContextMenu = (e: React.MouseEvent, view: ViewType) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, view }) }

  const checkAuth = async () => {
    try {
      const res = await authFetch('/api/auth/me')
      if (res.ok) { const data = await res.json(); setUser(data.user) }
      else { localStorage.removeItem('auth_token') }
    } catch { /* not authenticated */ } finally { setIsLoading(false) }
  }

  // Read ?view= URL param on load — allows opening specific pages in new tabs
  // Auto-selects entity from ?entityId= or first available entity
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      const params = new URLSearchParams(window.location.search)
      const viewParam = params.get('view') as ViewType | null
      const entityParam = params.get('entityId')

      if (viewParam && !workingEntity) {
        // Need to auto-select entity first
        if (entities.length === 0) {
          fetchEntities()
        }
        // Try to select entity from URL param or first available
        if (entities.length > 0) {
          let target = entityParam ? entities.find(e => e.id === entityParam) : null
          if (!target) {
            const available = (user.role === 'admin' || user.role === 'manager') ? entities : entities.filter(e => user.entityAccess?.some(ea => ea.entityId === e.id))
            target = available[0]
          }
          if (target) {
            setWorkingEntity({ id: target.id, name: target.name })
          }
        }
      }

      // Once entity is set, navigate to the view
      if (viewParam && workingEntity) {
        setCurrentView(viewParam)
      }
    }
  }, [user, workingEntity, entities])

  useEffect(() => {
    if (user) { fetchItems() }
  }, [user, currentPage, debouncedSearch, selectedEntityId])

  useEffect(() => {
    if (user) { fetchEntities() }
  }, [user])

  const fetchItems = useCallback(async () => {
    setItemsLoading(true)
    try {
      const params = new URLSearchParams({ page: currentPage.toString(), pageSize: pageSize.toString(), search: debouncedSearch, entityId: selectedEntityId === 'all' ? '' : selectedEntityId })
      const res = await authFetch(`/api/items?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items); setTotalItems(data.total); setTotalPages(data.totalPages); setVisibleColumns(data.visibleColumns)
      }
    } catch { toast({ title: 'Error', description: 'Failed to fetch items', variant: 'destructive' }) }
    finally { setItemsLoading(false) }
  }, [currentPage, pageSize, debouncedSearch, selectedEntityId, toast])

  const fetchEntities = useCallback(async () => {
    setEntitiesLoading(true)
    try {
      const res = await authFetch('/api/entities')
      if (res.ok) { const data = await res.json(); setEntities(data.entities) }
    } catch { /* ignore */ }
    finally { setEntitiesLoading(false) }
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
      if (res.ok) {
        localStorage.setItem('auth_token', data.token)
        setUser(data.user)
        setLoginUsername(''); setLoginPassword('')
        // ★ Kick off entities fetch IMMEDIATELY (don't wait for useEffect → re-render cycle).
        // This shaves ~200-400ms off the perceived login time.
        fetchEntities()
      }
      else { setLoginError(data.error || 'Login failed') }
    } catch { setLoginError('Network error') }
  }

  const handleLogout = async () => {
    await authFetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('auth_token')
    setUser(null); setWorkingEntity(null); setCurrentView('entitySelect')
    if (typeof window !== 'undefined') { localStorage.removeItem('currentView'); localStorage.removeItem('workingEntity') }
  }

  // Item handlers
  const handleSearch = () => { setCurrentPage(1) /* fetchItems auto-triggers via debounce */ }
  const handleSearchReset = () => { setSearchQuery(''); setCurrentPage(1); setSelectedEntityId('all') }

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await authFetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemForm) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: 'Item created successfully' }); setItemForm({ year: '', lcNo: '', group: '', subGroup: '', itemName: '', price: '', uom: 'PCS', barcode: '', itemCode: '', color: '', pattern: '', supplierCode: '', dimension: '', description: '' }); setCurrentView('items'); fetchItems() }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to create item', variant: 'destructive' }) }
  }

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItemId) return
    try {
      const res = await authFetch(`/api/items/${editingItemId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemForm) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: 'Item updated' }); setEditingItemId(null); setItemForm({ year: '', lcNo: '', group: '', subGroup: '', itemName: '', price: '', uom: 'PCS', barcode: '', itemCode: '', color: '', pattern: '', supplierCode: '', dimension: '', description: '' }); setCurrentView('items'); fetchItems() }
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
    setItemForm({
      year: item.year || '', lcNo: item.lcNo || '', group: item.group || '', subGroup: item.subGroup || '',
      itemName: item.itemName || '', price: item.price?.toString() || '', uom: item.uom || 'PCS',
      barcode: (item as any).barcode || '', itemCode: (item as any).itemCode || '',
      color: (item as any).color || '', pattern: (item as any).pattern || '',
      supplierCode: (item as any).supplierCode || '', dimension: (item as any).dimension || '',
      description: (item as any).description || '',
    })
    setCurrentView('editItem')
  }

  // Centralized navigation handler — resets form state when switching to newItem
  // so that previously-edited item data doesn't bleed into the New Item form
  const handleNavigate = (view: ViewType) => {
    if (view === 'newItem') {
      setEditingItemId(null)
      setItemForm({ year: '', lcNo: '', group: '', subGroup: '', itemName: '', price: '', uom: 'PCS', barcode: '', itemCode: '', color: '', pattern: '', supplierCode: '', dimension: '', description: '' })
    }
    setCurrentView(view)
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
    if (!stockUploadEntityId) {
      toast({ title: 'Error', description: 'Please select an entity first.', variant: 'destructive' })
      return
    }
    setStockUploading(true)
    setStockUploadResult(null)
    try {
      const formData = new FormData(); formData.append('file', stockUploadFile)
      const res = await authFetch(`/api/stock/upload?entityId=${stockUploadEntityId}`, { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setStockUploadResult(data)
        toast({ title: 'Success', description: `Uploaded ${data.upserted} stock entries${data.skipped > 0 ? `, skipped ${data.skipped}${data.wrongEntity ? ` (wrong entity: ${data.wrongEntity})` : ''}` : ''} for ${data.selectedEntity || 'entity'}` })
        setStockUploadFile(null)
        // Don't auto-redirect — let user see the result. They can navigate themselves.
      } else {
        setStockUploadResult({ error: data.error || 'Upload failed' })
        toast({ title: 'Error', description: data.error || 'Upload failed', variant: 'destructive' })
      }
    } catch (err) {
      const msg = String(err)
      setStockUploadResult({ error: msg })
      toast({ title: 'Error', description: 'Upload failed: ' + msg, variant: 'destructive' })
    }
    finally { setStockUploading(false) }
  }

  // Master Data fetch & handlers
  const fetchTailors = async (entityId?: string) => {
    try {
      const url = entityId ? `/api/tailors?entityId=${entityId}` : '/api/tailors'
      const res = await authFetch(url)
      if (res.ok) { const d = await res.json(); setTailors(d.tailors) }
    } catch {}
  }
  const fetchMakingInfo = async () => { try { const res = await authFetch('/api/making-info'); if (res.ok) { const d = await res.json(); setMakingInfoList(d.makingInfo) } } catch {} }
  const fetchUom = async () => { try { const res = await authFetch('/api/uom'); if (res.ok) { const d = await res.json(); setUomList(d.uomList) } } catch {} }
  const fetchSuppliers = async () => { try { const res = await authFetch('/api/suppliers'); if (res.ok) { const d = await res.json(); setSuppliers(d.suppliers) } } catch {} }
  const fetchEmployees = async () => { try { const res = await authFetch('/api/employees'); if (res.ok) { const d = await res.json(); setEmployees(d.employees) } } catch {} }
  const fetchSupplierPayments = async () => { if (!workingEntity) return; setSpLoading(true); try { const params = new URLSearchParams(); params.set('entityId', workingEntity.id); const res = await authFetch(`/api/supplier-payments?${params}`); if (res.ok) { const d = await res.json(); setSpPayments(d.payments || []) } } catch {} finally { setSpLoading(false) } }
  const fetchCustomers = async () => { try { const res = await authFetch('/api/customers'); if (res.ok) { const d = await res.json(); setCustomers(d.customers) } } catch {} }

  // Transaction fetch handlers
  const fetchAdjustments = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/item-adjustments?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setAdjustments(d.adjustments.map((a: any) => ({ ...a, itemName: a.item?.itemName || '', entityName: a.entity?.name || '' }))) } } catch {} }
  const fetchTransfers = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/transfers?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setTransfers(d.transfers.map((t: any) => ({ ...t, itemName: t.item?.itemName || '', fromEntityName: t.fromEntity?.name || '', toEntityName: t.toEntity?.name || '' }))) } } catch {} }
  const fetchReceives = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/receives?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setReceives(d.receives.map((r: any) => ({ ...r, itemName: r.item?.itemName || '', entityName: r.entity?.name || '', sourceEntityName: r.sourceEntity?.name || '' }))) } } catch {} }
  // ★ Fetch pending transfers destined TO this entity (for the Receive page's "Incoming Transfers" panel)
  const fetchIncomingTransfers = async () => {
    if (!workingEntity) return
    try {
      const res = await authFetch(`/api/transfers?entityId=${workingEntity.id}`)
      if (res.ok) {
        const d = await res.json()
        // Only show pending transfers where this entity is the destination
        const incoming = (d.transfers || [])
          .filter((t: any) => t.toEntityId === workingEntity.id && t.status === 'pending')
          .map((t: any) => ({
            ...t,
            itemName: t.item?.itemName || '',
            fromEntityName: t.fromEntity?.name || '',
            toEntityName: t.toEntity?.name || '',
          }))
        setIncomingTransfers(incoming)
      }
    } catch {}
  }
  // ★ Quick-receive: create a Receive entry directly from an incoming transfer
  const handleQuickReceive = async (transfer: any) => {
    if (!workingEntity) return
    const ok = await confirm({
      title: 'Receive this transfer?',
      message: `This will receive ${transfer.quantity} unit(s) of "${transfer.itemName}" from "${transfer.fromEntityName}". The source entity's stock will be decremented and your entity's stock will be incremented. The transfer will be marked as completed. Do you want to continue?`,
      confirmLabel: 'Receive Now',
    })
    if (!ok) return
    try {
      const res = await authFetch('/api/receives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: transfer.itemId,
          entityId: workingEntity.id,
          quantity: transfer.quantity,
          sourceEntityId: transfer.fromEntityId,
          transferId: transfer.id,
          referenceNo: `TR-${transfer.id.slice(-6).toUpperCase()}`,
          notes: `Auto-received from transfer ${transfer.id}`,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Success', description: `Received ${transfer.quantity} unit(s) of ${transfer.itemName}` })
        fetchReceives()
        fetchIncomingTransfers()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const fetchPurchases = async (statusFilter = '') => { if (!workingEntity) return; try { const params = new URLSearchParams(); params.set('entityId', workingEntity.id); if (statusFilter) params.set('status', statusFilter); const res = await authFetch(`/api/purchases?${params}`); if (res.ok) { const d = await res.json(); setPurchases(d.purchases || []) } } catch {} }
  const fetchSalesOrders = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/sales-orders?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setSalesOrders(d.salesOrders || []) } } catch {} }
  const fetchSalesReturns = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/sales-returns?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setSalesReturns(d.salesReturns.map((s: any) => ({ ...s, itemName: s.item?.itemName || '', entityName: s.entity?.name || '', customerName: s.customer?.name || '' }))) } } catch {} }
  const fetchIncentives = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/incentives?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setIncentives(d.incentives.map((i: any) => ({ ...i, itemName: i.item?.itemName || '', entityName: i.entity?.name || '', tailorName: i.tailor?.name || '' }))) } } catch {} }

  // ★ Fetch current stock + pending outgoing transfers for the transfer form's selected item.
  // Used to show real-time "available stock" hint and prevent over-transfer.
  useEffect(() => {
    if (!workingEntity || !transferForm.itemId) {
      setTransferCurrentStock(null)
      setTransferPendingOutgoing(0)
      return
    }
    let cancelled = false
    const fetchTransferStock = async () => {
      try {
        const res = await authFetch(`/api/stock?entityId=${workingEntity.id}`)
        if (res.ok) {
          const d = await res.json()
          const row = (d.stocks || []).find((s: any) => s.itemId === transferForm.itemId)
          if (!cancelled) setTransferCurrentStock(row?.quantity ?? 0)
        }
      } catch {}
      // Pending outgoing transfers for this item
      try {
        const res = await authFetch(`/api/transfers?entityId=${workingEntity.id}`)
        if (res.ok) {
          const d = await res.json()
          const pending = (d.transfers || [])
            .filter((t: any) => t.itemId === transferForm.itemId && t.fromEntityId === workingEntity.id && t.status === 'pending')
            .reduce((s: number, t: any) => s + t.quantity, 0)
          if (!cancelled) setTransferPendingOutgoing(pending)
        }
      } catch {}
    }
    fetchTransferStock()
    return () => { cancelled = true }
  }, [transferForm.itemId, workingEntity])

  const fetchBookings = async () => { if (!workingEntity) return; try { const res = await authFetch(`/api/bookings?entityId=${workingEntity.id}`); if (res.ok) { const d = await res.json(); setBookings(d.bookings) } } catch {} }

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (bookingForm.items.length === 0) { toast({ title: 'Error', description: 'Add at least one item', variant: 'destructive' }); return }
    if (!bookingForm.forEntityId) { toast({ title: 'Error', description: 'Please select For Entity', variant: 'destructive' }); return }
    const ok = await confirm({
      title: editingBookingId ? 'Update Booking?' : 'Create Booking?',
      message: `This will ${editingBookingId ? 'update' : 'create'} a booking with ${bookingForm.items.length} item line(s). The booking will reserve stock for the selected items until the booking expires or is cancelled. Regular users will not be able to modify this booking afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: editingBookingId ? 'Update Booking' : 'Create Booking',
    })
    if (!ok) return
    try {
      let customerId = bookingForm.customerId

      // If "new customer" mode, create customer first
      if (bookingCustomerMode === 'new') {
        if (!bookingForm.newCustomerName) { toast({ title: 'Error', description: 'Customer name is required for new customer', variant: 'destructive' }); return }
        const custRes = await authFetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: bookingForm.newCustomerName, phone: bookingForm.newCustomerPhone, email: bookingForm.newCustomerEmail, address: bookingForm.newCustomerAddress, type: 'regular', status: 'active' }) })
        const custData = await custRes.json()
        if (custRes.ok && custData.customer) { customerId = custData.customer.id }
        else { toast({ title: 'Error', description: custData.error || 'Failed to create customer', variant: 'destructive' }); return }
      }

      const payload = {
        entityId: workingEntity.id, // ★ Booking is "owned" by the entity that creates it (so it shows in that entity's booking summary)
        customerId,
        bookingDate: bookingForm.bookingDate,
        tillDate: bookingForm.tillDate,
        status: bookingForm.status,
        reason: bookingForm.reason,
        notes: bookingForm.notes,
        items: bookingForm.items.map(i => ({ itemId: i.itemId, fromEntityId: i.fromEntityId, quantity: parseInt(i.quantity) || 1 })),
      }
      const res = editingBookingId
        ? await authFetch(`/api/bookings/${editingBookingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await authFetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        const data = await res.json()
        const msg = editingBookingId ? 'Booking updated' : `Booking created! ID: ${data.booking?.bookingNo || ''}`
        toast({ title: 'Success', description: msg })
        setShowBookingDialog(false); setEditingBookingId(null); resetBookingForm(); setCurrentView('booking'); fetchBookings()
      }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  const resetBookingForm = () => {
    setBookingForm({ forEntityId: '', customerId: '', bookingDate: new Date().toISOString().split('T')[0], tillDate: '', status: 'pending', reason: '', notes: '', items: [], newCustomerName: '', newCustomerPhone: '', newCustomerEmail: '', newCustomerAddress: '' })
    setEditingBookingId(null)
    setBookingItemSearch('')
    setBookingItemResults([])
    setBookingCustomerMode('existing')
    setBookingCustomerSearch('')
  }

  const handleBookingItemSearch = async () => {
    if (!bookingItemSearch.trim()) return
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '10', search: bookingItemSearch })
      const res = await authFetch(`/api/items?${params}`)
      if (res.ok) { const data = await res.json(); setBookingItemResults(data.items) }
    } catch {}
  }

  const addBookingItem = (item: ItemData) => {
    if (!item.id) return
    const itemName = item.itemName || item.id
    setBookingForm(f => ({ ...f, items: [...f.items, { itemId: item.id!, itemName, fromEntityId: '', quantity: '1' }] }))
    setBookingItemSearch('')
    setBookingItemResults([])
  }

  const removeBookingItem = (index: number) => {
    setBookingForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }))
  }

  const updateBookingItem = (index: number, field: 'fromEntityId' | 'quantity', value: string) => {
    setBookingForm(f => {
      const items = [...f.items]
      items[index] = { ...items[index], [field]: value }
      return { ...f, items }
    })
  }

  const handleDeleteBooking = async (id: string) => { if (!confirm('Delete this booking?')) return; try { const res = await authFetch(`/api/bookings/${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Deleted' }); fetchBookings() } } catch {} }

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

  // ★ Debounced auto-search for transaction item picker (transfer / receive / adjustment)
  //    Fires 300ms after the user stops typing. Supports barcode / itemCode / itemName.
  useEffect(() => {
    const q = txItemSearch.trim()
    if (!q) { setTxItemResults([]); return }
    setTxItemLoading(true)
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: '1', pageSize: '20', search: q })
        const res = await authFetch(`/api/items?${params}`)
        if (res.ok) {
          const data = await res.json()
          setTxItemResults(data.items || [])
          // ★ Auto-pick if exactly one match (esp. for barcode scans where the user
          //    wants the item to be selected immediately).
          if ((data.items || []).length === 1 && q.length >= 3) {
            // Don't auto-pick — let user click. Auto-pick is too aggressive when typing partial names.
          }
        }
      } catch {} finally { setTxItemLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [txItemSearch])

  // Transaction save handlers
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !adjustmentForm.itemId || !adjustmentForm.quantity) return
    const ok = await confirm({
      title: 'Save Item Adjustment?',
      message: `This will ${adjustmentForm.adjustmentType} stock by ${adjustmentForm.quantity} units${workingEntity ? ` at ${workingEntity.name}` : ''}. The adjustment will be recorded and stock will be updated immediately. Regular users will not be able to modify this afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: 'Save Adjustment',
    })
    if (!ok) return
    try {
      const res = await authFetch('/api/item-adjustments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...adjustmentForm, entityId: workingEntity.id, quantity: parseInt(adjustmentForm.quantity) }) })
      if (res.ok) { toast({ title: 'Success', description: 'Adjustment saved' }); setShowAdjustmentDialog(false); setAdjustmentForm({ itemId: '', adjustmentType: 'increase', quantity: '', reason: '' }); setCurrentView('itemAdjustment'); fetchAdjustments() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !transferForm.itemId || !transferForm.toEntityId || !transferForm.quantity) return
    const targetEntity = entities.find(en => en.id === transferForm.toEntityId)
    const ok = await confirm({
      title: 'Create Transfer?',
      message: `This will transfer ${transferForm.quantity} unit(s) from "${workingEntity?.name}" to "${targetEntity?.name || 'another entity'}". The transfer will be created as "pending" and the destination entity will need to receive it. Regular users will not be able to modify this transfer afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: 'Create Transfer',
    })
    if (!ok) return
    try {
      const res = await authFetch('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...transferForm, fromEntityId: workingEntity.id, quantity: parseInt(transferForm.quantity) }) })
      if (res.ok) { toast({ title: 'Success', description: 'Transfer created' }); setShowTransferDialog(false); setTransferForm({ itemId: '', toEntityId: '', quantity: '', notes: '' }); fetchTransfers() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  // ★ Save a multi-item transfer — fires N individual POSTs to /api/transfers
  // (one per row), all targeted to the same destination entity.
  const handleSaveMultiTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity) return
    if (!multiTransferToEntityId) { toast({ title: 'Error', description: 'Please select a destination entity', variant: 'destructive' }); return }
    if (multiTransferRows.length === 0) { toast({ title: 'Error', description: 'Add at least one item', variant: 'destructive' }); return }
    if (multiTransferToEntityId === workingEntity.id) { toast({ title: 'Error', description: 'Source and destination cannot be the same entity', variant: 'destructive' }); return }
    // Validate every row has quantity > 0
    const invalid = multiTransferRows.find(r => !r.quantity || parseInt(r.quantity) <= 0)
    if (invalid) { toast({ title: 'Error', description: `Quantity for "${invalid.itemName}" must be greater than 0`, variant: 'destructive' }); return }
    // Check stock availability locally first (best-effort warning before submitting)
    const over = multiTransferRows.find(r => r.currentStock !== null && (parseInt(r.quantity) || 0) > (r.currentStock - r.pendingOutgoing))
    if (over) {
      const avail = (over.currentStock ?? 0) - over.pendingOutgoing
      toast({ title: 'Insufficient stock', description: `"${over.itemName}": available ${avail}, requested ${over.quantity}. Reduce the quantity or remove this row.`, variant: 'destructive' })
      return
    }

    // Confirmation dialog with summary
    const totalQty = multiTransferRows.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0)
    const ok = await confirm({
      title: 'Create Multi-Item Transfer?',
      message: `This will create ${multiTransferRows.length} transfer(s) totaling ${totalQty} unit(s) from "${workingEntity?.name}" to "${entities.find(e => e.id === multiTransferToEntityId)?.name || 'destination'}". Each transfer will be created as "pending" and the destination entity will need to receive them. Regular users will not be able to modify these transfers afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: 'Create Transfers',
    })
    if (!ok) return

    // Submit each row in sequence
    let success = 0
    const failures: string[] = []
    for (const row of multiTransferRows) {
      try {
        const res = await authFetch('/api/transfers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: row.itemId,
            fromEntityId: workingEntity.id,
            toEntityId: multiTransferToEntityId,
            quantity: parseInt(row.quantity),
            notes: multiTransferNotes || undefined,
          }),
        })
        if (res.ok) {
          success++
        } else {
          const d = await res.json().catch(() => ({}))
          failures.push(`${row.itemName}: ${d.error || 'failed'}`)
        }
      } catch {
        failures.push(`${row.itemName}: network error`)
      }
    }
    if (success > 0) {
      toast({ title: 'Success', description: `Created ${success} of ${multiTransferRows.length} transfers${failures.length > 0 ? `. ${failures.length} failed.` : ''}` })
    }
    if (failures.length > 0) {
      toast({ title: 'Some transfers failed', description: failures.slice(0, 3).join(' | '), variant: 'destructive' })
    }
    if (success === multiTransferRows.length) {
      // All succeeded — reset form and go back to transfer list
      setMultiTransferRows([])
      setMultiTransferToEntityId('')
      setMultiTransferNotes('')
      setCurrentView('transfer')
      fetchTransfers()
    } else {
      // Some failed — refresh transfers list but keep the form
      fetchTransfers()
    }
  }

  // ★ Add a row to the multi-item transfer form (after picking an item via barcode scan)
  const addMultiTransferRow = (item: any) => {
    if (multiTransferRows.find(r => r.itemId === item.id)) {
      toast({ title: 'Already added', description: `${item.itemName} is already in the transfer list.`, variant: 'destructive' })
      return
    }
    setMultiTransferRows(rows => [...rows, {
      itemId: item.id,
      itemName: item.itemName || '',
      barcode: item.barcode || '',
      itemCode: item.itemCode || '',
      uom: item.uom || 'PCS',
      quantity: '1',
      currentStock: null,
      pendingOutgoing: 0,
    }])
    // Fetch stock for this item asynchronously
    if (workingEntity) {
      fetchMultiTransferRowStock(item.id)
    }
  }

  // Fetch current stock + pending outgoing for a specific row's item
  const fetchMultiTransferRowStock = async (itemId: string) => {
    if (!workingEntity) return
    try {
      const [stockRes, transferRes] = await Promise.all([
        authFetch(`/api/stock/by-entity?entityId=${workingEntity.id}`),
        authFetch(`/api/transfers?entityId=${workingEntity.id}`),
      ])
      let currentStock: number | null = null
      let pendingOutgoing = 0
      if (stockRes.ok) {
        const d = await stockRes.json()
        const row = (d.stocks || []).find((s: any) => s.itemId === itemId)
        if (row) currentStock = row.quantity
      }
      if (transferRes.ok) {
        const d = await transferRes.json()
        pendingOutgoing = (d.transfers || [])
          .filter((t: any) => t.itemId === itemId && t.fromEntityId === workingEntity.id && t.status === 'pending')
          .reduce((s: number, t: any) => s + t.quantity, 0)
      }
      setMultiTransferRows(rows => rows.map(r => r.itemId === itemId ? { ...r, currentStock, pendingOutgoing } : r))
    } catch {}
  }

  // Update a single row's quantity
  const updateMultiTransferRow = (itemId: string, field: 'quantity', value: string) => {
    setMultiTransferRows(rows => rows.map(r => r.itemId === itemId ? { ...r, [field]: value } : r))
  }

  // Remove a row from the multi-item transfer form
  const removeMultiTransferRow = (itemId: string) => {
    setMultiTransferRows(rows => rows.filter(r => r.itemId !== itemId))
  }

  const handleSaveReceive = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !receiveForm.itemId || !receiveForm.quantity) return
    const ok = await confirm({
      title: 'Save Receive?',
      message: `This will receive ${receiveForm.quantity} unit(s) into "${workingEntity?.name}"${receiveForm.sourceEntityId ? ` from the selected source entity (source entity's stock will be decremented)` : ''}. The receive will be recorded and stock will be updated immediately. Regular users will not be able to modify this afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: 'Save Receive',
    })
    if (!ok) return
    try {
      const res = await authFetch('/api/receives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...receiveForm, entityId: workingEntity.id, quantity: parseInt(receiveForm.quantity), sourceEntityId: receiveForm.sourceEntityId || undefined }) })
      if (res.ok) { toast({ title: 'Success', description: 'Receive saved' }); setShowReceiveDialog(false); setReceiveForm({ itemId: '', quantity: '', sourceEntityId: '', referenceNo: '', notes: '' }); fetchReceives() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  // Sales order handlers
  const resetSalesOrderForm = () => {
    setSalesOrderForm({ customerId: '', salesPersonId: '', discount: '', orderDate: new Date().toISOString().split('T')[0], deliveryDate: '', status: 'pending', notes: '', items: [], payments: [], newCustomerName: '', newCustomerPhone: '', newCustomerEmail: '', newCustomerAddress: '' })
    setEditingSalesOrderId(null); setSalesCustomerMode('existing'); setSalesCustomerSearch(''); setSalesItemSearch(''); setSalesItemResults([])
  }

  const handleSalesItemSearch = async () => {
    if (!salesItemSearch.trim()) return
    try { const params = new URLSearchParams({ page: '1', pageSize: '10', search: salesItemSearch }); const res = await authFetch(`/api/items?${params}`); if (res.ok) { const data = await res.json(); setSalesItemResults(data.items) } } catch {}
  }

  const addSalesItem = (item: ItemData) => {
    if (!item.id) return
    setSalesOrderForm(f => ({ ...f, items: [...f.items, { itemId: item.id!, itemName: item.itemName || '', quantity: '1', unitPrice: item.price?.toString() || '0', makingEntries: [] }] }))
    setSalesItemSearch(''); setSalesItemResults([])
  }

  const removeSalesItem = (index: number) => {
    setSalesOrderForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }))
  }

  const updateSalesItem = (index: number, field: 'quantity' | 'unitPrice', value: string) => {
    setSalesOrderForm(f => { const items = [...f.items]; items[index] = { ...items[index], [field]: value }; return { ...f, items } })
  }

  const addMakingEntry = (itemIndex: number) => {
    setSalesOrderForm(f => { const items = [...f.items]; items[itemIndex].makingEntries.push({ name: '', unitPrice: '0', quantity: '1' }); return { ...f, items } })
  }

  const removeMakingEntry = (itemIndex: number, meIndex: number) => {
    setSalesOrderForm(f => { const items = [...f.items]; items[itemIndex].makingEntries = items[itemIndex].makingEntries.filter((_, i) => i !== meIndex); return { ...f, items } })
  }

  const updateMakingEntry = (itemIndex: number, meIndex: number, field: 'name' | 'unitPrice' | 'quantity', value: string) => {
    setSalesOrderForm(f => { const items = [...f.items]; items[itemIndex].makingEntries[meIndex] = { ...items[itemIndex].makingEntries[meIndex], [field]: value }; return { ...f, items } })
  }

  const addPayment = () => {
    setSalesOrderForm(f => ({ ...f, payments: [...f.payments, { amount: '', paymentType: 'cash', paymentMode: 'advance', paymentDate: new Date().toISOString().split('T')[0], chequeNo: '', bankName: '', notes: '' }] }))
  }

  const removePayment = (index: number) => {
    setSalesOrderForm(f => ({ ...f, payments: f.payments.filter((_, i) => i !== index) }))
  }

  const updatePayment = (index: number, field: string, value: string) => {
    setSalesOrderForm(f => { const payments = [...f.payments]; payments[index] = { ...payments[index], [field]: value }; return { ...f, payments } })
  }

  const handleSaveSalesOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity) return
    if (salesOrderForm.items.length === 0) { toast({ title: 'Error', description: 'Add at least one item', variant: 'destructive' }); return }
    const itemCount = salesOrderForm.items.length
    const totalQty = salesOrderForm.items.reduce((s, it: any) => s + (parseInt(it.quantity) || 0), 0)
    const totalAmount = salesOrderForm.items.reduce((s, it: any) => s + (parseInt(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0) - (parseFloat(salesOrderForm.discount) || 0)
    const ok = await confirm({
      title: editingSalesOrderId ? 'Update Sales Order?' : 'Create Sales Order?',
      message: `This will ${editingSalesOrderId ? 'update' : 'create'} a sales order with ${itemCount} item line(s), ${totalQty} unit(s) total, and a net amount of ${totalAmount.toFixed(2)}. Stock will be reduced and incentives will be auto-calculated. Regular users will not be able to modify this order afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: editingSalesOrderId ? 'Update Order' : 'Create Order',
    })
    if (!ok) return
    try {
      let customerId = salesOrderForm.customerId
      if (salesCustomerMode === 'new') {
        if (!salesOrderForm.newCustomerName) { toast({ title: 'Error', description: 'Customer name required', variant: 'destructive' }); return }
        const custRes = await authFetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: salesOrderForm.newCustomerName, phone: salesOrderForm.newCustomerPhone, email: salesOrderForm.newCustomerEmail, address: salesOrderForm.newCustomerAddress, type: 'regular', status: 'active' }) })
        const custData = await custRes.json()
        if (custRes.ok && custData.customer) { customerId = custData.customer.id } else { toast({ title: 'Error', description: 'Failed to create customer', variant: 'destructive' }); return }
      }
      const payload = {
        entityId: workingEntity.id, customerId,
        salesPersonId: salesOrderForm.salesPersonId || undefined,
        discount: parseFloat(salesOrderForm.discount) || 0,
        orderDate: salesOrderForm.orderDate, deliveryDate: salesOrderForm.deliveryDate || undefined,
        status: salesOrderForm.status, notes: salesOrderForm.notes,
        items: salesOrderForm.items.map(i => ({ itemId: i.itemId, quantity: parseInt(i.quantity) || 1, unitPrice: parseFloat(i.unitPrice) || 0, makingEntries: i.makingEntries.map(me => ({ name: me.name, unitPrice: parseFloat(me.unitPrice) || 0, quantity: parseInt(me.quantity) || 1 })) })),
        payments: salesOrderForm.payments.map(p => ({ amount: parseFloat(p.amount) || 0, paymentType: p.paymentType, paymentMode: p.paymentMode, paymentDate: p.paymentDate, chequeNo: p.chequeNo || undefined, bankName: p.bankName || undefined, notes: p.notes || undefined })),
      }
      const res = await authFetch('/api/sales-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { const data = await res.json(); toast({ title: 'Success', description: `Sales order created: ${data.salesOrder?.salesNo || ''}` }); setShowSalesOrderDialog(false); resetSalesOrderForm(); fetchSalesOrders() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  // Add payment to existing sales order
  const handleAddPayment = async () => {
    if (!editingSalesOrderId || !addPaymentForm.amount) return
    try {
      const res = await authFetch(`/api/sales-orders/${editingSalesOrderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addPayment: { amount: parseFloat(addPaymentForm.amount), paymentType: addPaymentForm.paymentType, paymentMode: addPaymentForm.paymentMode, paymentDate: addPaymentForm.paymentDate, chequeNo: addPaymentForm.chequeNo || undefined, bankName: addPaymentForm.bankName || undefined, notes: addPaymentForm.notes || undefined } }) })
      if (res.ok) { const data = await res.json(); toast({ title: 'Payment Added', description: `Receipt: ${data.payment?.receiptNo || ''}` }); setShowAddPaymentDialog(false); setAddPaymentForm({ amount: '', paymentType: 'cash', paymentMode: 'collection', paymentDate: new Date().toISOString().split('T')[0], chequeNo: '', bankName: '', notes: '' }); fetchSalesOrders() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  // Print sales invoice — Bright Solutions style
  const printSalesInvoice = (s: any) => {
    const win = window.open('', '_blank', 'width=820,height=720')
    if (!win) return
    const entityName = s.entity?.name || workingEntity?.name || ''
    const entityDesc = s.entity?.description || ''
    // Generate initials for hexagonal logo (max 2 chars)
    const initials = entityName.split(/\s+/).slice(0, 2).map((w: string) => w[0] || '').join('').toUpperCase() || 'DF'
    const custName = s.customer?.name || '—'
    const custPhone = s.customer?.phone || ''
    const custAddr = s.customer?.address || ''
    const orderDateStr = s.orderDate ? bdDate(new Date(s.orderDate)) : bdDate(new Date(s.createdAt))
    const deliveryDateStr = s.deliveryDate ? bdDate(new Date(s.deliveryDate)) : '—'
    const printedOn = bdNow()

    // Build items table — each item row + nested making rows in same column style
    const itemsHtml = (s.items || []).map((si: any, i: number) => {
      const makingRows = (si.makingEntries || []).map((me: any) => {
        const meTotal = (me.quantity || 0) * (me.unitPrice || 0)
        return `<tr class="making-row">
          <td style="text-align:center;color:#666">↳</td>
          <td><span class="making-label">Making:</span> ${me.name || '—'} <span class="qty-price">(${me.quantity} × ${(me.unitPrice || 0).toFixed(2)})</span></td>
          <td class="num">${(me.unitPrice || 0).toFixed(2)}</td>
          <td class="num">${meTotal.toFixed(2)}</td>
        </tr>`
      }).join('')
      const itemBaseTotal = (si.quantity || 0) * (si.unitPrice || 0)
      const itemTotal = itemBaseTotal + (si.makingEntries || []).reduce((m: number, me: any) => m + (me.quantity || 0) * (me.unitPrice || 0), 0)
      return `<tr class="item-row">
        <td class="num">${i + 1}</td>
        <td><strong>${si.item?.itemName || '—'}</strong><br><span class="qty-price">Quantity: ${si.quantity} × Unit Price: ${(si.unitPrice || 0).toFixed(2)}</span></td>
        <td class="num">${(si.unitPrice || 0).toFixed(2)}</td>
        <td class="num bold">${itemTotal.toFixed(2)}</td>
      </tr>${makingRows}`
    }).join('')

    const grandTotalPreDiscount = subTotal + makingTotal
    const discount = s.discount || 0
    const grandTotal = grandTotalPreDiscount - discount
    const totalPaid = (s.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0)
    const due = grandTotal - totalPaid

    const paymentsHtml = (s.payments || []).map((p: any) => {
      const pdStr = p.paymentDate ? bdDate(new Date(p.paymentDate)) : '—'
      let methodStr = p.paymentType || ''
      if (p.paymentType === 'cheque') methodStr = `Cheque${p.chequeNo ? ` (#${p.chequeNo})` : ''}${p.bankName ? ` - ${p.bankName}` : ''}`
      else if (p.paymentType === 'cash') methodStr = 'Cash'
      else if (p.paymentType === 'card') methodStr = 'Card'
      else if (p.paymentType === 'mobile_banking') methodStr = 'Mobile Banking'
      return `<tr>
        <td>${pdStr}</td>
        <td>${methodStr}</td>
        <td class="num">${(p.amount || 0).toFixed(2)}</td>
      </tr>`
    }).join('')

    win.document.write(`<html><head><title>Invoice ${s.salesNo || ''}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,sans-serif;padding:25px 35px;color:#1f2937;background:#fff;font-size:13px;line-height:1.5}
      .top-bar{display:flex;justify-content:space-between;align-items:flex-start;gap:30px;padding-bottom:18px;border-bottom:3px solid #1e3a8a}
      .biz{display:flex;gap:14px;align-items:flex-start}
      .logo{width:62px;height:62px;background:#1e3a8a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;letter-spacing:1px;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);flex-shrink:0}
      .biz-info h1{font-size:20px;color:#1e3a8a;letter-spacing:0.5px;margin-bottom:2px;font-weight:700}
      .biz-info .subtitle{font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
      .biz-info .addr{font-size:11.5px;color:#475569;line-height:1.5}
      .doc-meta{text-align:right;flex-shrink:0}
      .doc-meta .doc-title{font-size:24px;font-weight:800;color:#1e3a8a;letter-spacing:2px;margin-bottom:8px}
      .doc-meta .meta-row{font-size:11.5px;color:#374151;line-height:1.7}
      .doc-meta .meta-row strong{color:#1e293b;min-width:90px;display:inline-block;text-align:left}
      .doc-meta .sales-no{font-size:13px;font-weight:700;color:#dc2626;font-family:monospace}
      .section{margin-top:18px}
      .section-title{font-size:10.5px;font-weight:700;color:#1e3a8a;letter-spacing:1.5px;text-transform:uppercase;background:#eff6ff;padding:6px 10px;border-left:3px solid #1e3a8a;margin-bottom:8px}
      .cust-box{padding:8px 12px;font-size:12.5px;line-height:1.7;color:#1f2937}
      .cust-box .cust-name{font-size:14px;font-weight:700;color:#1e3a8a;margin-bottom:2px}
      table{width:100%;border-collapse:collapse}
      th{background:#1e3a8a;color:#fff;padding:9px 10px;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;text-align:left;font-weight:600}
      th.num,td.num{text-align:right}
      td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px}
      tr.item-row td{background:#fff}
      tr.making-row td{background:#f8fafc;color:#64748b;font-size:11px;padding:5px 10px 5px 28px}
      .making-label{font-style:italic;color:#475569}
      .qty-price{color:#64748b;font-size:10.5px}
      td.bold{font-weight:700;color:#1e293b}
      .summary-section{display:flex;justify-content:flex-end;margin-top:14px}
      .summary{width:300px;border:1.5px solid #1e3a8a}
      .summary table{width:100%}
      .summary td{border:none;padding:7px 12px;font-size:12.5px;border-bottom:1px solid #e5e7eb}
      .summary tr:last-child td{border-bottom:none}
      .summary .label{color:#475569}
      .summary .grand td{background:#1e3a8a;color:#fff;font-weight:700;font-size:14px;padding:9px 12px}
      .summary .due td{background:#fef2f2;color:#dc2626;font-weight:700;font-size:14px;padding:9px 12px;border-top:2px solid #dc2626}
      .pay-table{margin-top:0}
      .pay-table th{background:#475569}
      .footer{margin-top:30px;padding-top:14px;border-top:1px solid #cbd5e1;display:flex;justify-content:space-between;font-size:10.5px;color:#64748b}
      .sign-row{margin-top:35px;display:flex;justify-content:space-between;padding:0 10px}
      .sign-row div{border-top:1.5px solid #1e293b;padding-top:5px;width:180px;text-align:center;font-size:11px;color:#475569;font-weight:600}
      .thank-you{text-align:center;margin-top:20px;font-size:11px;color:#1e3a8a;font-weight:600;letter-spacing:1px}
      @media print{body{padding:15px 20px}}
    </style></head><body>
      <div class="top-bar">
        <div class="biz">
          <div class="logo">${initials}</div>
          <div class="biz-info">
            <h1>${entityName}</h1>
            <div class="subtitle">Inventory & Sales</div>
            <div class="addr">${entityDesc || '&nbsp;'}</div>
          </div>
        </div>
        <div class="doc-meta">
          <div class="doc-title">INVOICE</div>
          <div class="meta-row sales-no">${s.salesNo || ''}</div>
          <div class="meta-row"><strong>Order Date:</strong> ${orderDateStr}</div>
          <div class="meta-row"><strong>Delivery Date:</strong> ${deliveryDateStr}</div>
          ${s.notes ? `<div class="meta-row"><strong>Sales Note:</strong> ${s.notes}</div>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Customer Information</div>
        <div class="cust-box">
          <div class="cust-name">${custName}</div>
          ${custPhone ? `<div><strong>Phone:</strong> ${custPhone}</div>` : ''}
          ${custAddr ? `<div><strong>Address:</strong> ${custAddr}</div>` : ''}
        </div>
      </div>

      <div class="section">
        <table>
          <thead><tr>
            <th style="width:40px;text-align:center">SL</th>
            <th>Item Description</th>
            <th style="width:110px;text-align:right">Unit Price (BDT)</th>
            <th style="width:120px;text-align:right">Total (BDT)</th>
          </tr></thead>
          <tbody>
            ${itemsHtml || `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">No items</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="summary-section">
        <div class="summary">
          <table>
            <tr><td class="label">Sub Total</td><td class="num">${subTotal.toFixed(2)}</td></tr>
            <tr><td class="label">Making Charges</td><td class="num">${makingTotal.toFixed(2)}</td></tr>
            <tr><td class="label">Total Amount</td><td class="num">${grandTotalPreDiscount.toFixed(2)}</td></tr>
            ${discount > 0 ? `<tr><td class="label">Discount</td><td class="num">-${discount.toFixed(2)}</td></tr>` : ''}
            <tr class="grand"><td>GRAND TOTAL</td><td class="num">${grandTotal.toFixed(2)}</td></tr>
          </table>
        </div>
      </div>

      ${(s.payments && s.payments.length > 0) ? `
      <div class="section">
        <div class="section-title">Payment Information</div>
        <table class="pay-table">
          <thead><tr>
            <th style="width:140px">Payment Date</th>
            <th>Payment Method</th>
            <th style="width:120px;text-align:right">Amount (BDT)</th>
          </tr></thead>
          <tbody>${paymentsHtml}</tbody>
        </table>
        <div class="summary-section">
          <div class="summary">
            <table>
              <tr><td class="label">Total Paid</td><td class="num">${totalPaid.toFixed(2)}</td></tr>
              <tr class="due"><td>DUE AMOUNT</td><td class="num">${due.toFixed(2)}</td></tr>
            </table>
          </div>
        </div>
      </div>` : `<div class="summary-section"><div class="summary"><table><tr class="due"><td>DUE AMOUNT</td><td class="num">${due.toFixed(2)}</td></tr></table></div></div>`}

      <div class="sign-row">
        <div>Authorized Signature</div>
        <div>Customer Signature</div>
      </div>

      <div class="thank-you">Thank you for your business!</div>

      <div class="footer">
        <div>Prepared By: ${user?.displayName || 'System'}</div>
        <div>Printed On: ${printedOn}</div>
      </div>

      ${custPhone ? `<div style="text-align:center;margin-top:15px"><a href="https://wa.me/${custPhone.replace(/[^0-9]/g, '').replace(/^0/, '880')}" target="_blank" style="display:inline-block;padding:8px 24px;background:#25D366;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">📱 Send via WhatsApp</a></div>` : ''}

      <script>window.onload=()=>window.print()</script>
    </body></html>`)
    win.document.close()
  }

  // Print money receipt
  const printMoneyReceipt = (s: any, p: any) => {
    const win = window.open('', '_blank', 'width=600,height=500')
    if (!win) return
    win.document.write(`<html><head><title>Money Receipt ${p.receiptNo}</title><style>body{font-family:Arial;padding:40px}h1{font-size:20px;text-align:center}.info{margin:20px 0;font-size:14px}.amt{font-size:24px;font-weight:bold;text-align:center;margin:20px 0}.sig{margin-top:50px;text-align:center;border-top:1px solid #000;padding-top:5px;width:250px;margin-left:auto;margin-right:auto;font-size:12px}</style></head><body><h1>MONEY RECEIPT</h1><div class="info"><strong>Receipt No:</strong> ${p.receiptNo}<br><strong>Sales Order:</strong> ${s.salesNo||''}<br><strong>Customer:</strong> ${s.customer?.name||'—'}<br><strong>Date:</strong> ${bdDate(new Date(p.paymentDate))}<br><strong>Payment Type:</strong> ${p.paymentType}<br><strong>Payment Mode:</strong> ${p.paymentMode}${p.chequeNo?`<br><strong>Cheque No:</strong> ${p.chequeNo}`:''}${p.bankName?`<br><strong>Bank:</strong> ${p.bankName}`:''}</div><div class="amt">Amount: ${p.amount.toFixed(2)}</div>${p.notes?`<p><strong>Notes:</strong> ${p.notes}</p>`:''}<div class="sig">Authorized Signature</div><script>window.onload=()=>window.print()</script></body></html>`)
    win.document.close()
  }

  const handleSaveSalesReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !salesReturnForm.itemId || !salesReturnForm.customerId || !salesReturnForm.quantity) return
    const ok = await confirm({
      title: 'Create Sales Return?',
      message: `This will create a sales return for ${salesReturnForm.quantity} unit(s) at price ${salesReturnForm.price}. When approved, the stock will be increased. Regular users will not be able to modify this return afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: 'Create Return',
    })
    if (!ok) return
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
  useEffect(() => { if (currentView === 'uom' || currentView === 'newItem' || currentView === 'editItem') fetchUom() }, [currentView])
  useEffect(() => { if (currentView === 'suppliers') fetchSuppliers() }, [currentView])
  useEffect(() => { if (currentView === 'employees') fetchEmployees() }, [currentView])
  useEffect(() => { if (currentView === 'customers') fetchCustomers() }, [currentView])
  useEffect(() => { if (currentView === 'groups') fetchGroups() }, [currentView])
  useEffect(() => { if (currentView === 'subGroups') { fetchSubGroups(); fetchGroups() } }, [currentView])
  useEffect(() => { if (currentView === 'newItem' || currentView === 'editItem') { fetchGroups(); fetchSubGroups() } }, [currentView])
  useEffect(() => { if (currentView === 'itemAdjustment') fetchAdjustments() }, [currentView])
  useEffect(() => { if (currentView === 'transfer') fetchTransfers() }, [currentView])
  useEffect(() => { if (currentView === 'receive') { fetchReceives(); fetchIncomingTransfers() } }, [currentView, workingEntity?.id])
  // ★ Fetch purchases when entering Purchase list or Purchase Approval page
  useEffect(() => { if (currentView === 'purchase' || currentView === 'purchaseApproval') fetchPurchases() }, [currentView])
  useEffect(() => { if (currentView === 'salesOrder') fetchSalesOrders() }, [currentView])
  useEffect(() => { if (currentView === 'delivery') fetchSalesOrders() }, [currentView])
  useEffect(() => {
    if (currentView === 'supplierPayments' && workingEntity) { fetchSupplierPayments() }
    if (currentView === 'stockUpload' && workingEntity && !stockUploadEntityId) {
      setStockUploadEntityId(workingEntity.id)
    }
  }, [currentView, workingEntity?.id, stockUploadEntityId])
  useEffect(() => {
    if (currentView === 'tailorPayment' && workingEntity) fetchTailorPayments()
    if (currentView === 'newTailorPayment' && workingEntity) {
      fetchTailors()
      fetchSalesOrders() // for sales order dropdown
    }
  }, [currentView, workingEntity?.id])

  // ★ Tailor Payments fetch handlers
  const fetchTailorPayments = async () => {
    if (!workingEntity) return
    setTailorPaymentLoading(true)
    try {
      const res = await authFetch(`/api/tailor-payments?entityId=${workingEntity.id}`)
      if (res.ok) { const d = await res.json(); setTailorPayments(d.payments || []) }
    } catch {} finally { setTailorPaymentLoading(false) }
  }
  // ★ fetchTailors already exists above (takes optional entityId param)
  const handleSaveTailorPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workingEntity || !tailorPaymentForm.salesOrderId || !tailorPaymentForm.tailorId || !tailorPaymentForm.amount) {
      toast({ title: 'Error', description: 'All required fields must be filled', variant: 'destructive' })
      return
    }
    const ok = await confirm({
      title: 'Save Tailor Payment?',
      message: `This will record a payment of ${parseFloat(tailorPaymentForm.amount).toFixed(2)} to the selected tailor for the selected sales order. The payment will be recorded permanently and used in the tailor's payment history. Regular users will not be able to modify this payment afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: 'Save Payment',
    })
    if (!ok) return
    try {
      const res = await authFetch('/api/tailor-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tailorPaymentForm, entityId: workingEntity.id, amount: parseFloat(tailorPaymentForm.amount) }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Success', description: data.warning ? `Payment saved. ${data.warning}` : 'Tailor payment saved' })
        setTailorPaymentForm({ salesOrderId: '', tailorId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentType: 'cash', referenceNo: '', notes: '' })
        setCurrentView('tailorPayment')
        fetchTailorPayments()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Failed to save payment', variant: 'destructive' }) }
  }
  const handleDeleteTailorPayment = async (id: string) => {
    if (!confirm('Delete this payment record?')) return
    try {
      const res = await authFetch(`/api/tailor-payments/${id}`, { method: 'DELETE' })
      if (res.ok) { toast({ title: 'Success', description: 'Payment deleted' }); fetchTailorPayments() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  // ★ Chat: fetch partner list when chat opened
  const fetchChatPartners = async () => {
    if (!workingEntity) return
    try {
      const res = await authFetch(`/api/chat?entityId=${workingEntity.id}`)
      if (res.ok) { const d = await res.json(); setChatPartners(d.partners || []) }
    } catch {}
  }

  // ★ Chat: fetch mentionable users for a SPECIFIC entity (the chat partner)
  const fetchMentionUsers = async (entityId?: string) => {
    const targetEntityId = entityId || workingEntity?.id
    if (!targetEntityId) return
    try {
      const res = await authFetch(`/api/chat?entityId=${targetEntityId}&users=true`)
      if (res.ok) { const d = await res.json(); setChatMentionUsers(d.users || []) }
    } catch {}
  }

  // ★ Chat: handle @ mention in input
  const handleChatInputChange = (value: string) => {
    setChatInput(value)
    // Detect @ mention
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex >= 0) {
      const query = value.substring(lastAtIndex + 1)
      // Only show suggestions if there's no space after @ (still typing the name)
      if (!query.includes(' ')) {
        setChatMentionQuery(query)
        setChatMentionStart(lastAtIndex)
      } else {
        setChatMentionStart(-1)
      }
    } else {
      setChatMentionStart(-1)
    }
  }

  // ★ Chat: select a mentioned user
  const selectMentionUser = (user: any) => {
    const before = chatInput.substring(0, chatMentionStart)
    const after = chatInput.substring(chatMentionStart + 1 + chatMentionQuery.length)
    const newValue = `${before}@${user.displayName} ${after}`
    setChatInput(newValue)
    setChatMentionStart(-1)
  }

  const filteredMentionUsers = chatMentionQuery
    ? chatMentionUsers.filter(u => u.displayName.toLowerCase().includes(chatMentionQuery.toLowerCase()) || u.username.toLowerCase().includes(chatMentionQuery.toLowerCase()))
    : chatMentionUsers

  // ★ Chat: poll for unread messages (notification badge)
  useEffect(() => {
    if (!workingEntity || chatOpen) return
    const fetchUnread = async () => {
      try {
        const res = await authFetch(`/api/chat?entityId=${workingEntity.id}`)
        if (res.ok) { const d = await res.json(); const total = (d.partners || []).reduce((s: number, p: any) => s + (p.unread || 0), 0); setChatUnreadCount(total) }
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [workingEntity?.id, chatOpen])

  // ★ Chat: fetch messages with a specific partner
  const fetchChatMessages = async (partnerId: string) => {
    if (!workingEntity) return
    setChatLoading(true)
    try {
      const res = await authFetch(`/api/chat?entityId=${workingEntity.id}&partnerEntityId=${partnerId}`)
      if (res.ok) { const d = await res.json(); setChatMessages(d.messages || []) }
    } catch {} finally { setChatLoading(false) }
  }

  // ★ Chat: send a message
  const sendChatMessage = async () => {
    if (!workingEntity || !chatPartnerId || !chatInput.trim()) return
    try {
      const res = await authFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromEntityId: workingEntity.id, toEntityId: chatPartnerId, message: chatInput }) })
      if (res.ok) { setChatInput(''); fetchChatMessages(chatPartnerId) }
    } catch {}
  }

  // ★ News Ticker: fetch active messages
  const fetchTickerMessages = async () => {
    try {
      const res = await authFetch('/api/news-ticker')
      if (res.ok) { const d = await res.json(); setTickerMessages((d.messages || []).map((m: any) => m.message)) }
    } catch {}
  }

  // ★ News Ticker: post a new message (admin/manager only)
  const postTickerMessage = async () => {
    if (!tickerInput.trim()) return
    try {
      const res = await authFetch('/api/news-ticker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: tickerInput }) })
      if (res.ok) { setTickerInput(''); setShowTickerInput(false); fetchTickerMessages() }
    } catch {}
  }

  // Poll ticker messages every 30s when logged in
  useEffect(() => {
    if (user) { fetchTickerMessages(); const interval = setInterval(fetchTickerMessages, 30000); return () => clearInterval(interval) }
  }, [user])
  useEffect(() => { if (currentView === 'salesReturn') fetchSalesReturns() }, [currentView])
  useEffect(() => { if (currentView === 'incentive') fetchIncentives() }, [currentView])

  // ★ Incentive Formula handlers
  const fetchIncentiveFormulas = async () => {
    try {
      const res = await authFetch('/api/incentive-formulas')
      if (res.ok) { const d = await res.json(); setIncentiveFormulas(d.formulas || []) }
    } catch {}
  }
  useEffect(() => { if (currentView === 'incentive') fetchIncentiveFormulas() }, [currentView])

  const resetFormulaForm = () => {
    setFormulaForm({
      name: '', description: '',
      ranges: [{ priceFrom: '', priceTo: '', outletCommission: '', headOfficeCommission: '' }],
      status: 'active', notes: '', itemIds: [], itemNames: {},
    })
    setEditingFormulaId(null)
    setFormulaItemSearch('')
    setFormulaItemResults([])
  }
  const openNewFormulaPage = () => { resetFormulaForm(); setCurrentView('newFormula') }
  const openEditFormulaPage = (f: any) => {
    const itemNames: Record<string, string> = {}
    for (const fi of (f.items || [])) {
      if (fi.item) itemNames[fi.itemId] = fi.item.itemName || fi.item.itemCode || 'Unknown'
    }
    setFormulaForm({
      name: f.name, description: f.description || '',
      ranges: (f.ranges || []).map((r: any) => ({
        priceFrom: String(r.priceFrom), priceTo: String(r.priceTo),
        outletCommission: String(r.outletCommission), headOfficeCommission: String(r.headOfficeCommission),
      })),
      status: f.status, notes: f.notes || '',
      itemIds: (f.items || []).map((fi: any) => fi.itemId),
      itemNames,
    })
    setEditingFormulaId(f.id)
    setCurrentView('newFormula')
  }
  const addFormulaRange = () => {
    setFormulaForm(f => ({ ...f, ranges: [...f.ranges, { priceFrom: '', priceTo: '', outletCommission: '', headOfficeCommission: '' }] }))
  }
  const updateFormulaRange = (idx: number, field: 'priceFrom' | 'priceTo' | 'outletCommission' | 'headOfficeCommission', value: string) => {
    setFormulaForm(f => {
      const ranges = [...f.ranges]
      ranges[idx] = { ...ranges[idx], [field]: value }
      return { ...f, ranges }
    })
  }
  const removeFormulaRange = (idx: number) => {
    setFormulaForm(f => ({ ...f, ranges: f.ranges.filter((_, i) => i !== idx) }))
  }
  const handleFormulaItemSearch = async () => {
    if (!formulaItemSearch.trim()) return
    try {
      const res = await authFetch(`/api/items?search=${encodeURIComponent(formulaItemSearch)}&pageSize=20`)
      if (res.ok) { const d = await res.json(); setFormulaItemResults(d.items || []) }
    } catch {}
  }
  const toggleFormulaItem = (itemId: string, itemName?: string) => {
    setFormulaForm(f => {
      const isIn = f.itemIds.includes(itemId)
      const newNames = { ...f.itemNames }
      if (!isIn && itemName) newNames[itemId] = itemName
      return {
        ...f,
        itemIds: isIn ? f.itemIds.filter(id => id !== itemId) : [...f.itemIds, itemId],
        itemNames: newNames,
      }
    })
  }
  const handleSaveFormula = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formulaForm.name) { toast({ title: 'Error', description: 'Formula name required', variant: 'destructive' }); return }
    const validRanges = formulaForm.ranges.filter(r => r.priceFrom && r.priceTo)
    if (validRanges.length === 0) { toast({ title: 'Error', description: 'At least one price range required', variant: 'destructive' }); return }
    const payload = {
      name: formulaForm.name,
      description: formulaForm.description || undefined,
      ranges: validRanges.map(r => ({
        priceFrom: parseFloat(r.priceFrom),
        priceTo: parseFloat(r.priceTo),
        outletCommission: parseFloat(r.outletCommission) || 0,
        headOfficeCommission: parseFloat(r.headOfficeCommission) || 0,
      })),
      status: formulaForm.status,
      notes: formulaForm.notes || undefined,
      itemIds: formulaForm.itemIds,
    }
    try {
      const res = editingFormulaId
        ? await authFetch(`/api/incentive-formulas/${editingFormulaId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await authFetch('/api/incentive-formulas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        toast({ title: 'Success', description: editingFormulaId ? 'Formula updated' : 'Formula created' })
        resetFormulaForm()
        setCurrentView('incentive')
        fetchIncentiveFormulas()
      } else {
        const d = await res.json()
        toast({ title: 'Error', description: d.error || 'Failed', variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const handleDeleteFormula = async (id: string) => {
    if (!confirm('Delete this formula? Auto-generated incentives from this formula will remain but lose their formula link.')) return
    try {
      const res = await authFetch(`/api/incentive-formulas/${id}`, { method: 'DELETE' })
      if (res.ok) { toast({ title: 'Deleted' }); fetchIncentiveFormulas() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch {}
  }
  useEffect(() => { if (currentView === 'booking') { handleAutoCancelBookings(); fetchBookings() } }, [currentView])
  useEffect(() => { if (currentView === 'booking' || currentView === 'bookingReasons') fetchBookingReasons() }, [currentView])

  const fetchBookingReasons = async () => { try { const res = await authFetch('/api/booking-reasons'); if (res.ok) { const d = await res.json(); setBookingReasons(d.reasons) } } catch {} }

  const handleSaveBookingReason = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = editingReasonId
        ? await authFetch(`/api/booking-reasons/${editingReasonId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookingReasonForm) })
        : await authFetch('/api/booking-reasons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookingReasonForm) })
      if (res.ok) { toast({ title: 'Success', description: editingReasonId ? 'Reason updated' : 'Reason created' }); setShowReasonDialog(false); setBookingReasonForm({ name: '', description: '', status: 'active' }); setEditingReasonId(null); fetchBookingReasons() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const handleDeleteBookingReason = async (id: string) => { if (!confirm('Delete this reason?')) return; try { const res = await authFetch(`/api/booking-reasons/${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Deleted' }); fetchBookingReasons() } } catch {} }

  // Auto-cancel expired bookings
  const handleAutoCancelBookings = async () => {
    try {
      const now = new Date().toISOString()
      const res = await authFetch('/api/bookings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoCancel: true, now }) })
      if (res.ok) { const d = await res.json(); if (d.cancelled > 0) { toast({ title: 'Auto-Cancelled', description: `${d.cancelled} expired booking(s) cancelled` }) } }
    } catch {}
  }

  // Reports fetch
  const fetchReports = useCallback(async () => {
    setReportLoading(true)
    try {
      const params = new URLSearchParams()
      const entityId = reportEntity === '__all__' ? '' : reportEntity
      if (entityId) params.set('entityId', entityId)
      if (reportRange === 'custom') {
        if (!reportCustomFrom || !reportCustomTo) {
          toast({ title: 'Select dates', description: 'Please pick From and To dates for custom range', variant: 'destructive' })
          setReportLoading(false)
          return
        }
        params.set('from', new Date(reportCustomFrom + 'T00:00:00').toISOString())
        params.set('to', new Date(reportCustomTo + 'T23:59:59').toISOString())
      } else if (reportRange !== 'all') {
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
  }, [reportEntity, reportRange, reportCustomFrom, reportCustomTo, toast])

  useEffect(() => { if (currentView === 'reports' && user) fetchReports() }, [currentView, user, reportRange, reportEntity, reportCustomFrom, reportCustomTo])

  // ★ Reports Excel export
  const handleExportReports = async () => {
    if (!reportData) return
    setReportExporting(true)
    try {
      // Build the same query string as fetchReports
      const params = new URLSearchParams()
      const entityId = reportEntity === '__all__' ? '' : reportEntity
      if (entityId) params.set('entityId', entityId)
      if (reportRange === 'custom') {
        params.set('from', new Date(reportCustomFrom + 'T00:00:00').toISOString())
        params.set('to', new Date(reportCustomTo + 'T23:59:59').toISOString())
      } else if (reportRange !== 'all') {
        const days = parseInt(reportRange)
        const to = new Date()
        const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
        params.set('from', from.toISOString())
        params.set('to', to.toISOString())
      }
      params.set('format', 'xlsx')
      params.set('tab', reportTab)
      const res = await authFetch(`/api/reports/export?${params.toString()}`)
      if (!res.ok) { toast({ title: 'Error', description: 'Export failed', variant: 'destructive' }); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const today = new Date().toISOString().split('T')[0]
      a.download = `report-${reportTab}-${today}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      toast({ title: 'Downloaded', description: a.download })
    } catch { toast({ title: 'Error', description: 'Export failed', variant: 'destructive' }) }
    finally { setReportExporting(false) }
  }

  const handleSaveTailor = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = editingTailorId
        ? await authFetch(`/api/tailors/${editingTailorId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tailorForm) })
        : await authFetch('/api/tailors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tailorForm) })
      if (res.ok) { toast({ title: 'Success', description: editingTailorId ? 'Tailor updated' : 'Tailor created' }); setShowTailorDialog(false); setTailorForm({ name: '', phone: '', address: '', specialization: '', status: 'active', entityIds: [] }); setEditingTailorId(null); fetchTailors() }
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
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        // ★ Show the cascade message from the server if present (e.g. "UoM renamed. 5 item(s) updated.")
        const desc = data.message || (editingUomId ? 'UoM updated' : 'UoM created')
        toast({ title: 'Success', description: desc })
        setShowUomDialog(false)
        setUomForm({ name: '', description: '' })
        setEditingUomId(null)
        fetchUom()
        // ★ Items cache may be stale after a UoM rename cascade — refresh.
        fetchItems()
      }
      else { toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' }) }
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

  // ★ Employee handlers
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = { ...employeeForm, roles: employeeForm.roles.join(',') }
      const res = editingEmployeeId
        ? await authFetch(`/api/employees/${editingEmployeeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await authFetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        toast({ title: 'Success', description: editingEmployeeId ? 'Employee updated' : 'Employee created' })
        setShowEmployeeDialog(false)
        setEmployeeForm({ name: '', phone: '', email: '', address: '', designation: '', roles: [], status: 'active', notes: '' })
        setEditingEmployeeId(null)
        fetchEmployees()
      } else {
        const d = await res.json()
        toast({ title: 'Error', description: d.error, variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Delete this employee? Sales orders linked to them will have salesPerson cleared.')) return
    try {
      const res = await authFetch(`/api/employees/${id}`, { method: 'DELETE' })
      if (res.ok) { toast({ title: 'Deleted' }); fetchEmployees() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch {}
  }
  const openNewEmployeeDialog = () => {
    setEditingEmployeeId(null)
    setEmployeeForm({ name: '', phone: '', email: '', address: '', designation: '', roles: [], status: 'active', notes: '' })
    setShowEmployeeDialog(true)
  }
  const openEditEmployeeDialog = (emp: EmployeeData) => {
    setEditingEmployeeId(emp.id)
    setEmployeeForm({
      name: emp.name, phone: emp.phone, email: emp.email, address: emp.address,
      designation: emp.designation, roles: (emp.roles || '').split(',').filter(Boolean),
      status: emp.status, notes: emp.notes || '',
    })
    setShowEmployeeDialog(true)
  }
  const toggleEmployeeRole = (role: string) => {
    setEmployeeForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }))
  }

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

  // Group & SubGroup fetch & handlers
  const fetchGroups = async () => { try { const res = await authFetch('/api/groups'); if (res.ok) { const d = await res.json(); setGroups(d.groups) } } catch {} }
  const fetchSubGroups = async () => { try { const res = await authFetch('/api/subgroups'); if (res.ok) { const d = await res.json(); setSubGroups(d.subGroups) } } catch {} }

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = editingGroupId
        ? await authFetch(`/api/groups/${editingGroupId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groupForm) })
        : await authFetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groupForm) })
      if (res.ok) { toast({ title: 'Success', description: editingGroupId ? 'Group updated' : 'Group created' }); setShowGroupDialog(false); setGroupForm({ name: '', description: '', status: 'active' }); setEditingGroupId(null); fetchGroups() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const handleDeleteGroup = async (id: string) => { if (!confirm('Delete this group and all its subgroups?')) return; try { const res = await authFetch(`/api/groups/${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Deleted' }); fetchGroups(); fetchSubGroups() } } catch {} }

  const handleSaveSubGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = editingSubGroupId
        ? await authFetch(`/api/subgroups/${editingSubGroupId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subGroupForm) })
        : await authFetch('/api/subgroups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subGroupForm) })
      if (res.ok) { toast({ title: 'Success', description: editingSubGroupId ? 'SubGroup updated' : 'SubGroup created' }); setShowSubGroupDialog(false); setSubGroupForm({ name: '', groupId: '', description: '', status: 'active' }); setEditingSubGroupId(null); fetchSubGroups() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }
  const handleDeleteSubGroup = async (id: string) => { if (!confirm('Delete this subgroup?')) return; try { const res = await authFetch(`/api/subgroups/${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Deleted' }); fetchSubGroups() } } catch {} }

  // Upload handler
  const [uploadResult, setUploadResult] = useState<any>(null)
  // ★ State for the "Update Barcodes" panel (retroactively add barcode/itemCode to existing items)
  const [barcodeUpdateFile, setBarcodeUpdateFile] = useState<File | null>(null)
  const [barcodeUpdating, setBarcodeUpdating] = useState(false)
  const [barcodeUpdateResult, setBarcodeUpdateResult] = useState<any>(null)
  const handleBarcodeUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeUpdateFile) { toast({ title: 'Error', description: 'Select a CSV file', variant: 'destructive' }); return }
    setBarcodeUpdating(true)
    setBarcodeUpdateResult(null)
    try {
      const formData = new FormData(); formData.append('file', barcodeUpdateFile)
      const res = await authFetch('/api/items/update-barcodes', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setBarcodeUpdateResult(data)
        toast({ title: 'Success', description: `Updated ${data.updated} item(s) with barcode/itemCode` })
        setBarcodeUpdateFile(null); fetchItems()
      } else {
        setBarcodeUpdateResult({ error: data.error || 'Update failed' })
        toast({ title: 'Error', description: data.error || 'Update failed', variant: 'destructive' })
      }
    } catch (err) { toast({ title: 'Error', description: 'Update failed: ' + String(err), variant: 'destructive' }) }
    finally { setBarcodeUpdating(false) }
  }
  const downloadBarcodeUpdateTemplate = () => {
    const csv = 'itemName,barcode,itemCode\n' +
                'AJ-435-40-A,2606190000001,SM-S23\n' +
                'AJ-435-39-E,2606190000002,SM-S22\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'barcode-update-template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({ title: 'Downloaded', description: 'barcode-update-template.csv' })
  }
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) { toast({ title: 'Error', description: 'Select a CSV file', variant: 'destructive' }); return }
    setUploading(true)
    setUploadResult(null)
    try {
      const formData = new FormData(); formData.append('file', uploadFile)
      const res = await authFetch('/api/items/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setUploadResult(data)
        const parts = [`Uploaded ${data.inserted} items`]
        if (data.duplicate > 0) parts.push(`${data.duplicate} duplicates skipped`)
        if (data.skipped > 0) parts.push(`${data.skipped} skipped`)
        toast({ title: 'Success', description: parts.join(', ') })
        setUploadFile(null); fetchItems()
      }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' }) }
    finally { setUploading(false) }
  }

  // Download items CSV template
  const downloadItemsTemplate = () => {
    const csv = 'year,lcNo,group,subGroup,itemName,price,uom,barcode,itemCode\n' +
                '2024,LC-2024-0001,Electronics,Mobile,Samsung Galaxy S23,75000.00,PCS,8801234567890,SM-S23\n' +
                '2024,LC-2024-0002,Electronics,Laptop,Dell Inspiron 15,55000.00,PCS,8801234567891,DELL-INS-15\n' +
                '2024,LC-2024-0003,Hardware,Hinge,Concealed Hinge,80.50,KG,,HNG-001\n'
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

  // ★ Password change handler
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordChangeForm.newPassword !== passwordChangeForm.confirmPassword) {
      toast({ title: 'Error', description: 'New passwords do not match', variant: 'destructive' })
      return
    }
    if (passwordChangeForm.newPassword.length < 4) {
      toast({ title: 'Error', description: 'Password must be at least 4 characters', variant: 'destructive' })
      return
    }
    setPasswordChanging(true)
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordChangeForm.currentPassword,
          newPassword: passwordChangeForm.newPassword,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Success', description: data.message || 'Password changed' })
        setShowPasswordChangeDialog(false)
        setPasswordChangeForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
    finally { setPasswordChanging(false) }
  }

  // ★ Admin: change another user's password
  const handleAdminPasswordChange = async (userId: string, username: string) => {
    const newPass = prompt(`Enter new password for "${username}":`)
    if (!newPass) return
    if (newPass.length < 4) { toast({ title: 'Error', description: 'Password must be at least 4 characters', variant: 'destructive' }); return }
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword: newPass }),
      })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: data.message }) }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  // Entity handlers
  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await authFetch('/api/entities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entityForm) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: 'Entity created' }); setEntityForm({ name: '', description: '', entityType: 'outlet' }); setShowEntityDialog(false); fetchEntities() }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to create entity', variant: 'destructive' }) }
  }

  const handleUpdateEntity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEntityId) return
    try {
      const res = await authFetch(`/api/entities/${editingEntityId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entityForm) })
      if (res.ok) { toast({ title: 'Success', description: 'Entity updated' }); setEditingEntityId(null); setEntityForm({ name: '', description: '', entityType: 'outlet' }); setShowEntityDialog(false); setCurrentView('entities'); fetchEntities() }
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
    setEditingEntityId(entity.id); setEntityForm({ name: entity.name, description: entity.description || '', entityType: (entity as any).entityType || 'outlet' }); setShowEntityDialog(true)
  }

  const openNewEntityDialog = () => {
    setEditingEntityId(null); setEntityForm({ name: '', description: '', entityType: 'outlet' }); setShowEntityDialog(true)
  }

  // User handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await confirm({
      title: 'Create User?',
      message: `This will create a new user "${userForm.username}" with role "${userForm.role}". The user's permissions will be applied as configured above. Regular users will not be able to modify this user afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: 'Create User',
    })
    if (!ok) return
    try {
      const res = await authFetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, entityIds: userEntityIds, menuAccess: userMenuAccess, masterDataAccess: userMasterDataAccess, columnAccess: columnAccessForm }) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: 'User created' }); setUserForm({ username: '', password: '', displayName: '', role: 'user', canCreateItem: false, canModifyItem: false }); setUserEntityIds([]); setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false }))); setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false }))); setColumnAccessForm(ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => ({ columnName: col.key, canView: true }))); setShowUserDialog(false); setCurrentView('users'); fetchUsers() }
      else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed to create user', variant: 'destructive' }) }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUserId) return
    const ok = await confirm({
      title: 'Update User?',
      message: `This will update user "${userForm.username || ''}" with the new permissions and settings. The changes will be applied immediately and the user will need to log in again for some changes to take effect. Regular users will not be able to modify this user afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: 'Update User',
    })
    if (!ok) return
    try {
      const updateData: Record<string, unknown> = { ...userForm, entityIds: userEntityIds, menuAccess: userMenuAccess, masterDataAccess: userMasterDataAccess, columnAccess: columnAccessForm }
      if (!updateData.password) delete updateData.password
      const res = await authFetch(`/api/users/${editingUserId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateData) })
      const data = await res.json()
      if (res.ok) { toast({ title: 'Success', description: 'User updated' }); setEditingUserId(null); setUserForm({ username: '', password: '', displayName: '', role: 'user', canCreateItem: false, canModifyItem: false }); setUserEntityIds([]); setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false }))); setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false }))); setColumnAccessForm(ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => ({ columnName: col.key, canView: true }))); setShowUserDialog(false); setCurrentView('users'); fetchUsers() }
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
    // ★ Load menu access — preserve all per-action permission flags from existing records
    setUserMenuAccess(u.menuAccess && u.menuAccess.length > 0
      ? ALL_MENU_ITEMS.map(m => {
          const existing = u.menuAccess.find(ma => ma.menuKey === m.key)
          return existing
            ? {
                menuKey: m.key,
                visible: existing.visible,
                canCreate: existing.canCreate ?? false,
                canEdit: existing.canEdit ?? false,
                canDelete: existing.canDelete ?? false,
                canUpload: existing.canUpload ?? false,
                canExport: existing.canExport ?? false,
              }
            : { menuKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false }
        })
      : ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false }))
    )
    // ★ Load master data access — same scheme
    setUserMasterDataAccess(u.masterDataAccess && u.masterDataAccess.length > 0
      ? ALL_MASTER_DATA_ITEMS.map(m => {
          const existing = u.masterDataAccess!.find(mda => mda.masterDataKey === m.key)
          return existing
            ? {
                masterDataKey: m.key,
                visible: existing.visible,
                canCreate: existing.canCreate ?? false,
                canEdit: existing.canEdit ?? false,
                canDelete: existing.canDelete ?? false,
                canUpload: existing.canUpload ?? false,
                canExport: existing.canExport ?? false,
              }
            : { masterDataKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false }
        })
      : ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false }))
    )
    setColumnAccessForm(ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => {
      const existing = u.columnAccess.find(ca => ca.columnName === col.key)
      return { columnName: col.key, canView: existing ? existing.canView : true }
    }))
    setCurrentView('userForm')
  }

  const openNewUserDialog = () => {
    setEditingUserId(null)
    setUserForm({ username: '', password: '', displayName: '', role: 'user', canCreateItem: false, canModifyItem: false })
    setUserEntityIds([])
    setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false })))
    setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false })))
    setColumnAccessForm(ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => ({ columnName: col.key, canView: true })))
    setCurrentView('userForm')
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

  // ★ Error boundary — catch any client-side error and show details
  if (!user) {
    try {
    return (
      <div className="min-h-screen w-full bg-slate-100 flex flex-col lg:flex-row">
        {/* === MOBILE BRANDING HEADER (top) — same gradient style as desktop branding panel === */}
        <div className="lg:hidden relative overflow-hidden bg-gradient-to-br from-indigo-700 via-blue-800 to-slate-900">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-indigo-400/20 rounded-full blur-2xl" />
          </div>
          <div className="relative z-10 p-6 pb-5 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20 shrink-0">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-blue-200">Inventory &amp; Sales</p>
                <p className="text-base font-semibold">DFCL</p>
              </div>
            </div>
            <h1 className="text-2xl font-bold leading-tight mb-2">Akash Inventory System</h1>
            <p className="text-sm text-blue-100/90 leading-snug">Multi-entity inventory, sales, purchase, and incentive management.</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {['Multi-Entity', 'Sales & POS', 'Purchase', 'Incentive', 'Delivery'].map(feature => (
                <span key={feature} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm">{feature}</span>
              ))}
            </div>
          </div>
        </div>

        {/* === LOGIN SIDE === */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10 order-1 lg:order-1">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200/70 p-7 sm:p-9">
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
                <p className="text-slate-500 text-sm mt-1">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {loginError && (
                  <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200 flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">!</span>
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium text-slate-700">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter your username"
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    required
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      required
                      className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500/20 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-11 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 shadow-md shadow-indigo-500/30 text-white font-medium"
                >
                  Sign In
                </Button>
              </form>
            </div>

            {/* Mobile-only developer credit (under the form) */}
            <div className="lg:hidden mt-6 space-y-2 text-center">
              <p className="text-xs text-slate-400">
                Developed by <span className="font-semibold text-slate-600">Abdur Rahman Akash</span>
              </p>
              <a
                href="tel:+8801534955065"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <Phone className="w-3 h-3" />
                <span className="font-mono">+8801534955065</span>
              </a>
              <a
                href="https://wa.me/8801534955065"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 transition-colors font-medium"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span>WhatsApp</span>
              </a>
              <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                <a href="mailto:akashbaani3@gmail.com" className="inline-flex items-center justify-center gap-1.5 hover:text-indigo-600 transition-colors">
                  <Mail className="w-3 h-3" />
                  akashbaani3@gmail.com
                </a>
                <a href="mailto:akashbaani24@gmail.com" className="inline-flex items-center justify-center gap-1.5 hover:text-indigo-600 transition-colors">
                  <Mail className="w-3 h-3" />
                  akashbaani24@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* === BRANDING SIDE (desktop only — same as before) === */}
        <div className="hidden lg:flex lg:flex-1 relative overflow-hidden bg-gradient-to-br from-indigo-700 via-blue-800 to-slate-900 order-2 lg:order-2">
          {/* Decorative geometric shapes */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-blue-300/10 rounded-full blur-3xl" />
          </div>

          {/* Polygonal pattern overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                'linear-gradient(45deg, transparent 48%, rgba(255,255,255,0.4) 49%, rgba(255,255,255,0.4) 51%, transparent 52%), linear-gradient(-45deg, transparent 48%, rgba(255,255,255,0.4) 49%, rgba(255,255,255,0.4) 51%, transparent 52%)',
              backgroundSize: '60px 60px'
            }}
          />

          {/* Main branding content */}
          <div className="relative z-10 flex flex-col justify-between h-full w-full p-12 xl:p-16 text-white">
            {/* Top: logo + name */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                <Package className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-blue-200">Inventory &amp; Sales</p>
                <p className="text-lg font-semibold">DFCL</p>
              </div>
            </div>

            {/* Middle: hero text */}
            <div className="max-w-xl">
              <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4">
                Akash Inventory System
              </h1>
              <p className="text-base xl:text-lg text-blue-100/90 leading-relaxed">
                Multi-entity inventory, sales, purchase, and incentive management — built for speed, accuracy, and scale.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 mt-6">
                {['Multi-Entity', 'Sales & POS', 'Purchase & COGS', 'Incentive Engine', 'Approval Workflow'].map(feature => (
                  <span
                    key={feature}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom: developer credit + contact */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-white shadow-lg shrink-0">
                  A
                </div>
                <div>
                  <p className="text-xs text-blue-200 uppercase tracking-wider">Developed by</p>
                  <p className="text-sm font-semibold text-white">Abdur Rahman Akash</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm">
                <a
                  href="tel:+8801534955065"
                  className="flex items-center gap-2.5 text-blue-100 hover:text-white transition-colors group"
                >
                  <span className="w-7 h-7 rounded-lg bg-white/10 group-hover:bg-white/20 flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-mono text-xs">+8801534955065</span>
                </a>
                <a
                  href="https://wa.me/8801534955065"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-blue-100 hover:text-white transition-colors group"
                >
                  <span className="w-7 h-7 rounded-lg bg-green-500/20 group-hover:bg-green-500/40 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-300">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </span>
                  <span className="font-mono text-xs text-green-200">WhatsApp</span>
                </a>
                <a
                  href="mailto:akashbaani3@gmail.com,akashbaani24@gmail.com"
                  className="flex items-center gap-2.5 text-blue-100 hover:text-white transition-colors group"
                >
                  <span className="w-7 h-7 rounded-lg bg-white/10 group-hover:bg-white/20 flex items-center justify-center shrink-0">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs">
                    akashbaani3@gmail.com, akashbaani24@gmail.com
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
    } catch (loginErr) {
      console.error('Login page render error:', loginErr)
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full border border-red-300 bg-red-50 rounded-lg p-6 text-red-900">
            <h2 className="font-bold text-lg mb-2">Render Error on Login Page</h2>
            <pre className="text-xs whitespace-pre-wrap">{String(loginErr)}</pre>
            <pre className="text-xs whitespace-pre-wrap mt-2">{(loginErr as any)?.stack}</pre>
          </div>
        </div>
      )
    }
  }

  // Main app
  // Roles: admin = full access, manager = see all entities + data + create/modify, user = assigned entities only
  const isAdmin = user.role === 'admin'
  const isManager = user.role === 'manager'
  const isManagerOrAdmin = isAdmin || isManager
  const canCreate = isManagerOrAdmin || user.canCreateItem
  const canModify = isManagerOrAdmin || user.canModifyItem

  // ★ Per-menu action permission helper (frontend gate)
  // Returns true if the current user can perform `action` on the menu/master-data identified by `key`.
  // Admin/manager always pass. Falls back to the legacy global flags if per-menu flags are missing.
  const hasPermission = (scope: 'menu' | 'master', key: string, action: 'create' | 'edit' | 'delete' | 'upload' | 'export' | 'approve'): boolean => {
    if (isManagerOrAdmin) return true
    const list = scope === 'menu' ? user.menuAccess : user.masterDataAccess
    const entry = (list as any[])?.find((m: any) => (scope === 'menu' ? m.menuKey : m.masterDataKey) === key)
    if (!entry || !entry.visible) return false
    const flag = entry[`can${action.charAt(0).toUpperCase()}${action.slice(1)}`]
    if (flag === undefined) {
      // back-compat: fall back to legacy global toggles
      if (action === 'create' || action === 'upload') return !!user.canCreateItem
      if (action === 'edit' || action === 'delete') return !!user.canModifyItem
      if (action === 'export') return true  // default allow
      if (action === 'approve') return false  // ★ v59: approve is never inherited from legacy toggles
    }
    return !!flag
  }

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
    { key: 'myEntityStock' as ViewType, label: 'My Entity Stock', icon: Warehouse },
    { key: 'allEntityStock' as ViewType, label: 'All Entity Stock', icon: BarChart3 },
    { key: 'itemAdjustment' as ViewType, label: 'Item Adjustment', icon: Settings2 },
    { key: 'transfer' as ViewType, label: 'Transfer', icon: ArrowRightLeft },
    { key: 'receive' as ViewType, label: 'Receive', icon: ArrowDownToLine },
    { key: 'purchase' as ViewType, label: 'Purchase', icon: ShoppingCart, isParent: true, children: [
      { key: 'purchase' as ViewType, label: 'Purchase List', icon: ClipboardList },
      { key: 'purchaseApproval' as ViewType, label: 'Purchase Approval', icon: CheckCircle2 },
      { key: 'supplierPayments' as ViewType, label: 'Supplier Payments', icon: DollarSign },
    ]},
    { key: 'sales' as ViewType, label: 'Sales', icon: ShoppingCart, isParent: true, children: [
      { key: 'salesOrder' as ViewType, label: 'Sales Order', icon: ClipboardList },
      { key: 'salesReturn' as ViewType, label: 'Sales Return', icon: RotateCcw },
      { key: 'tailorPayment' as ViewType, label: 'Tailor Payment', icon: Scissors },
      { key: 'delivery' as ViewType, label: 'Delivery', icon: Truck },
    ]},
    { key: 'booking' as ViewType, label: 'Booking', icon: Receipt },
    { key: 'damage' as ViewType, label: 'Damage/Wastage', icon: AlertTriangle },
    { key: 'incentive' as ViewType, label: 'Incentive', icon: DollarSign },
    { key: 'newsTicker' as ViewType, label: 'News Ticker', icon: FileText },
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
    { key: 'newItem' as ViewType, label: 'New Item', icon: Plus, perm: hasMasterDataAccess('newItem') && hasPermission('master', 'newItem', 'create') },
    { key: 'upload' as ViewType, label: 'Upload CSV', icon: Upload, perm: hasMasterDataAccess('upload') && hasPermission('master', 'upload', 'upload') },
    { key: 'entities' as ViewType, label: 'Entity', icon: Building2, perm: isAdmin && hasMasterDataAccess('entities') },
    { key: 'users' as ViewType, label: 'Users', icon: Users, perm: isAdmin && hasMasterDataAccess('users') },
    { key: 'groups' as ViewType, label: 'Groups', icon: Database, perm: hasMasterDataAccess('groups') },
    { key: 'subGroups' as ViewType, label: 'Sub Groups', icon: Database, perm: hasMasterDataAccess('subGroups') },
    { key: 'tailors' as ViewType, label: 'Tailors', icon: Scissors, perm: hasMasterDataAccess('tailors') },
    { key: 'makingInfo' as ViewType, label: 'Making Information', icon: Ruler, perm: hasMasterDataAccess('makingInfo') },
    { key: 'uom' as ViewType, label: 'UoM', icon: Package, perm: hasMasterDataAccess('uom') },
    { key: 'suppliers' as ViewType, label: 'Suppliers', icon: Truck, perm: hasMasterDataAccess('suppliers') },
    { key: 'customers' as ViewType, label: 'Customer Database', icon: UserCircle, perm: hasMasterDataAccess('customers') },
    { key: 'employees' as ViewType, label: 'Employees', icon: Users, perm: hasMasterDataAccess('employees') },
    { key: 'bookingReasons' as ViewType, label: 'Booking Reasons', icon: FileText, perm: hasMasterDataAccess('bookingReasons') },
  ]

  const visibleMasterDataItems = masterDataItems.filter(item => item.perm === undefined || item.perm)

  const isMasterDataActive = visibleMasterDataItems.some(item => item.key === currentView)
  const isStockViewActive = ['myEntityStock', 'allEntityStock'].includes(currentView)
  const isSalesActive = ['salesOrder', 'salesReturn', 'tailorPayment', 'newTailorPayment'].includes(currentView)
  const isPurchaseActive = ['purchase', 'newPurchase', 'purchaseApproval', 'purchaseDetail'].includes(currentView)

  // Helper: render Master Data section
  const renderMasterDataSection = (onNavigate?: () => void) => (
    <>
      <button onClick={() => setMasterDataOpen(!masterDataOpen)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isMasterDataActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
        <Database className="w-4 h-4 shrink-0" /><span className="flex-1 text-left">Master Data</span><ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${masterDataOpen ? 'rotate-180' : ''}`} />
      </button>
      {masterDataOpen && (
        <div className="ml-3 pl-3 border-l-2 border-muted space-y-0.5">
          {visibleMasterDataItems.map(item => (
            <button key={item.key}
              onClick={(e) => { if (isNewTabClick(e)) { e.preventDefault(); openInNewTab(item.key) } else { handleNavigate(item.key); onNavigate?.() } }}
              onContextMenu={(e) => handleContextMenu(e, item.key)}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); openInNewTab(item.key) } }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${currentView === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <item.icon className="w-3.5 h-3.5 shrink-0" />{item.label}
            </button>
          ))}
        </div>
      )}
    </>
  )

  // Open a menu in a new browser tab (Ctrl+click or middle-click)

  // Helper: render function menu section
  const renderFunctionMenu = (onNavigate?: () => void) => (
    <div className="space-y-0.5">
      {functionItems.map(item => {
        if (item.isParent && item.children) {
          let isOpen: boolean
          let isActive: boolean
          let toggleOpen: () => void
          if (item.key === 'purchase') {
            isOpen = purchaseOpen; isActive = isPurchaseActive; toggleOpen = () => setPurchaseOpen(!purchaseOpen)
          } else {
            isOpen = salesOpen; isActive = isSalesActive; toggleOpen = () => setSalesOpen(!salesOpen)
          }
          if (isActive && !isOpen) {
            setTimeout(() => {
              if (item.key === 'purchase') setPurchaseOpen(true)
              else setSalesOpen(true)
            }, 0)
          }
          return (
            <div key={item.key}>
              <button onClick={toggleOpen} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
                <item.icon className="w-4 h-4 shrink-0" /><span className="flex-1 text-left">{item.label}</span><ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="ml-3 pl-3 border-l-2 border-muted space-y-0.5">
                  {item.children.map(child => (
                    <button key={child.key}
                      onClick={(e) => { if (isNewTabClick(e)) { e.preventDefault(); openInNewTab(child.key) } else { setCurrentView(child.key); onNavigate?.() } }}
                      onContextMenu={(e) => handleContextMenu(e, child.key)}
                      onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); openInNewTab(child.key) } }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${currentView === child.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                      <child.icon className="w-3.5 h-3.5 shrink-0" />{child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        }
        return (
          <button key={item.key}
            onClick={(e) => { if (isNewTabClick(e)) { e.preventDefault(); openInNewTab(item.key) } else { setCurrentView(item.key); onNavigate?.() } }}
            onContextMenu={(e) => handleContextMenu(e, item.key)}
            onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); openInNewTab(item.key) } }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
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
  // ★ Barcode-aware: type or scan a barcode → debounced search → click to select.
  //   Also shows the selected item's barcode / itemCode / uom for visual confirmation.
  const renderItemSearchField = (selectedItemId: string, onSelectItem: (item: ItemData) => void) => {
    // Use the cached selected item if it matches, otherwise try the results list
    const selectedItem = (txSelectedItem && txSelectedItem.id === selectedItemId)
      ? txSelectedItem
      : txItemResults.find(i => i.id === selectedItemId) || null
    return (
      <div className="space-y-2">
        <Label>Scan Barcode or Search Item *</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Type barcode / item code / name..."
            value={txItemSearch}
            onChange={e => setTxItemSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                // On Enter: if results exist, pick the first one (typical for barcode scans)
                if (txItemResults.length > 0 && !selectedItemId) {
                  const picked = txItemResults[0]
                  setTxSelectedItem(picked)
                  onSelectItem(picked)
                  setTxItemSearch('')
                  setTxItemResults([])
                } else if (txItemResults.length === 0) {
                  handleTxItemSearch()
                }
              } else if (e.key === 'Escape') {
                setTxItemSearch('')
                setTxItemResults([])
              }
            }}
            autoFocus
            autoComplete="off"
          />
          <Button type="button" variant="outline" onClick={handleTxItemSearch} disabled={txItemLoading}>
            {txItemLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
          {selectedItemId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setTxSelectedItem(null); onSelectItem({ id: '' } as ItemData); setTxItemSearch(''); setTxItemResults([]) }}
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Search results */}
        {txItemResults.length > 0 && !selectedItemId && (
          <div className="border rounded-lg max-h-52 overflow-y-auto bg-background shadow-md">
            <div className="px-3 py-1 text-[11px] text-muted-foreground bg-muted/30 border-b sticky top-0">
              {txItemResults.length} item{txItemResults.length !== 1 ? 's' : ''} found — click or press Enter to select the first one
            </div>
            {txItemResults.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setTxSelectedItem(item); onSelectItem(item); setTxItemSearch(''); setTxItemResults([]) }}
                className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground text-sm border-b last:border-0 transition-colors"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.itemName}</span>
                    <span className="text-[11px] opacity-75 font-mono">{item.year || ''}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] opacity-90">
                    {item.barcode && <span className="font-mono">BC: {item.barcode}</span>}
                    {item.itemCode && <span className="font-mono">IC: {item.itemCode}</span>}
                    <span>{item.group} - {item.subGroup}</span>
                    {item.uom && <span>UoM: {item.uom}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected item card — shows full info so user can verify before continuing */}
        {selectedItemId && selectedItem && (
          <div className="rounded-md border border-green-200 bg-green-50/50 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-green-800">{selectedItem.itemName}</span>
              <span className="text-green-700 text-[11px]">✓ Selected</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-green-900">
              {selectedItem.barcode && <div><span className="text-muted-foreground">Barcode:</span> <span className="font-mono">{selectedItem.barcode}</span></div>}
              {selectedItem.itemCode && <div><span className="text-muted-foreground">Item Code:</span> <span className="font-mono">{selectedItem.itemCode}</span></div>}
              {selectedItem.group && <div><span className="text-muted-foreground">Group:</span> {selectedItem.group}</div>}
              {selectedItem.subGroup && <div><span className="text-muted-foreground">Sub Group:</span> {selectedItem.subGroup}</div>}
              {selectedItem.uom && <div><span className="text-muted-foreground">UoM:</span> {selectedItem.uom}</div>}
              {selectedItem.year && <div><span className="text-muted-foreground">Year:</span> {selectedItem.year}</div>}
            </div>
          </div>
        )}

        {/* Hint when nothing selected yet */}
        {!selectedItemId && !txItemSearch && (
          <p className="text-[11px] text-muted-foreground">💡 Type or scan a barcode — results appear automatically as you type.</p>
        )}
        {txItemSearch && txItemResults.length === 0 && !txItemLoading && (
          <p className="text-[11px] text-amber-600">No items found matching "{txItemSearch}". Try a different term.</p>
        )}
      </div>
    )
  }

  // ====== NEW FUNCTION PAGES ======

  const renderItemPricePage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Item Price - {workingEntity?.name}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Input placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-64" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <Button variant="outline" onClick={handleSearch}><Search className="w-4 h-4" /></Button>
          <Button variant="ghost" onClick={handleSearchReset}><RotateCcw className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={handleExportItems} disabled={exporting} title="Download as Excel file" style={{ display: hasPermission('master', 'items', 'export') ? '' : 'none' }}>
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Showing {((currentPage-1)*pageSize)+1}-{Math.min(currentPage*pageSize, totalItems)} of {totalItems}</p>
          <Select value={pageSize.toString()} onValueChange={v => { setPageSize(v === 'all' ? 99999 : parseInt(v)); setCurrentPage(1) }}>
            <SelectTrigger className="w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {totalPages > 1 && (
          <div className="flex gap-1">{generatePageNumbers(currentPage, totalPages).map((p, i) => typeof p === 'string' ? <span key={i} className="px-2 py-1 text-sm">...</span> : <Button key={i} variant={p === currentPage ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(p)}>{p}</Button>)}</div>
        )}
      </div>
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
    const [stockData, setStockData] = useState<{ itemId: string; itemName: string; barcode: string | null; itemCode: string | null; group: string; subGroup: string; uom: string; entityName: string; quantity: number; bookedQty: number; bookings: { bookingNo: string; tillDate: string | null; forEntityName: string }[] }[]>([])
    const [stkLoading, setStkLoading] = useState(false)
    const [stkSearch, setStkSearch] = useState('')
    const [uploadOpen, setUploadOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadResult, setUploadResult] = useState<any>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
      const fetchStock = async () => {
        setStkLoading(true)
        try {
          const params = new URLSearchParams()
          if (entityId) params.set('entityId', entityId)
          const res = await authFetch(`/api/stock/by-entity?${params}`)
          if (res.ok) {
            const data = await res.json()
            const mapped = (data.stocks || []).map((s: any) => ({
              itemId: s.itemId,
              itemName: s.item?.itemName || '',
              barcode: s.item?.barcode || null,
              itemCode: s.item?.itemCode || null,
              group: s.item?.group || '',
              subGroup: s.item?.subGroup || '',
              uom: s.item?.uom || 'PCS',
              entityName: s.entityName || '',
              quantity: s.quantity,
              bookedQty: s.bookedQty || 0,
              bookings: s.bookings || [],
            }))
            setStockData(mapped)
          }
        } catch {} finally { setStkLoading(false) }
      }
      fetchStock()
    }, [entityId])

    const filtered = stkSearch ? stockData.filter(s =>
      s.itemName.toLowerCase().includes(stkSearch.toLowerCase()) ||
      s.entityName.toLowerCase().includes(stkSearch.toLowerCase()) ||
      (s.barcode || '').toLowerCase().includes(stkSearch.toLowerCase()) ||
      (s.itemCode || '').toLowerCase().includes(stkSearch.toLowerCase())
    ) : stockData

    // Download CSV template — pre-filled with the selected entity name
    const downloadFormat = () => {
      const csv = `entityName,barcode,itemCode,quantity,uom\n${entityLabel},,ITEM-001,10,PCS\n${entityLabel},BARCODE-002,ITEM-002,5,PCS\n`
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stock-upload-format-${entityLabel.replace(/\s+/g, '-').toLowerCase()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    const handleUpload = async (e: React.FormEvent) => {
      e.preventDefault()
      const file = fileInputRef.current?.files?.[0]
      if (!file) return
      if (!entityId) {
        setUploadResult({ error: 'Please select an entity first.' })
        return
      }
      setUploading(true)
      setUploadResult(null)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await authFetch(`/api/stock/upload?entityId=${entityId}`, { method: 'POST', body: formData })
        const data = await res.json()
        if (res.ok) {
          setUploadResult(data)
          // Refresh stock list
          const params = new URLSearchParams()
          if (entityId) params.set('entityId', entityId)
          const refetch = await authFetch(`/api/stock/by-entity?${params}`)
          if (refetch.ok) {
            const r = await refetch.json()
            setStockData((r.stocks || []).map((s: any) => ({
              itemId: s.itemId, itemName: s.item?.itemName || '', barcode: s.item?.barcode || null, itemCode: s.item?.itemCode || null,
              group: s.item?.group || '', subGroup: s.item?.subGroup || '', uom: s.item?.uom || 'PCS',
              entityName: s.entityName || '', quantity: s.quantity, bookedQty: s.bookedQty || 0, bookings: s.bookings || [],
            })))
          }
          if (fileInputRef.current) fileInputRef.current.value = ''
        } else {
          setUploadResult({ error: data.error || 'Upload failed' })
        }
      } catch (err) {
        setUploadResult({ error: String(err) })
      } finally { setUploading(false) }
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <Input placeholder="Search by item name, barcode, item code..." value={stkSearch} onChange={e => setStkSearch(e.target.value)} className="w-72" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadFormat} title="Download CSV format for stock upload"><Download className="w-4 h-4 mr-1.5" />Format</Button>
            {(user.role === 'admin' || user.role === 'manager') && (
              <Button size="sm" onClick={() => setUploadOpen(true)}><Upload className="w-4 h-4 mr-1.5" />Upload Stock</Button>
            )}
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Item Name</TableHead>
              <TableHead className="font-semibold">Barcode</TableHead>
              <TableHead className="font-semibold">Item Code</TableHead>
              <TableHead className="font-semibold">Group</TableHead>
              <TableHead className="font-semibold">Sub Group</TableHead>
              {!entityId && <TableHead className="font-semibold">Entity</TableHead>}
              <TableHead className="font-semibold">UoM</TableHead>
              <TableHead className="font-semibold text-right">In Stock</TableHead>
              <TableHead className="font-semibold text-right">Booked</TableHead>
              <TableHead className="font-semibold text-right">Available</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {stkLoading ? <TableRow><TableCell colSpan={entityId ? 9 : 10} className="text-center py-8">Loading...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={entityId ? 9 : 10} className="text-center py-8 text-muted-foreground">No stock data</TableCell></TableRow>
              : filtered.map((s, i) => {
                const available = s.quantity - s.bookedQty
                return (
                <TableRow key={i} className={`hover:bg-muted/30 ${s.bookedQty > 0 ? 'bg-amber-50/40' : ''}`}>
                  <TableCell className="font-medium">{s.itemName}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{s.barcode || '—'}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{s.itemCode || '—'}</TableCell>
                  <TableCell>{s.group}</TableCell>
                  <TableCell>{s.subGroup}</TableCell>
                  {!entityId && <TableCell>{s.entityName}</TableCell>}
                  <TableCell>{s.uom}</TableCell>
                  <TableCell className="text-right font-semibold">{s.quantity}</TableCell>
                  <TableCell className="text-right">
                    {s.bookedQty > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium" title={`${s.bookings.length} active booking(s)\n${s.bookings.map((b: any) => `• ${b.bookingNo} → ${b.forEntityName}${b.tillDate ? ` (till ${bdDate(new Date(b.tillDate))})` : ''}`).join('\n')}`}>
                        <Receipt className="w-3 h-3" />{s.bookedQty}
                      </span>
                    ) : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className={`text-right font-bold ${available < 0 ? 'text-red-600' : available === 0 ? 'text-amber-600' : 'text-green-700'}`}>{available}</TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Stock — {entityLabel}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 space-y-1.5">
                <p className="font-semibold">📋 CSV Format (must include header row):</p>
                <p className="font-mono">entityName, barcode, itemCode, quantity, uom</p>
                <p className="text-[11px] mt-1">• <strong>entityName</strong> must match the selected entity "<strong>{entityLabel}</strong>" — otherwise rows are rejected.</p>
                <p className="text-[11px]">• Provide at least one of: <strong>barcode</strong>, <strong>itemCode</strong>, or <strong>itemName</strong> (you can add an itemName column too).</p>
                <p className="text-[11px]">• Item is matched by barcode first → itemCode → itemName.</p>
                <p className="text-[11px]">• Empty cells → "N/A" (quantity → 0, uom → "PCS").</p>
                <p className="text-[11px]">• Both comma and semicolon delimiters are auto-detected.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={downloadFormat}><Download className="w-4 h-4 mr-1.5" />Download Format (pre-filled with {entityLabel})</Button>
              <form onSubmit={handleUpload} className="space-y-3">
                <div>
                  <Label className="text-xs">CSV File</Label>
                  <Input type="file" accept=".csv" ref={fileInputRef} required />
                </div>
                <Button type="submit" disabled={uploading} className="w-full">
                  {uploading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Upload</>}
                </Button>
              </form>
              {uploadResult && (
                <div className={`rounded-md border p-3 text-xs ${uploadResult.error ? 'bg-red-50 border-red-200 text-red-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
                  {uploadResult.error ? (
                    <p>❌ {uploadResult.error}</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-semibold">✅ Upload complete for "{uploadResult.selectedEntity}"</p>
                      <p>Upserted: <strong>{uploadResult.upserted}</strong> / {uploadResult.total}</p>
                      <p>Skipped: {uploadResult.skipped}{uploadResult.wrongEntity ? ` (of which wrong entity: ${uploadResult.wrongEntity})` : ''}</p>
                      {uploadResult.errors && uploadResult.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-red-700 font-medium">First {uploadResult.errors.length} warning(s)</summary>
                          <ul className="list-disc list-inside mt-1 space-y-0.5">{uploadResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const renderItemAdjustmentPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Item Adjustment - {workingEntity?.name}</h2>
        <Button onClick={() => {
          setMultiAdjustmentRows([])
          setMultiAdjustmentType('increase')
          setMultiAdjustmentReason('')
          setTxItemSearch(''); setTxItemResults([]); setTxSelectedItem(null)
          setCurrentView('newAdjustment')
        }}><Plus className="w-4 h-4 mr-2" />New Adjustment</Button>
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
                <TableCell className="text-muted-foreground">{bdDate(new Date(a.createdAt))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )

  // ★ Full-page multi-item adjustment form
  const renderNewAdjustmentPage = () => {
    const addAdjustmentRow = (item: any) => {
      if (multiAdjustmentRows.find(r => r.itemId === item.id)) {
        toast({ title: 'Already added', description: `${item.itemName} is already in the adjustment list.`, variant: 'destructive' })
        return
      }
      setMultiAdjustmentRows(rows => [...rows, {
        itemId: item.id,
        itemName: item.itemName || '',
        barcode: item.barcode || '',
        itemCode: item.itemCode || '',
        uom: item.uom || 'PCS',
        quantity: '1',
        currentStock: null,
      }])
      // Fetch current stock for this item
      if (workingEntity) {
        authFetch(`/api/stock/by-entity?entityId=${workingEntity.id}`)
          .then(r => r.json())
          .then(d => {
            const row = (d.stocks || []).find((s: any) => s.itemId === item.id)
            if (row) {
              setMultiAdjustmentRows(rows => rows.map(r => r.itemId === item.id ? { ...r, currentStock: row.quantity } : r))
            }
          })
          .catch(() => {})
      }
    }

    const handleSaveMultiAdjustment = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!workingEntity) return
      if (multiAdjustmentRows.length === 0) { toast({ title: 'Error', description: 'Add at least one item', variant: 'destructive' }); return }
      if (!multiAdjustmentReason) { toast({ title: 'Error', description: 'Reason is required', variant: 'destructive' }); return }
      const ok = await confirm({
        title: `Save ${multiAdjustmentType === 'increase' ? 'Increase' : 'Decrease'} Adjustments?`,
        message: `This will ${multiAdjustmentType} stock for ${multiAdjustmentRows.length} item(s) at "${workingEntity?.name}". ${multiAdjustmentType === 'decrease' ? 'System will refuse if any item would go below 0.' : ''} Do you want to continue?`,
        confirmLabel: 'Save Adjustments',
      })
      if (!ok) return
      let success = 0
      const failures: string[] = []
      for (const row of multiAdjustmentRows) {
        try {
          const res = await authFetch('/api/item-adjustments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: row.itemId, entityId: workingEntity.id, adjustmentType: multiAdjustmentType, quantity: parseInt(row.quantity), reason: multiAdjustmentReason }),
          })
          if (res.ok) success++
          else {
            const d = await res.json().catch(() => ({}))
            failures.push(`${row.itemName}: ${d.error || 'failed'}`)
          }
        } catch { failures.push(`${row.itemName}: network error`) }
      }
      if (success > 0) toast({ title: 'Success', description: `${success} of ${multiAdjustmentRows.length} adjustment(s) saved` })
      if (failures.length > 0) toast({ title: 'Some failed', description: failures.slice(0, 3).join(' | '), variant: 'destructive' })
      if (success === multiAdjustmentRows.length) {
        setMultiAdjustmentRows([]); setMultiAdjustmentReason(''); setCurrentView('itemAdjustment'); fetchAdjustments()
      }
    }

    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setCurrentView('itemAdjustment')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h2 className="text-xl font-semibold">New Item Adjustment — {workingEntity?.name}</h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSaveMultiAdjustment} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adjustment Type *</Label>
                  <Select value={multiAdjustmentType} onValueChange={v => setMultiAdjustmentType(v as 'increase' | 'decrease')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="increase">Increase (+)</SelectItem>
                      <SelectItem value="decrease">Decrease (-)</SelectItem>
                    </SelectContent>
                  </Select>
                  {multiAdjustmentType === 'decrease' && <p className="text-[11px] text-amber-600">⚠ System will refuse if stock would go below 0.</p>}
                </div>
                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Input value={multiAdjustmentReason} onChange={e => setMultiAdjustmentReason(e.target.value)} required placeholder="e.g. Damaged in transit, Stocktake correction, ..." />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Add Items (scan barcode or search)</Label>
                {renderItemSearchField('', (item) => { addAdjustmentRow(item); setTxSelectedItem(null) })}
              </div>

              {multiAdjustmentRows.length > 0 ? (
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-primary text-primary-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide w-10">SL</th>
                        <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">Item</th>
                        <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide w-32">Barcode</th>
                        <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide w-20">Current Stock</th>
                        <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide w-24">Qty *</th>
                        <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide w-16">UoM</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {multiAdjustmentRows.map((row, i) => (
                        <tr key={row.itemId} className="border-t hover:bg-muted/20">
                          <td className="px-2 py-2 text-center text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-2 font-medium">{row.itemName}</td>
                          <td className="px-2 py-2 font-mono text-xs">{row.barcode || row.itemCode || '—'}</td>
                          <td className="px-2 py-2 text-right">{row.currentStock === null ? '…' : row.currentStock}</td>
                          <td className="px-2 py-2 text-right">
                            <Input type="number" min="1" value={row.quantity} onChange={e => setMultiAdjustmentRows(rows => rows.map(r => r.itemId === row.itemId ? { ...r, quantity: e.target.value } : r))} className="h-8 text-right text-sm w-full min-w-[70px]" />
                          </td>
                          <td className="px-2 py-2">{row.uom}</td>
                          <td className="px-2 py-2 text-center">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setMultiAdjustmentRows(rows => rows.filter(r => r.itemId !== row.itemId))} className="text-destructive h-7 w-7 p-0"><X className="w-3.5 h-3.5" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6 border rounded-md border-dashed">No items added yet. Scan a barcode or search for an item above.</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => { setMultiAdjustmentRows([]); setMultiAdjustmentReason(''); setCurrentView('itemAdjustment') }}>Cancel</Button>
                <Button type="submit" disabled={multiAdjustmentRows.length === 0}><Save className="w-4 h-4 mr-2" />Save {multiAdjustmentRows.length} Adjustment{multiAdjustmentRows.length !== 1 ? 's' : ''}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderTransferPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Transfer - {workingEntity?.name}</h2>
        <Button onClick={() => {
          setMultiTransferRows([])
          setMultiTransferToEntityId('')
          setMultiTransferNotes('')
          setTxItemSearch('')
          setTxItemResults([])
          setTxSelectedItem(null)
          setCurrentView('newTransfer')
        }}><Plus className="w-4 h-4 mr-2" />New Transfer</Button>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Transfer ID</TableHead>
            <TableHead className="font-semibold">Item</TableHead>
            <TableHead className="font-semibold">From</TableHead>
            <TableHead className="font-semibold">To</TableHead>
            <TableHead className="font-semibold text-right">Qty</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {transfers.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No transfers</TableCell></TableRow>
            : transfers.map(t => {
              // Generate a short, readable transfer ID like TR-...AB12CD
              const shortId = `TR-${t.id.slice(-6).toUpperCase()}`
              return (
              <TableRow key={t.id} className="hover:bg-muted/30">
                <TableCell>
                  <button
                    type="button"
                    onClick={() => openTransferDetail(t)}
                    className="font-mono text-xs text-primary hover:underline"
                    title="Click to view transfer details"
                  >
                    {shortId}
                  </button>
                </TableCell>
                <TableCell className="font-medium">{t.itemName}</TableCell>
                <TableCell>{t.fromEntityName}</TableCell>
                <TableCell>{t.toEntityName}</TableCell>
                <TableCell className="text-right">{t.quantity}</TableCell>
                <TableCell>{statusBadge(t.status)}</TableCell>
                <TableCell className="text-muted-foreground">{bdDate(new Date(t.createdAt))}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="View details"
                      onClick={() => openTransferDetail(t)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Print / Download Challan (PDF)"
                      onClick={() => {
                        const token = localStorage.getItem('auth_token') || ''
                        fetch(`/api/transfers/${t.id}/challan`, { headers: { 'Authorization': `Bearer ${token}` } })
                          .then(r => r.text())
                          .then(html => {
                            const w = window.open('', '_blank')
                            if (!w) { toast({ title: 'Popup blocked', description: 'Allow popups to view the challan.', variant: 'destructive' }); return }
                            w.document.write(html)
                            w.document.close()
                          })
                          .catch(() => toast({ title: 'Error', description: 'Failed to load challan', variant: 'destructive' }))
                      }}
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent><DialogHeader><DialogTitle>New Transfer</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveTransfer} className="space-y-4">
            {renderItemSearchField(transferForm.itemId, (item) => setTransferForm(f => ({ ...f, itemId: item.id || '' })))}
            <div className="space-y-2"><Label>From Entity</Label><Input value={workingEntity?.name || ''} disabled /></div>
            <div className="space-y-2"><Label>To Entity*</Label><Select value={transferForm.toEntityId} onValueChange={v => setTransferForm(f => ({ ...f, toEntityId: v }))}><SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger><SelectContent>{entities.filter(e => e.id !== workingEntity?.id).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>

            {/* Stock hint */}
            {transferForm.itemId && (
              <div className={`rounded-md border p-3 text-xs ${(() => {
                const avail = (transferCurrentStock ?? 0) - transferPendingOutgoing
                const req = parseInt(transferForm.quantity) || 0
                if (req > avail) return 'border-red-200 bg-red-50 text-red-800'
                return 'border-blue-200 bg-blue-50 text-blue-800'
              })()}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Current stock: <strong>{transferCurrentStock ?? '—'}</strong></span>
                  <span>Pending outgoing transfers: <strong>{transferPendingOutgoing}</strong></span>
                  <span>Available: <strong>{(transferCurrentStock ?? 0) - transferPendingOutgoing}</strong></span>
                </div>
                {(() => {
                  const avail = (transferCurrentStock ?? 0) - transferPendingOutgoing
                  const req = parseInt(transferForm.quantity) || 0
                  if (req > 0 && req > avail) {
                    return <div className="mt-1 font-semibold">⚠ Requested {req} exceeds available {avail}. Transfer will be blocked.</div>
                  }
                  return null
                })()}
              </div>
            )}

            <div className="space-y-2"><Label>Quantity*</Label><Input type="number" value={transferForm.quantity} onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={transferForm.notes} onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <DialogFooter><Button type="submit">Create Transfer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ★ Transfer detail dialog — opened when user clicks the Transfer ID */}
      <Dialog open={showTransferDetailDialog} onOpenChange={setShowTransferDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Details</DialogTitle>
          </DialogHeader>
          {transferDetailData && (() => {
            const t = transferDetailData
            const shortId = `TR-${t.id.slice(-6).toUpperCase()}`
            return (
              <div className="space-y-3 text-sm">
                <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Transfer ID:</span> <span className="font-mono font-semibold">{shortId}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Full ID:</span> <span className="font-mono text-xs">{t.id}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status:</span> <span>{statusBadge(t.status)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Created:</span> <span>{bdDateTime(new Date(t.createdAt))}</span></div>
                </div>
                <div className="border rounded-lg p-3 space-y-1.5">
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Item</p>
                  <div><strong>{t.itemName}</strong></div>
                  {(t as any).item?.barcode && <div className="text-xs"><span className="text-muted-foreground">Barcode:</span> <span className="font-mono">{(t as any).item.barcode}</span></div>}
                  {(t as any).item?.itemCode && <div className="text-xs"><span className="text-muted-foreground">Item Code:</span> <span className="font-mono">{(t as any).item.itemCode}</span></div>}
                  {(t as any).item?.uom && <div className="text-xs"><span className="text-muted-foreground">UoM:</span> {(t as any).item.uom}</div>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3 space-y-1">
                    <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">From</p>
                    <p className="font-medium">{t.fromEntityName}</p>
                  </div>
                  <div className="border rounded-lg p-3 space-y-1">
                    <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">To</p>
                    <p className="font-medium">{t.toEntityName}</p>
                  </div>
                </div>
                <div className="border rounded-lg p-3 grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Quantity:</span> <strong className="text-base">{t.quantity}</strong></div>
                  <div><span className="text-muted-foreground">UoM:</span> {(t as any).item?.uom || 'PCS'}</div>
                </div>
                {(t as any).notes && (
                  <div className="border rounded-lg p-3">
                    <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm">{(t as any).notes}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => {
                      const token = localStorage.getItem('auth_token') || ''
                      fetch(`/api/transfers/${t.id}/challan`, { headers: { 'Authorization': `Bearer ${token}` } })
                        .then(r => r.text())
                        .then(html => {
                          const w = window.open('', '_blank')
                          if (!w) { toast({ title: 'Popup blocked', description: 'Allow popups to view the challan.', variant: 'destructive' }); return }
                          w.document.write(html)
                          w.document.close()
                        })
                    }}
                  >
                    <Printer className="w-4 h-4 mr-2" />Print Challan
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowTransferDetailDialog(false)}>Close</Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )

  // ★ New Transfer page (full page, multi-item)
  // User scans/ypes barcode for each item → adds a row → enters qty → submit creates N transfers.
  const renderNewTransferPage = () => {
    const totalQty = multiTransferRows.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0)
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setCurrentView('transfer')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <h2 className="text-xl font-semibold">New Transfer — from {workingEntity?.name}</h2>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSaveMultiTransfer} className="space-y-5">
              {/* From / To entity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">From Entity</Label>
                  <Input value={workingEntity?.name || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">To Entity *</Label>
                  <Select value={multiTransferToEntityId} onValueChange={v => setMultiTransferToEntityId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select destination entity" /></SelectTrigger>
                    <SelectContent>
                      {entities.filter(e => e.id !== workingEntity?.id).map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Item picker — barcode scan → add row */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-sm font-semibold">Add Items (scan barcode or search)</Label>
                  <span className="text-xs text-muted-foreground">
                    {multiTransferRows.length} item{multiTransferRows.length !== 1 ? 's' : ''} added
                    {totalQty > 0 && ` • ${totalQty} unit${totalQty !== 1 ? 's' : ''} total`}
                  </span>
                </div>
                {renderItemSearchField('', (item) => { addMultiTransferRow(item); setTxSelectedItem(null) })}
              </div>

              {/* Items table */}
              {multiTransferRows.length > 0 ? (
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-primary text-primary-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide w-10">SL</th>
                        <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">Item</th>
                        <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide w-32">Barcode</th>
                        <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide w-28">Item Code</th>
                        <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide w-20">Current Stock</th>
                        <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide w-20">Pending Out</th>
                        <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide w-20">Available</th>
                        <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide w-24">Qty *</th>
                        <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide w-16">UoM</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {multiTransferRows.map((row, i) => {
                        const available = (row.currentStock ?? 0) - row.pendingOutgoing
                        const requested = parseInt(row.quantity) || 0
                        const isOver = row.currentStock !== null && requested > available
                        return (
                          <tr key={row.itemId} className={`border-t hover:bg-muted/20 ${isOver ? 'bg-red-50' : ''}`}>
                            <td className="px-2 py-2 text-center text-muted-foreground">{i + 1}</td>
                            <td className="px-2 py-2 font-medium">{row.itemName}</td>
                            <td className="px-2 py-2 font-mono text-xs">{row.barcode || '—'}</td>
                            <td className="px-2 py-2 font-mono text-xs">{row.itemCode || '—'}</td>
                            <td className="px-2 py-2 text-right">{row.currentStock === null ? '…' : row.currentStock}</td>
                            <td className="px-2 py-2 text-right text-amber-600">{row.pendingOutgoing}</td>
                            <td className={`px-2 py-2 text-right font-bold ${available < 0 ? 'text-red-600' : 'text-blue-700'}`}>{row.currentStock === null ? '…' : available}</td>
                            <td className="px-2 py-2 text-right">
                              <Input
                                type="number"
                                min="1"
                                value={row.quantity}
                                onChange={e => updateMultiTransferRow(row.itemId, 'quantity', e.target.value)}
                                className={`h-8 text-right text-sm w-full min-w-[70px] ${isOver ? 'border-red-500' : ''}`}
                              />
                            </td>
                            <td className="px-2 py-2">{row.uom}</td>
                            <td className="px-2 py-2 text-center">
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeMultiTransferRow(row.itemId)} className="text-destructive h-7 w-7 p-0">
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="border-t bg-muted/30">
                        <td colSpan={7} className="px-2 py-2 text-right text-sm font-semibold">TOTAL UNITS:</td>
                        <td className="px-2 py-2 text-right font-bold text-primary text-base">{totalQty}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6 border rounded-md border-dashed">
                  No items added yet. Scan a barcode or search for an item above to add it.
                </p>
              )}

              {/* Stock validation summary */}
              {multiTransferRows.length > 0 && (
                <div className="rounded-md border p-3 text-xs">
                  <p className="font-semibold mb-1">Stock validation</p>
                  <ul className="space-y-0.5">
                    {multiTransferRows.map(r => {
                      const available = (r.currentStock ?? 0) - r.pendingOutgoing
                      const requested = parseInt(r.quantity) || 0
                      const status = r.currentStock === null
                        ? { text: 'Loading stock...', color: 'text-muted-foreground' }
                        : requested > available
                          ? { text: `⚠ Over: ${requested} > ${available} available`, color: 'text-red-600' }
                          : { text: `OK — ${requested} of ${available} available`, color: 'text-green-700' }
                      return (
                        <li key={r.itemId} className={status.color}>
                          {r.itemName}: {status.text}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (applies to all transfers in this batch)</Label>
                <Input value={multiTransferNotes} onChange={e => setMultiTransferNotes(e.target.value)} placeholder="Optional notes about this transfer batch..." />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => { setMultiTransferRows([]); setMultiTransferToEntityId(''); setMultiTransferNotes(''); setCurrentView('transfer') }}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={multiTransferRows.length === 0 || !multiTransferToEntityId}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Create {multiTransferRows.length} Transfer{multiTransferRows.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderReceivePage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Receive - {workingEntity?.name}</h2>
        <Button onClick={() => { setReceiveForm({ itemId: '', quantity: '', sourceEntityId: '', referenceNo: '', notes: '' }); setTxItemSearch(''); setTxItemResults([]); setTxSelectedItem(null); setCurrentView('newReceive') }}><Plus className="w-4 h-4 mr-2" />New Receive</Button>
      </div>

      {/* ★ Incoming Transfers panel — pending transfers destined TO this entity.
          User can one-click Receive them, which auto-creates a Receive and completes the transfer. */}
      {incomingTransfers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <ArrowDownToLine className="w-4 h-4" />
              Incoming Transfers ({incomingTransfers.length})
            </CardTitle>
            <p className="text-xs text-amber-800">
              These items are being transferred TO you from other entities. Click "Receive" to accept them — the source entity's stock will be decremented and yours incremented.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="border rounded-lg overflow-x-auto bg-white">
              <Table>
                <TableHeader><TableRow className="bg-amber-100/60">
                  <TableHead className="font-semibold text-xs">Transfer ID</TableHead>
                  <TableHead className="font-semibold text-xs">Item</TableHead>
                  <TableHead className="font-semibold text-xs">From</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Qty</TableHead>
                  <TableHead className="font-semibold text-xs">Date</TableHead>
                  <TableHead className="font-semibold text-xs text-center">Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {incomingTransfers.map(t => (
                    <TableRow key={t.id} className="hover:bg-amber-50">
                      <TableCell className="font-mono text-xs">TR-{t.id.slice(-6).toUpperCase()}</TableCell>
                      <TableCell className="font-medium">
                        {t.itemName}
                        {t.item?.barcode && <span className="ml-2 text-[10px] font-mono text-muted-foreground">BC: {t.item.barcode}</span>}
                      </TableCell>
                      <TableCell>{t.fromEntityName}</TableCell>
                      <TableCell className="text-right font-bold">{t.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{bdDate(new Date(t.createdAt))}</TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" onClick={() => handleQuickReceive(t)}>
                          <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />Receive
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Item</TableHead>
            <TableHead className="font-semibold text-right">Qty</TableHead>
            <TableHead className="font-semibold">Source</TableHead>
            <TableHead className="font-semibold">Ref No</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {receives.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No receives</TableCell></TableRow>
            : receives.map(r => {
              const isFromPurchase = !!(r as any).referenceNo && (r as any).referenceNo.startsWith('PUR-')
              return (
              <TableRow key={r.id} className={`hover:bg-muted/30 ${isFromPurchase ? 'bg-blue-50/30' : ''}`}>
                <TableCell className="font-medium">
                  {r.itemName}
                  {isFromPurchase && <Badge variant="outline" className="ml-2 text-[10px] bg-blue-100 text-blue-700">Purchase</Badge>}
                </TableCell>
                <TableCell className="text-right">{r.quantity}</TableCell>
                <TableCell>{r.sourceEntityName || (isFromPurchase ? 'Supplier' : '-')}</TableCell>
                <TableCell className="font-mono text-xs">{r.referenceNo || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{bdDate(new Date(r.createdAt))}</TableCell>
                <TableCell className="text-center">
                  {isFromPurchase && (
                    <Button variant="ghost" size="sm" title="Print Barcodes" onClick={() => printPurchaseBarcodes(r.id, r.referenceNo, [{ item: { itemName: r.itemName, barcode: (r as any).item?.barcode, itemCode: (r as any).item?.itemCode, uom: (r as any).item?.uom }, quantity: r.quantity, uom: 'PCS' }])}>
                      <Printer className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent><DialogHeader><DialogTitle>New Receive</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveReceive} className="space-y-4">
            {renderItemSearchField(receiveForm.itemId, (item) => setReceiveForm(f => ({ ...f, itemId: item.id || '' })))}
            <div className="space-y-2"><Label>Entity</Label><Input value={workingEntity?.name || ''} disabled /></div>
            <div className="space-y-2"><Label>Quantity*</Label><Input type="number" value={receiveForm.quantity} onChange={e => setReceiveForm(f => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
            <div className="space-y-2"><Label>Source Entity</Label><Select value={receiveForm.sourceEntityId || '__none__'} onValueChange={v => setReceiveForm(f => ({ ...f, sourceEntityId: v === '__none__' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent><SelectItem value="__none__">None</SelectItem>{entities.filter(e => e.id !== workingEntity?.id).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
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
        <div className="flex gap-2">
          <Button onClick={() => { resetSalesOrderForm(); fetchCustomers(); fetchEmployees(); setCurrentView('newSalesOrder') }} className="gap-2"><Plus className="w-4 h-4" />New Sales</Button>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Sales No</TableHead>
            <TableHead className="font-semibold">Customer</TableHead>
            <TableHead className="font-semibold">Items</TableHead>
            <TableHead className="font-semibold text-right">Total</TableHead>
            <TableHead className="font-semibold text-right">Paid</TableHead>
            <TableHead className="font-semibold">Order Date</TableHead>
            <TableHead className="font-semibold">Delivery</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {salesOrders.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No sales orders</TableCell></TableRow>
            : salesOrders.map((s: any) => {
              const total = (s.items||[]).reduce((sum:number,si:any)=>sum+si.quantity*si.unitPrice+(si.makingEntries||[]).reduce((m:number,me:any)=>m+me.quantity*me.unitPrice,0),0)
              const paid = (s.payments||[]).reduce((sum:number,p:any)=>sum+p.amount,0)
              return (
              <TableRow key={s.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedSalesOrder(s); setShowSalesDetailDialog(true) }}>
                <TableCell className="font-medium">{s.salesNo || s.id?.slice(0,8)}</TableCell>
                <TableCell>{s.customer?.name || '—'}</TableCell>
                <TableCell className="text-xs">{(s.items||[]).map((si:any,i:number)=>(<div key={i}>{si.item?.itemName||'—'} ×{si.quantity}</div>))}</TableCell>
                <TableCell className="text-right font-semibold">{total.toFixed(2)}</TableCell>
                <TableCell className="text-right">{paid.toFixed(2)}</TableCell>
                <TableCell className="text-xs">{bdDate(new Date(s.orderDate||s.createdAt))}</TableCell>
                <TableCell className="text-xs">{s.deliveryDate?bdDate(new Date(s.deliveryDate)):'—'}</TableCell>
                <TableCell>{statusBadge(s.status)}</TableCell>
                <TableCell className="text-center" onClick={(e)=>e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => printSalesInvoice(s)} title="Print Invoice"><FileText className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditingSalesOrderId(s.id); setShowAddPaymentDialog(true) }} title="Add Payment"><DollarSign className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* New Sales Order Dialog */}
      <Dialog open={showSalesOrderDialog} onOpenChange={setShowSalesOrderDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Sales Order</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveSalesOrder} className="space-y-4">
            {/* Customer: Existing vs New */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Customer</Label>
              <div className="flex gap-2 mb-2">
                <Button type="button" size="sm" variant={salesCustomerMode === 'existing' ? 'default' : 'outline'} onClick={() => setSalesCustomerMode('existing')}>Existing</Button>
                <Button type="button" size="sm" variant={salesCustomerMode === 'new' ? 'default' : 'outline'} onClick={() => setSalesCustomerMode('new')}>New Customer</Button>
              </div>
              {salesCustomerMode === 'existing' ? (
                <div className="space-y-2">
                  <Input placeholder="Search by name or phone..." value={salesCustomerSearch} onChange={e => setSalesCustomerSearch(e.target.value)} className="text-sm" />
                  <Select value={salesOrderForm.customerId} onValueChange={v => setSalesOrderForm({...salesOrderForm, customerId: v})}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>{customers.filter(c => { if (!salesCustomerSearch) return true; const s = salesCustomerSearch.toLowerCase(); return c.name.toLowerCase().includes(s) || (c.phone||'').includes(salesCustomerSearch) }).map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 border rounded-lg p-3 bg-muted/30">
                  <div className="space-y-1"><Label className="text-xs">Name *</Label><Input placeholder="Customer name" value={salesOrderForm.newCustomerName} onChange={e => setSalesOrderForm({...salesOrderForm, newCustomerName: e.target.value})} required /></div>
                  <div className="space-y-1"><Label className="text-xs">Phone</Label><Input placeholder="Phone" value={salesOrderForm.newCustomerPhone} onChange={e => setSalesOrderForm({...salesOrderForm, newCustomerPhone: e.target.value})} /></div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input placeholder="Email" value={salesOrderForm.newCustomerEmail} onChange={e => setSalesOrderForm({...salesOrderForm, newCustomerEmail: e.target.value})} /></div>
                  <div className="space-y-1"><Label className="text-xs">Address</Label><Input placeholder="Address" value={salesOrderForm.newCustomerAddress} onChange={e => setSalesOrderForm({...salesOrderForm, newCustomerAddress: e.target.value})} /></div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Order Date</Label><Input type="date" value={salesOrderForm.orderDate} onChange={e => setSalesOrderForm({...salesOrderForm, orderDate: e.target.value})} /></div>
              <div className="space-y-2"><Label>Delivery Date</Label><Input type="date" value={salesOrderForm.deliveryDate} onChange={e => setSalesOrderForm({...salesOrderForm, deliveryDate: e.target.value})} /></div>
              <div className="space-y-2"><Label>Status</Label><Select value={salesOrderForm.status} onValueChange={v => setSalesOrderForm({...salesOrderForm, status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="processing">Processing</SelectItem><SelectItem value="delivered">Delivered</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div>
            </div>

            <Separator />
            {/* Items section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Items</Label>
                <span className="text-xs text-muted-foreground">Sales ID auto-generated on save</span>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Search item to add..." value={salesItemSearch} onChange={e => setSalesItemSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSalesItemSearch())} className="flex-1" />
                <Button type="button" variant="outline" onClick={handleSalesItemSearch}><Search className="w-4 h-4" /></Button>
              </div>
              {salesItemResults.length > 0 && (
                <div className="border rounded-lg max-h-40 overflow-y-auto bg-background shadow-lg" style={{ zIndex: 1000, position: 'relative' }}>
                  {salesItemResults.map((item, idx) => (
                    <div key={item.id || idx} onClick={() => addSalesItem(item)} className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground text-sm border-b last:border-0 cursor-pointer transition-colors">
                      {item.itemName || 'Unknown'} {item.year ? `(${item.year})` : ''}
                    </div>
                  ))}
                </div>
              )}
              {salesOrderForm.items.length > 0 && (
                <div className="space-y-2">
                  {salesOrderForm.items.map((item, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.itemName}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSalesItem(i)} className="text-destructive"><X className="w-3 h-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input type="number" value={item.quantity} onChange={e => updateSalesItem(i, 'quantity', e.target.value)} className="h-8 text-sm" /></div>
                        <div className="space-y-1"><Label className="text-xs">Unit Price</Label><Input type="number" step="0.01" value={item.unitPrice} onChange={e => updateSalesItem(i, 'unitPrice', e.target.value)} className="h-8 text-sm" /></div>
                      </div>
                      {/* Making entries */}
                      {item.makingEntries.length > 0 && (
                        <div className="space-y-1 pl-3 border-l-2 border-muted">
                          {item.makingEntries.map((me, mi) => (
                            <div key={mi} className="flex gap-2 items-center">
                              <Input placeholder="Making name" value={me.name} onChange={e => updateMakingEntry(i, mi, 'name', e.target.value)} className="h-7 text-xs flex-1" />
                              <Input type="number" placeholder="Qty" value={me.quantity} onChange={e => updateMakingEntry(i, mi, 'quantity', e.target.value)} className="h-7 text-xs w-16" />
                              <Input type="number" step="0.01" placeholder="Price" value={me.unitPrice} onChange={e => updateMakingEntry(i, mi, 'unitPrice', e.target.value)} className="h-7 text-xs w-20" />
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeMakingEntry(i, mi)} className="text-destructive h-7"><X className="w-3 h-3" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => addMakingEntry(i)} className="text-xs h-7">+ Add Making</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />
            {/* Payments section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Payments (Optional — can add later)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPayment}><Plus className="w-3 h-3 mr-1" />Add Payment</Button>
              </div>
              {salesOrderForm.payments.map((p, i) => (
                <div key={i} className="border rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Amount</Label><Input type="number" step="0.01" value={p.amount} onChange={e => updatePayment(i, 'amount', e.target.value)} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Type</Label><Select value={p.paymentType} onValueChange={v => updatePayment(i, 'paymentType', v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="mobile_banking">Mobile Banking</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.paymentMode} onValueChange={v => updatePayment(i, 'paymentMode', v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="advance">Advance</SelectItem><SelectItem value="collection">Collection</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={p.paymentDate} onChange={e => updatePayment(i, 'paymentDate', e.target.value)} className="h-8 text-sm" /></div>
                  {p.paymentType === 'cheque' && (<><div className="space-y-1"><Label className="text-xs">Cheque No</Label><Input value={p.chequeNo} onChange={e => updatePayment(i, 'chequeNo', e.target.value)} className="h-8 text-sm" /></div><div className="space-y-1"><Label className="text-xs">Bank</Label><Input value={p.bankName} onChange={e => updatePayment(i, 'bankName', e.target.value)} className="h-8 text-sm" /></div></>)}
                  <div className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removePayment(i)} className="text-destructive"><X className="w-3 h-3" /></Button></div>
                </div>
              ))}
            </div>

            <div className="space-y-2"><Label>Notes</Label><Input value={salesOrderForm.notes} onChange={e => setSalesOrderForm({...salesOrderForm, notes: e.target.value})} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowSalesOrderDialog(false); resetSalesOrderForm() }}><X className="w-4 h-4 mr-2" />Cancel</Button>
              <Button type="submit"><Save className="w-4 h-4 mr-2" />Create Sales Order</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sales Detail Dialog */}
      <Dialog open={showSalesDetailDialog} onOpenChange={setShowSalesDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
          {selectedSalesOrder && (() => {
            const so = selectedSalesOrder
            const eName = so.entity?.name || workingEntity?.name || ''
            const eDesc = so.entity?.description || ''
            const initials = eName.split(/\s+/).slice(0, 2).map((w: string) => w[0] || '').join('').toUpperCase() || 'DF'
            const subTotal = (so.items || []).reduce((sum: number, si: any) => sum + (si.quantity || 0) * (si.unitPrice || 0), 0)
            const makingTotal = (so.items || []).reduce((sum: number, si: any) => sum + (si.makingEntries || []).reduce((m: number, me: any) => m + (me.quantity || 0) * (me.unitPrice || 0), 0), 0)
            const grandTotal = subTotal + makingTotal
            const totalPaid = (so.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0)
            const due = grandTotal - totalPaid
            const orderDateStr = so.orderDate ? bdDate(new Date(so.orderDate)) : bdDate(new Date(so.createdAt))
            const deliveryDateStr = so.deliveryDate ? bdDate(new Date(so.deliveryDate)) : '—'
            return (
              <>
              {/* Header bar — Bright Solutions style */}
              <div className="flex justify-between items-start gap-6 p-5 border-b-[3px] border-primary">
                <div className="flex gap-3 items-start">
                  <div className="w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold tracking-wide shrink-0" style={{ clipPath: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' }}>{initials}</div>
                  <div>
                    <h1 className="text-lg font-bold text-primary leading-tight">{eName}</h1>
                    <div className="text-[10px] uppercase tracking-[2px] text-muted-foreground mb-1">Inventory &amp; Sales</div>
                    <div className="text-xs text-muted-foreground">{eDesc || ''}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-primary tracking-[2px]">SALES ORDER</div>
                  <div className="text-[13px] font-bold text-red-600 font-mono mt-1">{so.salesNo || ''}</div>
                  <div className="text-[11px] mt-1"><span className="font-semibold">Order Date:</span> {orderDateStr}</div>
                  <div className="text-[11px]"><span className="font-semibold">Delivery Date:</span> {deliveryDateStr}</div>
                  {so.notes && <div className="text-[11px]"><span className="font-semibold">Sales Note:</span> {so.notes}</div>}
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Status badge */}
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  {statusBadge(so.status)}
                </div>

                {/* Customer Information */}
                <div>
                  <div className="text-[10.5px] font-bold text-primary tracking-[1.5px] uppercase bg-primary/5 px-3 py-1.5 border-l-[3px] border-primary mb-2">Customer Information</div>
                  <div className="px-3 py-2 text-sm">
                    <div className="text-base font-bold text-primary mb-1">{so.customer?.name || '—'}</div>
                    {so.customer?.phone && <div><strong className="text-xs">Phone:</strong> {so.customer.phone}</div>}
                    {so.customer?.address && <div><strong className="text-xs">Address:</strong> {so.customer.address}</div>}
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <div className="text-[10.5px] font-bold text-primary tracking-[1.5px] uppercase bg-primary/5 px-3 py-1.5 border-l-[3px] border-primary mb-2">Items</div>
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-primary text-primary-foreground">
                        <tr>
                          <th className="px-2 py-2 text-center w-10 text-[11px] uppercase tracking-wide">SL</th>
                          <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">Item Description</th>
                          <th className="px-2 py-2 text-right w-28 text-[11px] uppercase tracking-wide">Unit Price</th>
                          <th className="px-2 py-2 text-right w-28 text-[11px] uppercase tracking-wide">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(so.items || []).map((si: any, i: number) => {
                          const itemBaseTotal = (si.quantity || 0) * (si.unitPrice || 0)
                          const itemTotal = itemBaseTotal + (si.makingEntries || []).reduce((m: number, me: any) => m + (me.quantity || 0) * (me.unitPrice || 0), 0)
                          return (
                            <React.Fragment key={i}>
                              <tr className="border-t">
                                <td className="px-2 py-2 text-center text-muted-foreground">{i + 1}</td>
                                <td className="px-2 py-2"><strong>{si.item?.itemName || '—'}</strong><br /><span className="text-[10.5px] text-muted-foreground">Quantity: {si.quantity} × Unit Price: {(si.unitPrice || 0).toFixed(2)}</span></td>
                                <td className="px-2 py-2 text-right">{(si.unitPrice || 0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-bold">{itemTotal.toFixed(2)}</td>
                              </tr>
                              {(si.makingEntries || []).map((me: any, mi: number) => {
                                const meTotal = (me.quantity || 0) * (me.unitPrice || 0)
                                return (
                                  <tr key={`m-${i}-${mi}`} className="border-t bg-muted/20">
                                    <td className="px-2 py-1.5 text-center text-muted-foreground">↳</td>
                                    <td className="px-2 py-1.5 text-muted-foreground"><em className="text-[11px]">Making:</em> {me.name || '—'} <span className="text-[10.5px] text-muted-foreground">({me.quantity} × {(me.unitPrice || 0).toFixed(2)})</span></td>
                                    <td className="px-2 py-1.5 text-right text-muted-foreground">{(me.unitPrice || 0).toFixed(2)}</td>
                                    <td className="px-2 py-1.5 text-right font-medium text-muted-foreground">{meTotal.toFixed(2)}</td>
                                  </tr>
                                )
                              })}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary */}
                <div className="flex justify-end">
                  <div className="w-[280px] border border-primary rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr><td className="px-3 py-1.5 text-muted-foreground">Sub Total</td><td className="px-3 py-1.5 text-right font-mono">{subTotal.toFixed(2)}</td></tr>
                        <tr className="border-t"><td className="px-3 py-1.5 text-muted-foreground">Making Charges</td><td className="px-3 py-1.5 text-right font-mono">{makingTotal.toFixed(2)}</td></tr>
                        <tr className="border-t"><td className="px-3 py-1.5 text-muted-foreground">Total Amount</td><td className="px-3 py-1.5 text-right font-mono">{grandTotal.toFixed(2)}</td></tr>
                        <tr className="bg-primary text-primary-foreground"><td className="px-3 py-2 font-bold">GRAND TOTAL</td><td className="px-3 py-2 text-right font-mono font-bold">{grandTotal.toFixed(2)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payments */}
                {so.payments && so.payments.length > 0 && (
                  <div>
                    <div className="text-[10.5px] font-bold text-primary tracking-[1.5px] uppercase bg-primary/5 px-3 py-1.5 border-l-[3px] border-primary mb-2">Payment Information</div>
                    <div className="border rounded-md overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-600 text-white">
                          <tr>
                            <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">Receipt No</th>
                            <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">Payment Date</th>
                            <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">Method</th>
                            <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide">Amount</th>
                            <th className="px-2 py-2 w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {so.payments.map((p: any, i: number) => {
                            let methodStr = p.paymentType || ''
                            if (p.paymentType === 'cheque') methodStr = `Cheque${p.chequeNo ? ` (#${p.chequeNo})` : ''}`
                            else if (p.paymentType === 'cash') methodStr = 'Cash'
                            else if (p.paymentType === 'card') methodStr = 'Card'
                            else if (p.paymentType === 'mobile_banking') methodStr = 'Mobile Banking'
                            return (
                              <tr key={i} className="border-t">
                                <td className="px-2 py-2 font-mono text-xs">{p.receiptNo}</td>
                                <td className="px-2 py-2 text-xs">{bdDate(new Date(p.paymentDate))}</td>
                                <td className="px-2 py-2 text-xs">{methodStr} <span className="text-[10px] text-muted-foreground">({p.paymentMode})</span></td>
                                <td className="px-2 py-2 text-right font-semibold">{(p.amount || 0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-center"><Button variant="ghost" size="sm" onClick={() => printMoneyReceipt(so, p)} title="Print Receipt"><FileText className="w-3 h-3" /></Button></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end mt-2">
                      <div className="w-[280px] border border-red-300 rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <tbody>
                            <tr><td className="px-3 py-1.5 text-muted-foreground">Total Paid</td><td className="px-3 py-1.5 text-right font-mono">{totalPaid.toFixed(2)}</td></tr>
                            <tr className="bg-red-50 text-red-700 border-t-2 border-red-300"><td className="px-3 py-2 font-bold">DUE AMOUNT</td><td className="px-3 py-2 text-right font-mono font-bold">{due.toFixed(2)}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action buttons — locked if order is delivered (non-admin) */}
                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  <Button variant="default" size="sm" onClick={() => printSalesInvoice(so)}><FileText className="w-4 h-4 mr-2" />Print Invoice</Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingSalesOrderId(so.id); setShowAddPaymentDialog(true) }}><DollarSign className="w-4 h-4 mr-2" />Add Payment</Button>
                  {so.deliveryStatus === 'delivered' && so.status === 'delivered' ? (
                    <Badge variant="outline" className="bg-green-100 text-green-800 self-center px-3 py-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Completed — Locked
                    </Badge>
                  ) : so.status !== 'cancelled' && (
                    <Button variant="outline" size="sm" className="text-green-700 hover:text-green-800" onClick={async () => {
                      try {
                        const res = await authFetch(`/api/sales-orders/${so.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'delivered' }) })
                        if (res.ok) { toast({ title: 'Success', description: 'Order marked as Complete' }); setShowSalesDetailDialog(false); fetchSalesOrders() }
                        else { const d = await res.json(); toast({ title: 'Cannot Complete', description: d.error, variant: 'destructive' }) }
                      } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
                    }}><CheckCircle2 className="w-4 h-4 mr-2" />Mark Complete</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowSalesDetailDialog(false)}><X className="w-4 h-4 mr-2" />Close</Button>
                </div>
              </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={showAddPaymentDialog} onOpenChange={setShowAddPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Amount *</Label><Input type="number" step="0.01" value={addPaymentForm.amount} onChange={e => setAddPaymentForm({...addPaymentForm, amount: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Payment Type</Label><Select value={addPaymentForm.paymentType} onValueChange={v => setAddPaymentForm({...addPaymentForm, paymentType: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="mobile_banking">Mobile Banking</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Payment Mode</Label><Select value={addPaymentForm.paymentMode} onValueChange={v => setAddPaymentForm({...addPaymentForm, paymentMode: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="advance">Advance</SelectItem><SelectItem value="collection">Collection</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Payment Date</Label><Input type="date" value={addPaymentForm.paymentDate} onChange={e => setAddPaymentForm({...addPaymentForm, paymentDate: e.target.value})} /></div>
            {addPaymentForm.paymentType === 'cheque' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Cheque No</Label><Input value={addPaymentForm.chequeNo} onChange={e => setAddPaymentForm({...addPaymentForm, chequeNo: e.target.value})} /></div>
                <div className="space-y-2"><Label>Bank Name</Label><Input value={addPaymentForm.bankName} onChange={e => setAddPaymentForm({...addPaymentForm, bankName: e.target.value})} /></div>
              </div>
            )}
            <div className="space-y-2"><Label>Notes</Label><Input value={addPaymentForm.notes} onChange={e => setAddPaymentForm({...addPaymentForm, notes: e.target.value})} /></div>
            <DialogFooter><Button onClick={handleAddPayment}><Save className="w-4 h-4 mr-2" />Add Payment</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  // New Sales Order — full page (not dialog)
  const renderNewSalesOrderPage = () => {
    // Live calculations
    const subTotal = salesOrderForm.items.reduce((s, item) => s + (parseInt(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0)
    const makingTotal = salesOrderForm.items.reduce((s, item) => s + item.makingEntries.reduce((m, me) => m + (parseInt(me.quantity) || 0) * (parseFloat(me.unitPrice) || 0), 0), 0)
    const grandTotal = subTotal + makingTotal
    const discount = parseFloat(salesOrderForm.discount) || 0
    const netTotal = grandTotal - discount
    const totalPaid = salesOrderForm.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    const due = netTotal - totalPaid
    const entityName = workingEntity?.name || ''
    const initials = entityName.split(/\s+/).slice(0, 2).map((w: string) => w[0] || '').join('').toUpperCase() || 'DF'

    return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">New Sales Order</h2>
        <Button variant="outline" onClick={() => { resetSalesOrderForm(); setCurrentView('salesOrder') }}><X className="w-4 h-4 mr-2" />Back to List</Button>
      </div>

      <form onSubmit={handleSaveSalesOrder} className="space-y-5">
        {/* Header bar — Bright Solutions style */}
        <div className="flex justify-between items-start gap-6 pb-4 border-b-[3px] border-primary bg-card rounded-t-lg p-5">
          <div className="flex gap-3 items-start">
            <div className="w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold tracking-wide shrink-0" style={{ clipPath: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' }}>{initials}</div>
            <div>
              <h1 className="text-lg font-bold text-primary leading-tight">{entityName}</h1>
              <div className="text-[10px] uppercase tracking-[2px] text-muted-foreground mb-1">Inventory &amp; Sales</div>
              <div className="text-xs text-muted-foreground">{workingEntity?.description || ''}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold text-primary tracking-[2px]">NEW SALES</div>
            <div className="text-xs text-muted-foreground mt-1">Sales ID auto-generated on save</div>
            <div className="text-[11px] mt-1"><span className="font-semibold">Order Date:</span> {bdDate(new Date(salesOrderForm.orderDate))}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column: customer + items + payments */}
          <div className="lg:col-span-2 space-y-5">
            {/* Customer Section */}
            <div className="bg-card rounded-lg border">
              <div className="text-[10.5px] font-bold text-primary tracking-[1.5px] uppercase bg-primary/5 px-3 py-2 border-l-[3px] border-primary rounded-t-lg">Customer Information</div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={salesCustomerMode === 'existing' ? 'default' : 'outline'} onClick={() => setSalesCustomerMode('existing')}>Existing</Button>
                  <Button type="button" size="sm" variant={salesCustomerMode === 'new' ? 'default' : 'outline'} onClick={() => setSalesCustomerMode('new')}>New Customer</Button>
                </div>
                {salesCustomerMode === 'existing' ? (
                  <div className="space-y-2">
                    <Input placeholder="Search by name or phone..." value={salesCustomerSearch} onChange={e => setSalesCustomerSearch(e.target.value)} className="text-sm" />
                    <Select value={salesOrderForm.customerId} onValueChange={v => setSalesOrderForm({...salesOrderForm, customerId: v})}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>{customers.filter(c => { if (!salesCustomerSearch) return true; const s = salesCustomerSearch.toLowerCase(); return c.name.toLowerCase().includes(s) || (c.phone||'').includes(salesCustomerSearch) }).map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-muted/30 border">
                    <div className="space-y-1"><Label className="text-xs">Name *</Label><Input placeholder="Customer name" value={salesOrderForm.newCustomerName} onChange={e => setSalesOrderForm({...salesOrderForm, newCustomerName: e.target.value})} required /></div>
                    <div className="space-y-1"><Label className="text-xs">Phone</Label><Input placeholder="Phone" value={salesOrderForm.newCustomerPhone} onChange={e => setSalesOrderForm({...salesOrderForm, newCustomerPhone: e.target.value})} /></div>
                    <div className="space-y-1"><Label className="text-xs">Email</Label><Input placeholder="Email" value={salesOrderForm.newCustomerEmail} onChange={e => setSalesOrderForm({...salesOrderForm, newCustomerEmail: e.target.value})} /></div>
                    <div className="space-y-1"><Label className="text-xs">Address</Label><Input placeholder="Address" value={salesOrderForm.newCustomerAddress} onChange={e => setSalesOrderForm({...salesOrderForm, newCustomerAddress: e.target.value})} /></div>
                  </div>
                )}
              </div>
            </div>

            {/* Order Meta */}
            <div className="bg-card rounded-lg border p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1"><Label className="text-xs">Order Date</Label><Input type="date" value={salesOrderForm.orderDate} onChange={e => setSalesOrderForm({...salesOrderForm, orderDate: e.target.value})} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Delivery Date</Label><Input type="date" value={salesOrderForm.deliveryDate} onChange={e => setSalesOrderForm({...salesOrderForm, deliveryDate: e.target.value})} className="h-9" /></div>
              <div className="space-y-1">
                <Label className="text-xs">Sales Person</Label>
                <Combobox
                  options={employees
                    .filter(e => e.status === 'active' && (e.roles || '').split(',').map(r => r.trim()).includes('sales'))
                    .map(e => ({ value: e.id, label: e.name, subLabel: e.designation || e.roles || '' }))}
                  value={salesOrderForm.salesPersonId || ''}
                  onChange={(v) => setSalesOrderForm({ ...salesOrderForm, salesPersonId: v })}
                  placeholder="Type to search sales person..."
                  clearable
                  className="h-9"
                />
              </div>
              <div className="space-y-1"><Label className="text-xs">Status</Label><Select value={salesOrderForm.status} onValueChange={v => setSalesOrderForm({...salesOrderForm, status: v})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="processing">Processing</SelectItem><SelectItem value="delivered">Delivered</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div>
            </div>

            {/* Items — Table Style with inline qty + unit price */}
            <div className="bg-card rounded-lg border">
              <div className="flex items-center justify-between text-[10.5px] font-bold text-primary tracking-[1.5px] uppercase bg-primary/5 px-3 py-2 border-l-[3px] border-primary rounded-t-lg">
                <span>Items</span>
                <span className="text-muted-foreground normal-case tracking-normal text-[11px]">Add items via search below</span>
              </div>
              <div className="p-3 space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Search item to add..." value={salesItemSearch} onChange={e => setSalesItemSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSalesItemSearch())} className="flex-1" />
                  <Button type="button" variant="outline" onClick={handleSalesItemSearch}><Search className="w-4 h-4" /></Button>
                </div>
                {salesItemResults.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto bg-background shadow-lg relative z-[1000]">
                    {salesItemResults.map((item, idx) => (
                      <div key={item.id || idx} onClick={() => addSalesItem(item)} className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground text-sm border-b last:border-0 cursor-pointer transition-colors">
                        {item.itemName || 'Unknown'} {item.year ? `(${item.year})` : ''}
                      </div>
                    ))}
                  </div>
                )}

                {/* Items table */}
                {salesOrderForm.items.length > 0 ? (
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-primary text-primary-foreground">
                        <tr>
                          <th className="px-2 py-2 text-center w-10 text-[11px] uppercase tracking-wide">SL</th>
                          <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">Item Description</th>
                          <th className="px-2 py-2 text-right w-24 text-[11px] uppercase tracking-wide">Qty</th>
                          <th className="px-2 py-2 text-right w-28 text-[11px] uppercase tracking-wide">Unit Price</th>
                          <th className="px-2 py-2 text-right w-28 text-[11px] uppercase tracking-wide">Total</th>
                          <th className="px-2 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesOrderForm.items.map((item, i) => {
                          const itemBaseTotal = (parseInt(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
                          const itemMakingTotal = item.makingEntries.reduce((s, me) => s + (parseInt(me.quantity) || 0) * (parseFloat(me.unitPrice) || 0), 0)
                          const itemTotal = itemBaseTotal + itemMakingTotal
                          return (
                            <React.Fragment key={i}>
                            <tr className="border-t hover:bg-muted/20">
                              <td className="px-2 py-2 text-center text-muted-foreground">{i + 1}</td>
                              <td className="px-2 py-2 font-medium">{item.itemName}</td>
                              <td className="px-2 py-2 text-right"><Input type="number" min="1" value={item.quantity} onChange={e => updateSalesItem(i, 'quantity', e.target.value)} className="h-8 text-right text-sm w-full min-w-[70px]" /></td>
                              <td className="px-2 py-2 text-right"><Input type="number" step="0.01" value={item.unitPrice} onChange={e => updateSalesItem(i, 'unitPrice', e.target.value)} className="h-8 text-right text-sm w-full min-w-[90px]" /></td>
                              <td className="px-2 py-2 text-right font-bold">{itemBaseTotal.toFixed(2)}</td>
                              <td className="px-2 py-2 text-center"><Button type="button" variant="ghost" size="sm" onClick={() => removeSalesItem(i)} className="text-destructive h-7 w-7 p-0"><X className="w-3.5 h-3.5" /></Button></td>
                            </tr>
                            {/* Making entries — same column style */}
                            {item.makingEntries.map((me, mi) => {
                              const meTotal = (parseInt(me.quantity) || 0) * (parseFloat(me.unitPrice) || 0)
                              return (
                                <tr key={`m-${i}-${mi}`} className="border-t bg-muted/20">
                                  <td className="px-2 py-1.5 text-center text-muted-foreground">↳</td>
                                  <td className="px-2 py-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] italic text-muted-foreground">Making:</span>
                                      <Input placeholder="e.g. Stitching" value={me.name} onChange={e => updateMakingEntry(i, mi, 'name', e.target.value)} className="h-7 text-xs flex-1 min-w-[120px]" />
                                    </div>
                                  </td>
                                  <td className="px-2 py-1.5 text-right"><Input type="number" min="1" value={me.quantity} onChange={e => updateMakingEntry(i, mi, 'quantity', e.target.value)} className="h-7 text-right text-xs w-full min-w-[70px]" /></td>
                                  <td className="px-2 py-1.5 text-right"><Input type="number" step="0.01" value={me.unitPrice} onChange={e => updateMakingEntry(i, mi, 'unitPrice', e.target.value)} className="h-7 text-right text-xs w-full min-w-[90px]" /></td>
                                  <td className="px-2 py-1.5 text-right font-medium text-muted-foreground">{meTotal.toFixed(2)}</td>
                                  <td className="px-2 py-1.5 text-center"><Button type="button" variant="ghost" size="sm" onClick={() => removeMakingEntry(i, mi)} className="text-destructive h-6 w-6 p-0"><X className="w-3 h-3" /></Button></td>
                                </tr>
                              )
                            })}
                            <tr className="border-t bg-muted/10">
                              <td colSpan={6} className="px-2 py-1.5">
                                <Button type="button" variant="ghost" size="sm" onClick={() => addMakingEntry(i)} className="text-xs h-7 text-primary hover:text-primary">+ Add Making Charge</Button>
                              </td>
                            </tr>
                            <tr className="border-t bg-muted/5">
                              <td colSpan={4} className="px-2 py-1.5 text-right text-[11px] text-muted-foreground font-medium">Item Total (incl. making):</td>
                              <td className="px-2 py-1.5 text-right font-bold text-primary">{itemTotal.toFixed(2)}</td>
                              <td></td>
                            </tr>
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-6 border rounded-md border-dashed">No items added yet. Search and add items above.</p>}
              </div>
            </div>

            {/* Payments */}
            <div className="bg-card rounded-lg border">
              <div className="flex items-center justify-between text-[10.5px] font-bold text-primary tracking-[1.5px] uppercase bg-primary/5 px-3 py-2 border-l-[3px] border-primary rounded-t-lg">
                <span>Payments (Optional)</span>
                <Button type="button" variant="outline" size="sm" onClick={addPayment} className="h-7 normal-case tracking-normal text-xs"><Plus className="w-3 h-3 mr-1" />Add Payment</Button>
              </div>
              <div className="p-3 space-y-3">
                {salesOrderForm.payments.map((p, i) => (
                  <div key={i} className="border rounded-md p-3 grid grid-cols-2 md:grid-cols-4 gap-2 bg-muted/10">
                    <div className="space-y-1"><Label className="text-xs">Amount</Label><Input type="number" step="0.01" value={p.amount} onChange={e => updatePayment(i, 'amount', e.target.value)} className="h-8 text-sm" /></div>
                    <div className="space-y-1"><Label className="text-xs">Type</Label><Select value={p.paymentType} onValueChange={v => updatePayment(i, 'paymentType', v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="mobile_banking">Mobile Banking</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-xs">Mode</Label><Select value={p.paymentMode} onValueChange={v => updatePayment(i, 'paymentMode', v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="advance">Advance</SelectItem><SelectItem value="collection">Collection</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={p.paymentDate} onChange={e => updatePayment(i, 'paymentDate', e.target.value)} className="h-8 text-sm" /></div>
                    {p.paymentType === 'cheque' && (<><div className="space-y-1"><Label className="text-xs">Cheque No</Label><Input value={p.chequeNo} onChange={e => updatePayment(i, 'chequeNo', e.target.value)} className="h-8 text-sm" /></div><div className="space-y-1"><Label className="text-xs">Bank</Label><Input value={p.bankName} onChange={e => updatePayment(i, 'bankName', e.target.value)} className="h-8 text-sm" /></div></>)}
                    <div className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removePayment(i)} className="text-destructive"><X className="w-3 h-3" /></Button></div>
                  </div>
                ))}
                {salesOrderForm.payments.length === 0 && <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-md">No payments added. Receipt number auto-generated on save.</p>}
              </div>
            </div>

            <div className="space-y-2 bg-card rounded-lg border p-4">
              <Label className="text-xs">Sales Note</Label>
              <Input value={salesOrderForm.notes} onChange={e => setSalesOrderForm({...salesOrderForm, notes: e.target.value})} placeholder="Any special instruction or note for this sale..." />
            </div>
          </div>

          {/* Right column: Sticky Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-4">
              <div className="bg-card rounded-lg border border-primary overflow-hidden">
                <div className="text-[10.5px] font-bold text-primary tracking-[1.5px] uppercase bg-primary/5 px-3 py-2 border-l-[3px] border-primary">Order Summary</div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Sub Total</span><span className="font-mono">{subTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Making Charges</span><span className="font-mono">{makingTotal.toFixed(2)}</span></div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-base"><span className="font-semibold">Total Amount</span><span className="font-mono">{grandTotal.toFixed(2)}</span></div>
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs text-muted-foreground">Discount</Label>
                    <Input type="number" step="0.01" placeholder="0.00" value={salesOrderForm.discount} onChange={e => setSalesOrderForm({ ...salesOrderForm, discount: e.target.value })} className="h-8 text-right text-sm" />
                  </div>
                  <div className="flex justify-between bg-primary text-primary-foreground px-3 py-2 rounded-md text-base font-bold mt-2"><span>GRAND TOTAL</span><span className="font-mono">{netTotal.toFixed(2)}</span></div>
                  {totalPaid > 0 && (
                    <>
                      <div className="flex justify-between text-muted-foreground mt-2"><span>Total Paid</span><span className="font-mono">{totalPaid.toFixed(2)}</span></div>
                      <div className={`flex justify-between px-3 py-2 rounded-md text-base font-bold ${due > 0 ? 'bg-red-50 text-red-700 border border-red-300' : 'bg-green-50 text-green-700 border border-green-300'}`}>
                        <span>{due > 0 ? 'DUE' : 'CHANGE'}</span>
                        <span className="font-mono">{Math.abs(due).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-card rounded-lg border p-3 text-[11px] text-muted-foreground space-y-1">
                <div className="flex justify-between"><span>Items:</span><span className="font-medium text-foreground">{salesOrderForm.items.length}</span></div>
                <div className="flex justify-between"><span>Making entries:</span><span className="font-medium text-foreground">{salesOrderForm.items.reduce((s, i) => s + i.makingEntries.length, 0)}</span></div>
                <div className="flex justify-between"><span>Payments:</span><span className="font-medium text-foreground">{salesOrderForm.payments.length}</span></div>
              </div>

              <div className="space-y-2">
                <Button type="submit" size="lg" className="w-full"><Save className="w-4 h-4 mr-2" />Create Sales Order</Button>
                <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => { resetSalesOrderForm(); setCurrentView('salesOrder') }}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
    )
  }

  // ─── Purchase module ────────────────────────────────────────────────────
  // (fetchPurchases is defined above near other fetch handlers)

  const resetPurchaseForm = () => {
    setPurchaseForm({
      purchaseDate: new Date().toISOString().split('T')[0],
      purchaseType: 'local',
      entityId: workingEntity?.id || '',
      supplierId: '',
      billNo: '',
      lcNo: '',
      piNo: '',
      bankName: '',
      shippingTo: '',
      notes: '',
      items: [],
    })
    setPurchaseItemSearch('')
    setPurchaseItemResults([])
  }

  // Item search for purchase form (uses master item list)
  const handlePurchaseItemSearch = async () => {
    if (!purchaseItemSearch.trim()) return
    try {
      const res = await authFetch(`/api/items?search=${encodeURIComponent(purchaseItemSearch)}&pageSize=20`)
      if (res.ok) {
        const data = await res.json()
        setPurchaseItemResults(data.items || [])
      }
    } catch {}
  }

  const addPurchaseItem = (item: any) => {
    setPurchaseForm(f => ({
      ...f,
      items: [...f.items, {
        itemId: item.id || '',
        itemName: item.itemName || '',
        quantity: '1',
        unitPrice: (item.price || 0).toString(),
        uom: item.uom || 'PCS',
      }],
    }))
    setPurchaseItemSearch('')
    setPurchaseItemResults([])
  }

  const updatePurchaseItem = (index: number, field: 'quantity' | 'unitPrice' | 'uom', value: string) => {
    setPurchaseForm(f => {
      const items = [...f.items]
      items[index] = { ...items[index], [field]: value }
      return { ...f, items }
    })
  }

  const removePurchaseItem = (index: number) => {
    setPurchaseForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }))
  }

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!purchaseForm.entityId) {
      toast({ title: 'Error', description: 'Please select "Purchase For" entity', variant: 'destructive' })
      return
    }
    if (purchaseForm.items.length === 0) {
      toast({ title: 'Error', description: 'Add at least one item', variant: 'destructive' })
      return
    }
    const grandTotal = purchaseForm.items.reduce((s, it) => s + (parseInt(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0)
    const ok = await confirm({
      title: 'Create Purchase?',
      message: `This will create a purchase with ${purchaseForm.items.length} item line(s) and a grand total of ${grandTotal.toFixed(2)}. The purchase will be created as "pending" and will need approval before stock is added. Regular users will not be able to modify this purchase afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: 'Create Purchase',
    })
    if (!ok) return
    try {
      const payload = {
        purchaseDate: purchaseForm.purchaseDate,
        purchaseType: purchaseForm.purchaseType,
        entityId: purchaseForm.entityId,
        supplierId: purchaseForm.supplierId || undefined,
        billNo: purchaseForm.billNo || undefined,
        lcNo: purchaseForm.lcNo || undefined,
        piNo: purchaseForm.piNo || undefined,
        bankName: purchaseForm.bankName || undefined,
        shippingTo: purchaseForm.shippingTo || undefined,
        notes: purchaseForm.notes || undefined,
        items: purchaseForm.items.map(i => ({
          itemId: i.itemId,
          quantity: parseInt(i.quantity) || 1,
          unitPrice: parseFloat(i.unitPrice) || 0,
          uom: i.uom || 'PCS',
        })),
      }
      const res = await authFetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Success', description: `Purchase created: ${data.purchase?.purchaseNo || ''}` })
        resetPurchaseForm()
        setCurrentView('purchase')
        fetchPurchases()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create purchase', variant: 'destructive' })
    }
  }

  const handleApprovePurchase = async (id: string) => {
    const ok = await confirm({
      title: 'Approve Purchase?',
      message: 'This will approve the purchase. After approval, the items will appear in the Receive page where they must be manually received (which will update stock and create barcodes). Do you want to continue?',
      confirmLabel: 'Approve Purchase',
      confirmVariant: 'default',
    })
    if (!ok) return
    try {
      const res = await authFetch(`/api/purchases/${id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Approved', description: data.message || 'Purchase approved. Items are ready to be received.' })
        fetchPurchases()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to approve', variant: 'destructive' })
    }
  }

  const handleDeletePurchase = async (id: string) => {
    if (!confirm('Delete this purchase? Only pending purchases can be deleted.')) return
    try {
      const res = await authFetch(`/api/purchases/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Purchase deleted' })
        fetchPurchases()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' })
    }
  }

  // ★ Open COGS page for a purchase — fetches current COGS values
  const openCogsPage = async (purchase: any) => {
    try {
      const res = await authFetch(`/api/purchases/${purchase.id}/cogs`)
      if (res.ok) {
        const data = await res.json()
        setCogsPagePurchase(purchase)
        setCogsItems((data.items || []).map((it: any) => ({
          id: it.id, itemId: it.itemId, itemName: it.itemName, quantity: it.quantity,
          unitPrice: it.unitPrice, cogsPerUnit: String(it.cogsPerUnit || 0),
          cogsNotes: it.cogsNotes || '', landedCostPerUnit: it.landedCostPerUnit || 0,
        })))
        setCurrentView('cogsPage')
      } else {
        toast({ title: 'Error', description: 'Failed to load COGS', variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Failed to load COGS', variant: 'destructive' }) }
  }

  // ★ Save COGS for a purchase
  const handleSaveCogs = async () => {
    if (!cogsPagePurchase) return
    setCogsSaving(true)
    try {
      const payload = {
        items: cogsItems.map(it => ({
          id: it.id,
          cogsPerUnit: parseFloat(it.cogsPerUnit) || 0,
          cogsNotes: it.cogsNotes || null,
        })),
      }
      const res = await authFetch(`/api/purchases/${cogsPagePurchase.id}/cogs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Success', description: data.message || 'COGS updated' })
        setCogsPagePurchase(null)
        setCurrentView('purchase')
        fetchPurchases()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
    finally { setCogsSaving(false) }
  }

  // Print barcodes for all items in a purchase (called from Receive page when receive is linked to a purchase)
  const printPurchaseBarcodes = (purchaseId: string, purchaseNo: string, items: any[]) => {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
    const labels = items.map((pi: any) => {
      const code = pi.item?.barcode || pi.item?.itemCode || pi.itemId
      const name = pi.item?.itemName || '—'
      const uom = pi.uom || pi.item?.uom || 'PCS'
      const qty = pi.quantity
      // Build N labels (one per unit) — capped at 20 for safety
      const labelCount = Math.min(qty, 20)
      const labels = Array.from({ length: labelCount }).map((_, idx) => `
        <div class="label">
          <div class="title">${escapeHtml(name)}</div>
          <svg class="barcode" jsbarcode-format="CODE128" jsbarcode-value="${escapeHtml(code || 'X')}" jsbarcode-width="2" jsbarcode-height="40" jsbarcode-displayvalue="true"></svg>
          <div class="meta">
            <span>UoM: ${escapeHtml(uom)}</span>
            <span>#${idx + 1}/${qty}</span>
            <span>${escapeHtml(purchaseNo)}</span>
          </div>
        </div>
      `).join('')
      return labels
    }).join('')

    win.document.write(`<!doctype html><html><head><title>Barcodes - ${escapeHtml(purchaseNo)}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Arial,sans-serif;padding:15px;background:#fff}
        h1{font-size:18px;margin:0 0 10px;color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:5px}
        .info{font-size:11px;color:#666;margin-bottom:15px}
        .labels{display:flex;flex-wrap:wrap;gap:6px}
        .label{width:180px;height:100px;border:1px solid #999;padding:5px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;background:#fff;page-break-inside:avoid}
        .label .title{font-size:11px;font-weight:700;text-align:center;color:#1e293b;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .label .barcode{display:block}
        .label .meta{font-size:8px;color:#666;display:flex;justify-content:space-between;width:100%;padding:0 3px}
        @media print{body{padding:8mm}.label{border:1px dashed #999}}
      </style>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      </head><body>
        <h1>BARCODES — ${escapeHtml(purchaseNo)}</h1>
        <div class="info">Purchase ID: ${escapeHtml(purchaseId)} | ${items.length} item(s) | Generated: ${bdNow()}</div>
        <div class="labels">${labels}</div>
        <script>
          window.onload = function() {
            if (typeof JsBarcode !== 'undefined') {
              try { JsBarcode(".barcode").init(); } catch(e) { console.error(e); }
            }
            setTimeout(function() { window.print(); }, 400);
          };
        </script>
      </body></html>`)
    win.document.close()
  }

  function escapeHtml(s: any): string {
    if (s === null || s === undefined) return ''
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
  }

  // Purchase List page — summary table + New Purchase button
  const renderPurchaseListPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Purchase List - {workingEntity?.name}</h2>
        <Button onClick={() => { resetPurchaseForm(); setCurrentView('newPurchase') }} className="gap-2" style={{ display: hasPermission('menu', 'purchase', 'create') ? '' : 'none' }}>
          <Plus className="w-4 h-4" />New Purchase
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Purchase No</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Supplier</TableHead>
            <TableHead className="font-semibold">Bill No</TableHead>
            <TableHead className="font-semibold text-center">Items</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {purchases.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No purchases yet. Click "New Purchase" to create one.</TableCell></TableRow>
            : purchases.map(p => (
              <TableRow key={p.id} className="hover:bg-muted/30">
                <TableCell className="font-mono text-xs font-semibold">{p.purchaseNo}</TableCell>
                <TableCell className="text-xs">{new Date(p.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                <TableCell><Badge variant="outline" className={p.purchaseType === 'foreign' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}>{p.purchaseType}</Badge></TableCell>
                <TableCell>{p.supplier?.name || '—'}</TableCell>
                <TableCell className="text-xs font-mono">{p.billNo || '—'}</TableCell>
                <TableCell className="text-center">{p.itemCount || 0}</TableCell>
                <TableCell className="text-right font-semibold">{(p.grandTotal || 0).toFixed(2)}</TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedPurchase(p); setShowPurchaseDetailDialog(true) }} title="View Details"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => openCogsPage(p)} title="Edit COGS"><DollarSign className="w-4 h-4" /></Button>
                    {p.status === 'pending' && hasPermission('menu', 'purchase', 'delete') && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeletePurchase(p.id)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Purchase Detail Dialog */}
      <Dialog open={showPurchaseDetailDialog} onOpenChange={setShowPurchaseDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedPurchase && (
            <>
              <DialogHeader><DialogTitle>Purchase: {selectedPurchase.purchaseNo}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Date:</strong> {bdDate(new Date(selectedPurchase.purchaseDate))}</div>
                  <div><strong>Type:</strong> {selectedPurchase.purchaseType}</div>
                  <div><strong>Supplier:</strong> {selectedPurchase.supplier?.name || '—'}</div>
                  <div><strong>Bill No:</strong> {selectedPurchase.billNo || '—'}</div>
                  <div><strong>Entity:</strong> {selectedPurchase.entity?.name}</div>
                  <div><strong>Status:</strong> {statusBadge(selectedPurchase.status)}</div>
                </div>
                {selectedPurchase.notes && <div className="text-sm"><strong>Notes:</strong> {selectedPurchase.notes}</div>}
                <Separator />
                <div>
                  <h4 className="font-semibold text-sm mb-2">Items</h4>
                  <Table>
                    <TableHeader><TableRow><TableHead className="text-xs">Item</TableHead><TableHead className="text-xs text-right">Qty</TableHead><TableHead className="text-xs">UoM</TableHead><TableHead className="text-xs text-right">Unit Price</TableHead><TableHead className="text-xs text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(selectedPurchase.items || []).map((pi: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">
                            {pi.item?.itemName || '—'}
                            {pi.item?.barcode && <div className="text-[10px] text-muted-foreground font-mono">BC: {pi.item.barcode}</div>}
                          </TableCell>
                          <TableCell className="text-xs text-right">{pi.quantity}</TableCell>
                          <TableCell className="text-xs">{pi.uom}</TableCell>
                          <TableCell className="text-xs text-right">{pi.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{pi.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <div className="text-right border rounded-lg p-3 bg-muted/30 min-w-[200px]">
                    <p className="text-sm">Grand Total: <span className="font-bold text-lg">{(selectedPurchase.grandTotal || 0).toFixed(2)}</span></p>
                  </div>
                </div>
                {selectedPurchase.status === 'approved' && (
                  <Button variant="outline" size="sm" onClick={() => printPurchaseBarcodes(selectedPurchase.id, selectedPurchase.purchaseNo, selectedPurchase.items || [])}>
                    <Printer className="w-4 h-4 mr-2" />Print Barcodes for All Items
                  </Button>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowPurchaseDetailDialog(false)}><X className="w-4 h-4 mr-2" />Close</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* COGS is now a full page — see renderCogsPage() */}
    </div>
  )

  // ★ COGS — full page (not dialog)
  const renderCogsPage = () => (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><DollarSign className="w-5 h-5" />Edit COGS — {cogsPagePurchase?.purchaseNo}</h2>
        <Button variant="outline" onClick={() => { setCogsPagePurchase(null); setCurrentView('purchase') }}><X className="w-4 h-4 mr-2" />Back to Purchase List</Button>
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900">
        <p className="font-semibold mb-1">💰 COGS = Cost of Goods Sold</p>
        <p>Additional per-unit costs beyond the purchase unit price (transport, customs, duties, etc.). Landed Cost = Unit Price + COGS per unit.</p>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary text-primary-foreground">
            <tr>
              <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">Item</th>
              <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide">Qty</th>
              <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide">Unit Price</th>
              <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide">COGS / Unit</th>
              <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">COGS Notes</th>
              <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide">Landed / Unit</th>
              <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide">Total Landed</th>
            </tr>
          </thead>
          <tbody>
            {cogsItems.map((it, idx) => {
              const cogsPerUnit = parseFloat(it.cogsPerUnit) || 0
              const landed = it.unitPrice + cogsPerUnit
              const totalLanded = landed * it.quantity
              return (
                <tr key={it.id} className="border-t hover:bg-muted/20">
                  <td className="px-2 py-2 font-medium text-xs">{it.itemName}</td>
                  <td className="px-2 py-2 text-right text-xs">{it.quantity}</td>
                  <td className="px-2 py-2 text-right text-xs">{it.unitPrice.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right">
                    <Input type="number" step="0.01" value={it.cogsPerUnit} onChange={e => {
                      const val = e.target.value
                      setCogsItems(arr => arr.map((x, i) => i === idx ? { ...x, cogsPerUnit: val } : x))
                    }} className="h-8 text-right text-sm w-24" />
                  </td>
                  <td className="px-2 py-2">
                    <Input placeholder="e.g. Transport from Ctg" value={it.cogsNotes} onChange={e => {
                      const val = e.target.value
                      setCogsItems(arr => arr.map((x, i) => i === idx ? { ...x, cogsNotes: val } : x))
                    }} className="h-8 text-xs w-full min-w-[140px]" />
                  </td>
                  <td className="px-2 py-2 text-right text-xs font-semibold text-blue-700">{landed.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right text-xs font-bold">{totalLanded.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t-2">
              <td colSpan={3} className="px-2 py-2 text-right text-xs font-semibold">Totals:</td>
              <td className="px-2 py-2 text-right text-xs font-semibold">{cogsItems.reduce((s, it) => s + (parseFloat(it.cogsPerUnit) || 0) * it.quantity, 0).toFixed(2)}</td>
              <td></td>
              <td className="px-2 py-2 text-right text-xs font-semibold text-blue-700">{cogsItems.reduce((s, it) => s + (it.unitPrice + (parseFloat(it.cogsPerUnit) || 0)) * it.quantity, 0).toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSaveCogs} disabled={cogsSaving} size="lg"><Save className="w-4 h-4 mr-2" />{cogsSaving ? 'Saving...' : 'Save COGS'}</Button>
        <Button variant="outline" size="lg" onClick={() => { setCogsPagePurchase(null); setCurrentView('purchase') }}>Cancel</Button>
      </div>
    </div>
  )

  // New Purchase entry page
  const renderNewPurchasePage = () => {
    try {
    const grandTotal = purchaseForm.items.reduce((s, it) => s + (parseInt(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0)
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">New Purchase</h2>
          <Button variant="outline" onClick={() => { resetPurchaseForm(); setCurrentView('purchase') }}><X className="w-4 h-4 mr-2" />Back to List</Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSavePurchase} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Date *</Label>
                  <Input type="date" value={purchaseForm.purchaseDate} onChange={e => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Purchase Type *</Label>
                  <Select value={purchaseForm.purchaseType} onValueChange={v => setPurchaseForm({ ...purchaseForm, purchaseType: v as 'foreign' | 'local' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="foreign">Foreign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Purchase For (Entity) *</Label>
                  <Combobox
                    options={entities.map(e => ({ value: e.id, label: e.name, subLabel: e.entityType }))}
                    value={purchaseForm.entityId}
                    onChange={(v) => setPurchaseForm({ ...purchaseForm, entityId: v })}
                    placeholder="Type to search entity..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Combobox
                    options={(suppliers || []).filter(s => s.status === 'active').map(s => ({ value: s.id, label: s.name, subLabel: s.phone }))}
                    value={purchaseForm.supplierId || ''}
                    onChange={(v) => setPurchaseForm({ ...purchaseForm, supplierId: v })}
                    placeholder="Type to search supplier (optional)..."
                    clearable
                  />
                  <p className="text-[11px] text-muted-foreground">Add new suppliers via Master Data → Suppliers</p>
                </div>
                <div className="space-y-2">
                  <Label>Bill Number</Label>
                  <Input placeholder="Supplier's bill/challan number" value={purchaseForm.billNo} onChange={e => setPurchaseForm({ ...purchaseForm, billNo: e.target.value })} />
                </div>
              </div>

              {/* Shipping To (both local & foreign) */}
              <div className="space-y-2">
                <Label>Shipping To</Label>
                <Input placeholder="Shipping destination (e.g. warehouse address, entity name)" value={purchaseForm.shippingTo} onChange={e => setPurchaseForm({ ...purchaseForm, shippingTo: e.target.value })} />
              </div>

              {/* Foreign-only fields — shown when purchaseType is 'foreign' */}
              {purchaseForm.purchaseType === 'foreign' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border border-blue-200 bg-blue-50/40">
                  <div className="space-y-2">
                    <Label className="text-blue-900">LC Number</Label>
                    <Input placeholder="Letter of Credit number" value={purchaseForm.lcNo} onChange={e => setPurchaseForm({ ...purchaseForm, lcNo: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-900">P.I. Number</Label>
                    <Input placeholder="Proforma Invoice number" value={purchaseForm.piNo} onChange={e => setPurchaseForm({ ...purchaseForm, piNo: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-900">Bank Name</Label>
                    <Input placeholder="Bank name for LC" value={purchaseForm.bankName} onChange={e => setPurchaseForm({ ...purchaseForm, bankName: e.target.value })} />
                  </div>
                </div>
              )}

              <Separator />

              {/* Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Items</Label>
                  <span className="text-xs text-muted-foreground">Purchase ID auto-generated on save</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type item name to search & add..."
                    value={purchaseItemSearch}
                    onChange={e => setPurchaseItemSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        // Add first result on Enter
                        if (purchaseItemResults.length > 0) {
                          addPurchaseItem(purchaseItemResults[0])
                        }
                      } else if (e.key === 'Escape') {
                        setPurchaseItemSearch('')
                        setPurchaseItemResults([])
                      }
                    }}
                    className="flex-1"
                    autoComplete="off"
                  />
                  {purchaseItemSearch && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setPurchaseItemSearch(''); setPurchaseItemResults([]) }} title="Clear search">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {purchaseItemResults.length > 0 && (
                  <div className="border rounded-md max-h-56 overflow-y-auto bg-background shadow-lg relative z-[1000]">
                    <div className="px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/30 border-b sticky top-0">
                      {purchaseItemResults.length} item{purchaseItemResults.length !== 1 ? 's' : ''} found — click or press Enter to add
                    </div>
                    {purchaseItemResults.map((item, idx) => (
                      <div key={item.id || idx} onClick={() => addPurchaseItem(item)} className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground text-sm border-b last:border-0 cursor-pointer transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span>{item.itemName || 'Unknown'}</span>
                          <span className="text-xs opacity-75">{item.itemCode || item.year || ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {purchaseForm.items.length > 0 ? (
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-primary text-primary-foreground">
                        <tr>
                          <th className="px-2 py-2 text-center w-10 text-[11px] uppercase tracking-wide">SL</th>
                          <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">Item</th>
                          <th className="px-2 py-2 text-right w-24 text-[11px] uppercase tracking-wide">Qty</th>
                          <th className="px-2 py-2 text-right w-28 text-[11px] uppercase tracking-wide">Unit Price</th>
                          <th className="px-2 py-2 text-left w-20 text-[11px] uppercase tracking-wide">UoM</th>
                          <th className="px-2 py-2 text-right w-28 text-[11px] uppercase tracking-wide">Total</th>
                          <th className="px-2 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseForm.items.map((item, i) => {
                          const total = (parseInt(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
                          return (
                            <tr key={i} className="border-t hover:bg-muted/20">
                              <td className="px-2 py-2 text-center text-muted-foreground">{i + 1}</td>
                              <td className="px-2 py-2 font-medium">{item.itemName}</td>
                              <td className="px-2 py-2 text-right"><Input type="number" min="1" value={item.quantity} onChange={e => updatePurchaseItem(i, 'quantity', e.target.value)} className="h-8 text-right text-sm w-full min-w-[70px]" /></td>
                              <td className="px-2 py-2 text-right"><Input type="number" step="0.01" value={item.unitPrice} onChange={e => updatePurchaseItem(i, 'unitPrice', e.target.value)} className="h-8 text-right text-sm w-full min-w-[90px]" /></td>
                              <td className="px-2 py-2"><Input value={item.uom} onChange={e => updatePurchaseItem(i, 'uom', e.target.value)} className="h-8 text-sm w-full min-w-[60px]" /></td>
                              <td className="px-2 py-2 text-right font-bold">{total.toFixed(2)}</td>
                              <td className="px-2 py-2 text-center"><Button type="button" variant="ghost" size="sm" onClick={() => removePurchaseItem(i)} className="text-destructive h-7 w-7 p-0"><X className="w-3.5 h-3.5" /></Button></td>
                            </tr>
                          )
                        })}
                        <tr className="border-t bg-muted/30">
                          <td colSpan={5} className="px-2 py-2 text-right text-sm font-semibold">GRAND TOTAL:</td>
                          <td className="px-2 py-2 text-right font-bold text-primary text-base">{grandTotal.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-6 border rounded-md border-dashed">No items added yet. Search and add items above.</p>}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={purchaseForm.notes} onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} placeholder="Optional notes about this purchase..." />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" size="lg"><Save className="w-4 h-4 mr-2" />Create Purchase</Button>
                <Button type="button" variant="outline" size="lg" onClick={() => { resetPurchaseForm(); setCurrentView('purchase') }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
    } catch (err) {
      console.error('renderNewPurchasePage error:', err)
      return (
        <div className="p-4 border border-red-300 bg-red-50 rounded-md text-red-900 text-sm">
          <p className="font-semibold">Error rendering New Purchase page:</p>
          <pre className="text-xs mt-2 whitespace-pre-wrap">{String(err)}</pre>
          <pre className="text-xs mt-2 whitespace-pre-wrap">{(err as any)?.stack}</pre>
        </div>
      )
    }
  }

  // Purchase Approval page — list of pending purchases with approve/cancel buttons
  const renderPurchaseApprovalPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Purchase Approval - {workingEntity?.name}</h2>
        {!hasPermission('menu', 'purchaseApproval', 'approve') && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700">⚠ You don't have approval rights</Badge>
        )}
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900">
        <p className="font-semibold mb-1">📋 Purchase Workflow</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Purchase submitted → status = <strong>pending</strong> (stock NOT touched)</li>
          <li>Only users with <strong>Approve</strong> rights can approve → status = <strong>approved</strong></li>
          <li>After approval → items appear in the <strong>Receive</strong> page</li>
          <li>User receives items → stock increases + barcode auto-created</li>
        </ol>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Purchase No</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Supplier</TableHead>
            <TableHead className="font-semibold">For</TableHead>
            <TableHead className="font-semibold text-center">Items</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {purchases.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No purchases awaiting approval.</TableCell></TableRow>
            : purchases.map(p => (
              <TableRow key={p.id} className={`hover:bg-muted/30 ${p.status === 'pending' ? 'bg-amber-50/40' : ''}`}>
                <TableCell className="font-mono text-xs font-semibold">{p.purchaseNo}</TableCell>
                <TableCell className="text-xs">{new Date(p.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                <TableCell><Badge variant="outline" className={p.purchaseType === 'foreign' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}>{p.purchaseType}</Badge></TableCell>
                <TableCell>{p.supplier?.name || '—'}</TableCell>
                <TableCell>{p.entity?.name}</TableCell>
                <TableCell className="text-center">{p.itemCount || 0}</TableCell>
                <TableCell className="text-right font-semibold">{(p.grandTotal || 0).toFixed(2)}</TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedPurchase(p); setShowPurchaseDetailDialog(true) }} title="View Details"><Eye className="w-4 h-4" /></Button>
                    {p.status === 'pending' && hasPermission('menu', 'purchaseApproval', 'approve') && (
                      <Button variant="ghost" size="sm" onClick={() => handleApprovePurchase(p.id)} title="Approve" className="text-green-700 hover:text-green-800"><CheckCircle2 className="w-4 h-4" /></Button>
                    )}
                    {p.status === 'approved' && (
                      <Button variant="ghost" size="sm" onClick={() => printPurchaseBarcodes(p.id, p.purchaseNo, p.items || [])} title="Print Barcodes"><Printer className="w-4 h-4" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )

  // Purchase Detail page (currently unused — could be a full page in future)
  const renderPurchaseDetailPage = () => <div>{renderPurchaseListPage()}</div>

  const renderSalesReturnPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sales Return - {workingEntity?.name}</h2>
        <Button onClick={() => { setSalesReturnForm({ itemId: '', customerId: '', salesOrderId: '', quantity: '', price: '', reason: '' }); setTxItemSearch(''); setTxItemResults([]); setTxSelectedItem(null); fetchCustomers(); setCurrentView('newSalesReturn') }}><Plus className="w-4 h-4 mr-2" />New Return</Button>
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

  // ★ Tailor Payment list page
  const renderTailorPaymentPage = () => {
    const filteredPayments = tpSearch
      ? tailorPayments.filter((p: any) =>
          (p.tailor?.name || '').toLowerCase().includes(tpSearch.toLowerCase()) ||
          (p.salesOrder?.salesNo || '').toLowerCase().includes(tpSearch.toLowerCase()) ||
          (p.salesOrder?.customer?.name || '').toLowerCase().includes(tpSearch.toLowerCase())
        )
      : tailorPayments

    // Aggregate per tailor
    const byTailor = new Map<string, { tailorName: string, totalPaid: number, count: number }>()
    for (const p of tailorPayments) {
      const key = p.tailorId
      const entry = byTailor.get(key) || { tailorName: p.tailor?.name || 'Unknown', totalPaid: 0, count: 0 }
      entry.totalPaid += p.amount
      entry.count += 1
      byTailor.set(key, entry)
    }

    const totalPaidAll = tailorPayments.reduce((s, p) => s + p.amount, 0)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-semibold">Tailor Payment — {workingEntity?.name}</h2>
          <div className="flex items-center gap-2">
            <Input placeholder="Search tailor / sales no / customer..." value={tpSearch} onChange={e => setTpSearch(e.target.value)} className="w-72" />
            <Button onClick={() => {
              setTailorPaymentForm({ salesOrderId: '', tailorId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentType: 'cash', referenceNo: '', notes: '' })
              fetchTailors(); fetchSalesOrders()
              setCurrentView('newTailorPayment')
            }}><Plus className="w-4 h-4 mr-2" />New Payment</Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Paid (All Time)</p>
            <p className="text-2xl font-bold text-primary mt-1">{totalPaidAll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{tailorPayments.length} payment(s)</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Unique Tailors Paid</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{byTailor.size}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Distinct tailors who received payment</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Highest Paid Tailor</p>
            <p className="text-base font-semibold mt-1">
              {(() => {
                let max = null as null | { name: string, amount: number }
                for (const v of byTailor.values()) {
                  if (!max || v.totalPaid > max.amount) max = { name: v.tailorName, amount: v.totalPaid }
                }
                return max ? `${max.name} (${max.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })})` : '—'
              })()}
            </p>
          </CardContent></Card>
        </div>

        {/* Payments table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Payment Date</TableHead>
              <TableHead className="font-semibold">Sales No</TableHead>
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="font-semibold">Tailor</TableHead>
              <TableHead className="font-semibold text-right">Amount</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Reference</TableHead>
              <TableHead className="font-semibold">Notes</TableHead>
              <TableHead className="font-semibold text-center">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {tailorPaymentLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No payments recorded yet</TableCell></TableRow>
              ) : filteredPayments.map((p: any) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs">{bdDate(new Date(p.paymentDate))}</TableCell>
                  <TableCell className="font-mono text-xs">{p.salesOrder?.salesNo || '—'}</TableCell>
                  <TableCell>{p.salesOrder?.customer?.name || '—'}</TableCell>
                  <TableCell className="font-medium">
                    {p.tailor?.name || '—'}
                    {p.tailor?.phone && <span className="ml-1 text-[11px] text-muted-foreground">({p.tailor.phone})</span>}
                  </TableCell>
                  <TableCell className="text-right font-bold">{p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{p.paymentType}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{p.referenceNo || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.notes || '—'}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteTailorPayment(p.id)} title="Delete" className="text-destructive h-7 w-7 p-0"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // ★ New Tailor Payment form — full page
  const renderNewTailorPaymentPage = () => {
    // Compute payable/paid for the selected sales order + tailor
    const selectedSalesOrder = salesOrders.find((s: any) => s.id === tailorPaymentForm.salesOrderId) as any
    const totalMaking = selectedSalesOrder?.items?.reduce(
      (sum: number, it: any) => sum + (it.makingEntries?.reduce((s: number, m: any) => s + m.unitPrice * m.quantity, 0) || 0),
      0
    ) || 0
    // Find prior payments for this sales order (regardless of tailor)
    const priorPaymentsForSalesOrder = tailorPayments.filter((p: any) => p.salesOrderId === tailorPaymentForm.salesOrderId)
    const priorPaidForSalesOrder = priorPaymentsForSalesOrder.reduce((s, p) => s + p.amount, 0)
    const priorPaymentsForTailor = priorPaymentsForSalesOrder.filter((p: any) => p.tailorId === tailorPaymentForm.tailorId)
    const priorPaidForTailor = priorPaymentsForTailor.reduce((s, p) => s + p.amount, 0)
    const remainingForTailor = totalMaking - priorPaidForTailor

    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setCurrentView('tailorPayment')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <h2 className="text-xl font-semibold">New Tailor Payment — {workingEntity?.name}</h2>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSaveTailorPayment} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sales Order *</Label>
                  <Combobox
                    options={salesOrders.map((s: any) => ({
                      value: s.id,
                      label: s.salesNo,
                      subLabel: `${s.customer?.name || 'Walk-in'} • ${bdDate(new Date(s.orderDate))}`,
                    }))}
                    value={tailorPaymentForm.salesOrderId}
                    onChange={(v) => setTailorPaymentForm(f => ({ ...f, salesOrderId: v, tailorId: '', amount: '' }))}
                    placeholder="Type sales order no..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tailor *</Label>
                  <Combobox
                    options={tailors
                      .filter((t: any) => t.status === 'active')
                      .map((t: any) => ({ value: t.id, label: t.name, subLabel: t.phone }))}
                    value={tailorPaymentForm.tailorId}
                    onChange={(v) => setTailorPaymentForm(f => ({ ...f, tailorId: v }))}
                    placeholder="Type tailor name..."
                  />
                </div>
              </div>

              {/* Summary for the selected sales order + tailor */}
              {tailorPaymentForm.salesOrderId && (
                <div className="rounded-md border border-blue-200 bg-blue-50/60 p-3 text-xs space-y-1.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div><span className="text-muted-foreground">Total Making (SO):</span> <strong>{totalMaking.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>
                    <div><span className="text-muted-foreground">Paid to all tailors (SO):</span> <strong>{priorPaidForSalesOrder.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>
                    <div><span className="text-muted-foreground">Paid to this tailor (SO):</span> <strong>{priorPaidForTailor.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>
                    <div><span className="text-muted-foreground">Remaining for this tailor:</span> <strong className={remainingForTailor <= 0 ? 'text-green-700' : 'text-amber-700'}>{remainingForTailor.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>
                  </div>
                  {priorPaymentsForTailor.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <p className="font-semibold mb-1">Previous payments to this tailor for this sale:</p>
                      <ul className="space-y-0.5">
                        {priorPaymentsForTailor.map((p: any) => (
                          <li key={p.id} className="flex justify-between">
                            <span>{bdDate(new Date(p.paymentDate))} — {p.paymentType}</span>
                            <span className="font-mono">{p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {remainingForTailor <= 0 && (
                    <p className="mt-2 pt-2 border-t border-amber-200 text-amber-800 font-medium">⚠ This tailor has been fully paid for this sales order. Additional payment will be an overpayment.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" min="0.01" value={tailorPaymentForm.amount} onChange={e => setTailorPaymentForm(f => ({ ...f, amount: e.target.value }))} required placeholder="e.g. 500.00" />
                  {tailorPaymentForm.salesOrderId && remainingForTailor > 0 && (
                    <p className="text-[11px] text-muted-foreground">Remaining payable: {remainingForTailor.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={tailorPaymentForm.paymentDate} onChange={e => setTailorPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select value={tailorPaymentForm.paymentType} onValueChange={v => setTailorPaymentForm(f => ({ ...f, paymentType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reference No.</Label>
                  <Input value={tailorPaymentForm.referenceNo} onChange={e => setTailorPaymentForm(f => ({ ...f, referenceNo: e.target.value }))} placeholder="e.g. bkash TxID, cheque no" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={tailorPaymentForm.notes} onChange={e => setTailorPaymentForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setCurrentView('tailorPayment')}>Cancel</Button>
                <Button type="submit"><Save className="w-4 h-4 mr-2" />Save Payment</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ★ New Receive — full page (not popup)
  const renderNewReceivePage = () => (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setCurrentView('receive')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-semibold">New Receive — {workingEntity?.name}</h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveReceive} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Item *</Label>
              {renderItemSearchField(receiveForm.itemId, (item) => setReceiveForm(f => ({ ...f, itemId: item.id || '' })))}
            </div>
            <div className="space-y-2"><Label>Entity</Label><Input value={workingEntity?.name || ''} disabled /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity *</Label><Input type="number" value={receiveForm.quantity} onChange={e => setReceiveForm(f => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
              <div className="space-y-2"><Label>Source Entity</Label><Select value={receiveForm.sourceEntityId || '__none__'} onValueChange={v => setReceiveForm(f => ({ ...f, sourceEntityId: v === '__none__' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent><SelectItem value="__none__">None</SelectItem>{entities.filter(e => e.id !== workingEntity?.id).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Reference No</Label><Input value={receiveForm.referenceNo} onChange={e => setReceiveForm(f => ({ ...f, referenceNo: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={receiveForm.notes} onChange={e => setReceiveForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setCurrentView('receive')}>Cancel</Button>
              <Button type="submit"><Save className="w-4 h-4 mr-2" />Save Receive</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )

  // ★ New Sales Return — full page (not popup)
  const renderNewSalesReturnPage = () => (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setCurrentView('salesReturn')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-semibold">New Sales Return — {workingEntity?.name}</h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveSalesReturn} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Item *</Label>
              {renderItemSearchField(salesReturnForm.itemId, (item) => setSalesReturnForm(f => ({ ...f, itemId: item.id || '', price: item.price?.toString() || '' })))}
            </div>
            <div className="space-y-2"><Label>Customer *</Label><Select value={salesReturnForm.customerId} onValueChange={v => setSalesReturnForm(f => ({ ...f, customerId: v }))}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity *</Label><Input type="number" value={salesReturnForm.quantity} onChange={e => setSalesReturnForm(f => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
              <div className="space-y-2"><Label>Price *</Label><Input type="number" step="0.01" value={salesReturnForm.price} onChange={e => setSalesReturnForm(f => ({ ...f, price: e.target.value }))} required /></div>
            </div>
            <div className="space-y-2"><Label>Reason *</Label><Input value={salesReturnForm.reason} onChange={e => setSalesReturnForm(f => ({ ...f, reason: e.target.value }))} required /></div>
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setCurrentView('salesReturn')}>Cancel</Button>
              <Button type="submit"><Save className="w-4 h-4 mr-2" />Create Return</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )

  // ★ New Supplier Payment — full page (not popup)
  const renderNewSupplierPaymentPage = () => (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setCurrentView('supplierPayments')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-semibold">New Supplier Payment — {workingEntity?.name}</h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveSp} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={spForm.supplierId || '__none__'} onValueChange={v => setSpForm(f => ({ ...f, supplierId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {(suppliers || []).filter(s => s.status === 'active').map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Amount *</Label><Input type="number" step="0.01" value={spForm.amount} onChange={e => setSpForm(f => ({ ...f, amount: e.target.value }))} required /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Payment Date</Label><Input type="date" value={spForm.paymentDate} onChange={e => setSpForm(f => ({ ...f, paymentDate: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Payment Type</Label><Select value={spForm.paymentType} onValueChange={v => setSpForm(f => ({ ...f, paymentType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="bank">Bank Transfer</SelectItem><SelectItem value="mobile_banking">Mobile Banking</SelectItem></SelectContent></Select></div>
            </div>
            {spForm.paymentType === 'cheque' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Cheque No</Label><Input value={spForm.chequeNo} onChange={e => setSpForm(f => ({ ...f, chequeNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Bank Name</Label><Input value={spForm.bankName} onChange={e => setSpForm(f => ({ ...f, bankName: e.target.value }))} /></div>
              </div>
            )}
            <div className="space-y-2"><Label>Notes</Label><Input value={spForm.notes} onChange={e => setSpForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setCurrentView('supplierPayments')}>Cancel</Button>
              <Button type="submit"><Save className="w-4 h-4 mr-2" />Save Payment</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )

  const renderBookingPage = () => {
    // Filter bookings by date range
    const filteredBookings = bookings.filter((b: any) => {
      if (bookingDateFrom && new Date(b.bookingDate) < new Date(bookingDateFrom)) return false
      if (bookingDateTo) {
        const endToDate = new Date(bookingDateTo); endToDate.setHours(23, 59, 59, 999)
        if (new Date(b.bookingDate) > endToDate) return false
      }
      return true
    })

    return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Booking - {workingEntity?.name}</h2>
        <div className="flex gap-2 flex-wrap">
          <Input type="date" placeholder="From" value={bookingDateFrom} onChange={e => setBookingDateFrom(e.target.value)} className="w-auto text-xs" />
          <Input type="date" placeholder="To" value={bookingDateTo} onChange={e => setBookingDateTo(e.target.value)} className="w-auto text-xs" />
          <Button variant="outline" size="sm" onClick={handleExportBookings} disabled={exporting} style={{ display: hasPermission('menu', 'booking', 'export') ? '' : 'none' }}>
            {exporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Excel
          </Button>
          <Button onClick={() => { resetBookingForm(); fetchCustomers(); setCurrentView('newBooking') }} className="gap-2"><Plus className="w-4 h-4" />New Booking</Button>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Booking No</TableHead>
            <TableHead className="font-semibold">Items</TableHead>
            <TableHead className="font-semibold">Customer</TableHead>
            <TableHead className="font-semibold">Booking Date</TableHead>
            <TableHead className="font-semibold">Till Date</TableHead>
            <TableHead className="font-semibold">Reason</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredBookings.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No bookings found</TableCell></TableRow>
            : filteredBookings.map((b: any) => (
              <TableRow key={b.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{b.bookingNo}</TableCell>
                <TableCell>
                  {b.items?.map((bi: any, i: number) => (
                    <div key={i} className="text-xs">
                      {bi.item?.itemName || '—'} <span className="text-muted-foreground">({bi.fromEntity?.name || '?'})</span> ×{bi.quantity}
                    </div>
                  ))}
                </TableCell>
                <TableCell>{b.customer?.name || '—'}</TableCell>
                <TableCell className="text-xs">{bdDate(new Date(b.bookingDate))}</TableCell>
                <TableCell className="text-xs">{b.tillDate ? bdDate(new Date(b.tillDate)) : '—'}</TableCell>
                <TableCell className="text-xs">{b.reason || '—'}</TableCell>
                <TableCell><Badge variant={b.status === 'delivered' ? 'default' : b.status === 'cancelled' ? 'destructive' : 'secondary'} className="capitalize">{b.status}</Badge></TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => printBooking(b)} title="Print / PDF"><FileText className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setEditingBookingId(b.id)
                    setBookingForm({
                      customerId: b.customerId || '',
                      bookingDate: new Date(b.bookingDate).toISOString().split('T')[0],
                      tillDate: b.tillDate ? new Date(b.tillDate).toISOString().split('T')[0] : '',
                      status: b.status,
                      reason: b.reason || '',
                      notes: b.notes || '',
                      items: (b.items || []).map((bi: any) => ({ itemId: bi.itemId, fromEntityId: bi.fromEntityId, quantity: String(bi.quantity) })),
                      newCustomerName: '', newCustomerPhone: '', newCustomerEmail: '', newCustomerAddress: '',
                    })
                    setBookingCustomerMode('existing')
                    fetchCustomers()
                    setCurrentView('newBooking')
                  }} title="Edit"><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteBooking(b.id)} className="text-destructive hover:text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Booking form is now a full page — see renderNewBookingPage() */}
    </div>
    )
  }

  // ★ New Booking — full page (not dialog)
  const renderNewBookingPage = () => (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{editingBookingId ? 'Edit Booking' : 'New Booking'}</h2>
        <Button variant="outline" onClick={() => { resetBookingForm(); setEditingBookingId(null); setCurrentView('booking') }}><X className="w-4 h-4 mr-2" />Back to List</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveBooking} className="space-y-4">
            {/* Customer: Existing vs New toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Customer</Label>
              <div className="flex gap-2 mb-2">
                <Button type="button" size="sm" variant={bookingCustomerMode === 'existing' ? 'default' : 'outline'} onClick={() => setBookingCustomerMode('existing')}>Existing Customer</Button>
                <Button type="button" size="sm" variant={bookingCustomerMode === 'new' ? 'default' : 'outline'} onClick={() => setBookingCustomerMode('new')}>New Customer</Button>
              </div>
              {bookingCustomerMode === 'existing' ? (
                <div className="space-y-2">
                  <Input placeholder="Search by name or phone..." value={bookingCustomerSearch} onChange={e => setBookingCustomerSearch(e.target.value)} className="text-sm" />
                  <Select value={bookingForm.customerId} onValueChange={v => setBookingForm({ ...bookingForm, customerId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.filter(c => {
                        if (!bookingCustomerSearch) return true
                        const s = bookingCustomerSearch.toLowerCase()
                        return c.name.toLowerCase().includes(s) || (c.phone || '').includes(bookingCustomerSearch)
                      }).map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 border rounded-lg p-3 bg-muted/30">
                  <div className="space-y-1"><Label className="text-xs">Name *</Label><Input placeholder="Customer name" value={bookingForm.newCustomerName} onChange={e => setBookingForm({ ...bookingForm, newCustomerName: e.target.value })} required /></div>
                  <div className="space-y-1"><Label className="text-xs">Phone</Label><Input placeholder="Phone" value={bookingForm.newCustomerPhone} onChange={e => setBookingForm({ ...bookingForm, newCustomerPhone: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input placeholder="Email" value={bookingForm.newCustomerEmail} onChange={e => setBookingForm({ ...bookingForm, newCustomerEmail: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Address</Label><Input placeholder="Address" value={bookingForm.newCustomerAddress} onChange={e => setBookingForm({ ...bookingForm, newCustomerAddress: e.target.value })} /></div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* For Entity — user must select, no default */}
              <div className="space-y-2">
                <Label>For Entity *</Label>
                <Select value={bookingForm.forEntityId} onValueChange={v => setBookingForm({ ...bookingForm, forEntityId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
                  <SelectContent>{entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Booking Date</Label><Input type="date" value={bookingForm.bookingDate} onChange={e => setBookingForm({ ...bookingForm, bookingDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Till Date</Label><Input type="date" value={bookingForm.tillDate} onChange={e => setBookingForm({ ...bookingForm, tillDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Status</Label><Select value={bookingForm.status} onValueChange={v => setBookingForm({ ...bookingForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="confirmed">Confirmed</SelectItem><SelectItem value="processing">Processing</SelectItem><SelectItem value="delivered">Delivered</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div>
            </div>

            {/* Reason dropdown from BookingReason master data */}
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={bookingForm.reason} onValueChange={v => setBookingForm({ ...bookingForm, reason: v })}>
                <SelectTrigger><SelectValue placeholder="Select reason (or type below)" /></SelectTrigger>
                <SelectContent>{bookingReasons.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Or type a custom reason" value={bookingForm.reason} onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })} className="text-xs" />
            </div>

            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Items</Label>
              <div className="flex gap-2">
                <Input placeholder="Search item to add..." value={bookingItemSearch} onChange={e => setBookingItemSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleBookingItemSearch())} className="flex-1" />
                <Button type="button" variant="outline" onClick={handleBookingItemSearch}><Search className="w-4 h-4" /></Button>
              </div>
              {bookingItemResults.length > 0 && (
                <div className="border rounded-lg max-h-40 overflow-y-auto bg-background shadow-lg" style={{ zIndex: 1000, position: 'relative' }}>
                  {bookingItemResults.map((item, idx) => (
                    <div key={item.id || idx} onClick={() => addBookingItem(item)} className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground text-sm border-b last:border-0 cursor-pointer transition-colors">
                      {item.itemName || 'Unknown'} {item.year ? `(${item.year})` : ''}
                    </div>
                  ))}
                </div>
              )}
              {bookingForm.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader><TableRow className="bg-muted/50">
                      <TableHead className="font-semibold text-xs">Item</TableHead>
                      <TableHead className="font-semibold text-xs">From Entity</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Qty</TableHead>
                      <TableHead className="font-semibold text-xs text-center">×</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {bookingForm.items.map((bi, i) => {
                        const itemName = bi.itemName || (editingBookingId && bookings.find((b: any) => b.id === editingBookingId)?.items?.find((bi2: any) => bi2.itemId === bi.itemId)?.item?.itemName) || bi.itemId.slice(0, 8)
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{itemName}</TableCell>
                            <TableCell>
                              <Select value={bi.fromEntityId} onValueChange={v => updateBookingItem(i, 'fromEntityId', v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select entity" /></SelectTrigger>
                                <SelectContent>{entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="w-20"><Input type="number" value={bi.quantity} onChange={e => updateBookingItem(i, 'quantity', e.target.value)} className="h-8 text-xs text-right" /></TableCell>
                            <TableCell className="text-center"><Button type="button" variant="ghost" size="sm" onClick={() => removeBookingItem(i)} className="text-destructive"><X className="w-3 h-3" /></Button></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-2"><Label>Notes</Label><Input value={bookingForm.notes} onChange={e => setBookingForm({ ...bookingForm, notes: e.target.value })} /></div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" size="lg"><Save className="w-4 h-4 mr-2" />{editingBookingId ? 'Update Booking' : 'Create Booking'}</Button>
              <Button type="button" variant="outline" size="lg" onClick={() => { resetBookingForm(); setEditingBookingId(null); setCurrentView('booking') }}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )

  // Print booking — opens a new window with printable HTML
  const printBooking = (b: any) => {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) { toast({ title: 'Error', description: 'Please allow popups', variant: 'destructive' }); return }
    const itemsHtml = (b.items || []).map((bi: any, i: number) => `
      <tr>
        <td style="padding:6px 12px;border:1px solid #ddd">${i + 1}</td>
        <td style="padding:6px 12px;border:1px solid #ddd">${bi.item?.itemName || '—'}</td>
        <td style="padding:6px 12px;border:1px solid #ddd">${bi.fromEntity?.name || '—'}</td>
        <td style="padding:6px 12px;border:1px solid #ddd;text-align:right">${bi.quantity}</td>
      </tr>
    `).join('')
    win.document.write(`
      <html><head><title>Booking ${b.bookingNo}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { font-size: 22px; margin-bottom: 5px; }
        .info { display: flex; gap: 40px; margin: 20px 0; }
        .info div { font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f0f0f0; padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; }
        .signature { border-top: 1px solid #000; padding-top: 5px; width: 200px; text-align: center; font-size: 12px; }
      </style></head><body>
      <h1>Booking Receipt</h1>
      <p style="font-size:14px;color:#666">Booking No: <strong>${b.bookingNo}</strong></p>
      <div class="info">
        <div><strong>Customer:</strong> ${b.customer?.name || '—'}<br>${b.customer?.phone ? 'Phone: ' + b.customer.phone : ''}</div>
        <div><strong>Booking Date:</strong> ${bdDate(new Date(b.bookingDate))}<br><strong>Till Date:</strong> ${b.tillDate ? bdDate(new Date(b.tillDate)) : '—'}</div>
        <div><strong>For Entity:</strong> ${b.entity?.name || workingEntity?.name || ''}<br><strong>Status:</strong> ${b.status}</div>
      </div>
      ${b.reason ? `<p><strong>Reason:</strong> ${b.reason}</p>` : ''}
      <table>
        <thead><tr><th style="padding:8px 12px;border:1px solid #ddd">SL</th><th style="padding:8px 12px;border:1px solid #ddd">Item</th><th style="padding:8px 12px;border:1px solid #ddd">From Entity</th><th style="padding:8px 12px;border:1px solid #ddd;text-align:right">Qty</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      ${b.notes ? `<p style="margin-top:20px"><strong>Notes:</strong> ${b.notes}</p>` : ''}
      <div class="footer">
        <div class="signature">Authorized Signature</div>
        <div class="signature">Customer Signature</div>
      </div>
      <script>window.onload = () => { window.print() }</script>
      </body></html>
    `)
    win.document.close()
  }

  // Export bookings to Excel
  const handleExportBookings = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (bookingDateFrom) params.set('from', bookingDateFrom)
      if (bookingDateTo) params.set('to', bookingDateTo)
      if (workingEntity?.id) params.set('entityId', workingEntity.id)
      const res = await authFetch(`/api/bookings/export?${params.toString()}`)
      if (!res.ok) { toast({ title: 'Error', description: 'Export failed', variant: 'destructive' }); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `bookings-export-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({ title: 'Downloaded', description: link.download })
    } catch { toast({ title: 'Error', description: 'Export failed', variant: 'destructive' }) }
    finally { setExporting(false) }
  }

  // Booking Reasons management page
  const renderBookingReasonsPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Booking Reasons</h2><p className="text-sm text-muted-foreground">Pre-define reasons for bookings</p></div>
        <Button onClick={() => { setEditingReasonId(null); setBookingReasonForm({ name: '', description: '', status: 'active' }); setShowReasonDialog(true) }} className="gap-2"><Plus className="w-4 h-4" />Add Reason</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {bookingReasons.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No reasons found</TableCell></TableRow>
            : bookingReasons.map(r => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.description || '—'}</TableCell>
                <TableCell><Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => { setEditingReasonId(r.id); setBookingReasonForm({ name: r.name, description: r.description, status: r.status }); setShowReasonDialog(true) }} title="Edit"><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteBookingReason(r.id)} className="text-destructive hover:text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingReasonId ? 'Edit Reason' : 'Add Reason'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveBookingReason} className="space-y-4">
            <div className="space-y-2"><Label>Reason Name *</Label><Input value={bookingReasonForm.name} onChange={e => setBookingReasonForm({ ...bookingReasonForm, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={bookingReasonForm.description} onChange={e => setBookingReasonForm({ ...bookingReasonForm, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={bookingReasonForm.status} onValueChange={v => setBookingReasonForm({ ...bookingReasonForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingReasonId ? 'Update' : 'Create'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderIncentivePage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Incentive - {workingEntity?.name}</h2>
        <div className="flex gap-2">
          {incentiveSubTab === 'formulas' ? (
            <Button onClick={openNewFormulaPage} className="gap-2"><Plus className="w-4 h-4" />New Formula</Button>
          ) : (
            <Button onClick={() => { setShowIncentiveDialog(true); setTxItemSearch(''); setTxItemResults([]); fetchTailors() }} className="gap-2"><Plus className="w-4 h-4" />New Incentive</Button>
          )}
        </div>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex gap-1 border-b">
        <button onClick={() => setIncentiveSubTab('formulas')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${incentiveSubTab === 'formulas' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          <Settings2 className="w-4 h-4" /> Formulas ({incentiveFormulas.length})
        </button>
        <button onClick={() => setIncentiveSubTab('manual')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${incentiveSubTab === 'manual' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          <DollarSign className="w-4 h-4" /> Incentive Report ({incentives.length})
        </button>
      </div>

      {incentiveSubTab === 'formulas' ? (
        <div className="space-y-3">
          <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900">
            <p className="font-semibold mb-1">📋 How formulas work</p>
            <p>1. Create a formula with a price range (e.g. 700-1200) and commission amounts per entity (Outlet: 10, Head Office: 5, default: 5).<br/>
            2. Assign items to the formula (an item can be in multiple formulas with non-overlapping ranges).<br/>
            3. When a sales order is created with a sale unit price falling within the formula's range, an incentive entry is auto-generated and pushed to the Incentive Report tab.</p>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Formula Name</TableHead>
                <TableHead className="font-semibold text-right">Price Range</TableHead>
                <TableHead className="font-semibold">Commission per Entity</TableHead>
                <TableHead className="font-semibold text-center">Items</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-center">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {incentiveFormulas.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No formulas yet. Click "New Formula" to create one.</TableCell></TableRow>
                : incentiveFormulas.map(f => {
                  const ranges = f.ranges || []
                  return (
                    <TableRow key={f.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-semibold">{f.name}</div>
                        {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {ranges.length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                            ranges.map((r: any, i: number) => (
                              <div key={i} className="text-xs font-mono">
                                {r.priceFrom}–{r.priceTo}
                                <span className="ml-1 text-green-700">O:{r.outletCommission}</span>
                                <span className="ml-1 text-blue-700">H:{r.headOfficeCommission}</span>
                              </div>
                            ))
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Outlet</Badge>
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Head Office</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{(f.items || []).length}</TableCell>
                      <TableCell>{f.status === 'active' ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditFormulaPage(f)} title="Edit"><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteFormula(f.id)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Item</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold text-right">Units</TableHead>
              <TableHead className="font-semibold text-right">Sale Price/Unit</TableHead>
              <TableHead className="font-semibold text-right">Amount</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Notes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {incentives.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No incentives yet. Formula-based incentives will appear here automatically when sales happen.</TableCell></TableRow>
              : incentives.map(i => (
                <TableRow key={i.id} className={`hover:bg-muted/30 ${(i as any).type === 'formula' ? 'bg-blue-50/30' : ''}`}>
                  <TableCell className="font-medium">{i.itemName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs capitalize ${(i as any).type === 'formula' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>{i.type}</Badge>
                    {i.tailorName && <div className="text-[10px] text-muted-foreground">{i.tailorName}</div>}
                  </TableCell>
                  <TableCell className="text-right">{(i as any).units || 1}</TableCell>
                  <TableCell className="text-right text-xs">{(i as any).saleUnitPrice != null ? (i as any).saleUnitPrice.toFixed(2) : '—'}</TableCell>
                  <TableCell className="text-right font-semibold">{i.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{statusBadge(i.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={i.notes || ''}>{i.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Manual Incentive Dialog */}
      <Dialog open={showIncentiveDialog} onOpenChange={setShowIncentiveDialog}>
        <DialogContent><DialogHeader><DialogTitle>New Incentive</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveIncentive} className="space-y-4">
            {renderItemSearchField(incentiveForm.itemId, (item) => setIncentiveForm(f => ({ ...f, itemId: item.id || '' })))}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tailor</Label><Select value={incentiveForm.tailorId || '__none__'} onValueChange={v => setIncentiveForm(f => ({ ...f, tailorId: v === '__none__' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent><SelectItem value="__none__">None</SelectItem>{tailors.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Type*</Label><Select value={incentiveForm.type} onValueChange={v => setIncentiveForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tailor">Tailor</SelectItem><SelectItem value="sales">Sales</SelectItem><SelectItem value="bonus">Bonus</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Amount*</Label><Input type="number" step="0.01" value={incentiveForm.amount} onChange={e => setIncentiveForm(f => ({ ...f, amount: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={incentiveForm.notes} onChange={e => setIncentiveForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <DialogFooter><Button type="submit">Save Incentive</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Formula page is now full page — see renderNewFormulaPage() */}
    </div>
  )

  // ★ New Formula — full page with multi-range support
  const renderNewFormulaPage = () => (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{editingFormulaId ? 'Edit Formula' : 'New Formula'}</h2>
        <Button variant="outline" onClick={() => { resetFormulaForm(); setCurrentView('incentive') }}><X className="w-4 h-4 mr-2" />Back to List</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveFormula} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1"><Label className="text-xs">Formula Name *</Label><Input placeholder="e.g. Fresh Fabric" value={formulaForm.name} onChange={e => setFormulaForm({ ...formulaForm, name: e.target.value })} required /></div>
              <div className="space-y-1"><Label className="text-xs">Status</Label><Select value={formulaForm.status} onValueChange={v => setFormulaForm({ ...formulaForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Description</Label><Input placeholder="Optional description" value={formulaForm.description} onChange={e => setFormulaForm({ ...formulaForm, description: e.target.value })} /></div>

            <Separator />

            {/* Multiple Ranges */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold">Price Ranges & Commission</Label>
                  <p className="text-[11px] text-muted-foreground">Each range has 2 rates: Outlet (all shop/branch entities) and Head Office (head office + warehouse + others).</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addFormulaRange}><Plus className="w-3 h-3 mr-1" />Add Range</Button>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary text-primary-foreground">
                    <tr>
                      <th className="px-2 py-2 text-center w-10 text-[11px] uppercase">#</th>
                      <th className="px-2 py-2 text-right text-[11px] uppercase">Price From</th>
                      <th className="px-2 py-2 text-right text-[11px] uppercase">Price To</th>
                      <th className="px-2 py-2 text-right text-[11px] uppercase">Outlet Commission<br/><span className="text-[9px] normal-case">(per unit, all outlets)</span></th>
                      <th className="px-2 py-2 text-right text-[11px] uppercase">Head Office Commission<br/><span className="text-[9px] normal-case">(per unit, HO+warehouse+others)</span></th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formulaForm.ranges.map((r, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-2 py-2 text-center text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="px-2 py-2"><Input type="number" step="0.01" placeholder="e.g. 700" value={r.priceFrom} onChange={e => updateFormulaRange(idx, 'priceFrom', e.target.value)} className="h-8 text-right text-sm w-full min-w-[90px]" /></td>
                        <td className="px-2 py-2"><Input type="number" step="0.01" placeholder="e.g. 1200" value={r.priceTo} onChange={e => updateFormulaRange(idx, 'priceTo', e.target.value)} className="h-8 text-right text-sm w-full min-w-[90px]" /></td>
                        <td className="px-2 py-2"><Input type="number" step="0.01" placeholder="e.g. 10" value={r.outletCommission} onChange={e => updateFormulaRange(idx, 'outletCommission', e.target.value)} className="h-8 text-right text-sm w-full min-w-[90px]" /></td>
                        <td className="px-2 py-2"><Input type="number" step="0.01" placeholder="e.g. 5" value={r.headOfficeCommission} onChange={e => updateFormulaRange(idx, 'headOfficeCommission', e.target.value)} className="h-8 text-right text-sm w-full min-w-[90px]" /></td>
                        <td className="px-2 py-2 text-center">{formulaForm.ranges.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeFormulaRange(idx)} className="text-destructive h-7 w-7 p-0"><X className="w-3.5 h-3.5" /></Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-2">
              <Label className="text-sm font-bold">Items covered by this formula ({formulaForm.itemIds.length})</Label>
              <p className="text-[11px] text-muted-foreground">Search and select items. When these items are sold within a range, incentives auto-generate.</p>
              <div className="flex gap-2">
                <Input placeholder="Search item to add..." value={formulaItemSearch} onChange={e => setFormulaItemSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleFormulaItemSearch())} className="flex-1" />
                <Button type="button" variant="outline" onClick={handleFormulaItemSearch}><Search className="w-4 h-4" /></Button>
              </div>
              {formulaItemResults.length > 0 && (
                <div className="border rounded-md max-h-32 overflow-y-auto bg-background shadow-lg">
                  {formulaItemResults.map((item, idx) => {
                    const isSelected = formulaForm.itemIds.includes(item.id)
                    return (
                      <button key={item.id || idx} type="button" onClick={() => toggleFormulaItem(item.id, item.itemName)} className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 transition-colors ${isSelected ? 'bg-green-50 text-green-700' : 'hover:bg-muted'}`}>
                        {isSelected ? '✓ ' : ''}{item.itemName || 'Unknown'} {item.year ? `(${item.year})` : ''}
                      </button>
                    )
                  })}
                </div>
              )}
              {formulaForm.itemIds.length > 0 && (
                <div className="flex gap-1 flex-wrap pt-1">
                  {formulaForm.itemIds.map(id => {
                    const name = formulaForm.itemNames[id] || formulaItemResults.find((r: any) => r.id === id)?.itemName || `Item ${id.slice(-6)}`
                    return (
                      <Badge key={id} variant="outline" className="text-xs bg-blue-50 text-blue-800 gap-1">
                        {name}
                        <button type="button" onClick={() => toggleFormulaItem(id)} className="ml-1 hover:text-red-600"><X className="w-3 h-3" /></button>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1"><Label className="text-xs">Notes</Label><Input value={formulaForm.notes} onChange={e => setFormulaForm({ ...formulaForm, notes: e.target.value })} placeholder="Optional notes" /></div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" size="lg"><Save className="w-4 h-4 mr-2" />{editingFormulaId ? 'Update Formula' : 'Create Formula'}</Button>
              <Button type="button" variant="outline" size="lg" onClick={() => { resetFormulaForm(); setCurrentView('incentive') }}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )

  // ★ Supplier Payments handlers (state is at top-level)
  // fetchSupplierPayments is called via useEffect below

  const handleSaveSp = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await confirm({
      title: 'Save Supplier Payment?',
      message: `This will record a payment of ${parseFloat(spForm.amount || '0').toFixed(2)} to the selected supplier${spForm.purchaseId ? ' for the selected purchase' : ''}. The payment will be recorded permanently. Regular users will not be able to modify this payment afterwards. (Admins can still edit.) Do you want to continue?`,
      confirmLabel: 'Save Payment',
    })
    if (!ok) return
    try {
      const res = await authFetch('/api/supplier-payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...spForm, entityId: workingEntity?.id, amount: parseFloat(spForm.amount) }) })
      if (res.ok) { toast({ title: 'Success', description: 'Payment recorded' }); setShowSpDialog(false); setSpForm({ supplierId: '', purchaseId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentType: 'cash', chequeNo: '', bankName: '', notes: '' }); fetchSupplierPayments() }
      else { const d = await res.json(); toast({ title: 'Error', description: d.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Failed', variant: 'destructive' }) }
  }

  // ★ Supplier Payments page
  const renderSupplierPaymentsPage = () => {
    const filtered = spSearch ? spPayments.filter(p => (p.supplier?.name || '').toLowerCase().includes(spSearch.toLowerCase())) : spPayments
    const totalPaid = filtered.reduce((s, p) => s + p.amount, 0)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Supplier Payments - {workingEntity?.name}</h2>
          <Button onClick={() => { setSpForm({ supplierId: '', purchaseId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentType: 'cash', chequeNo: '', bankName: '', notes: '' }); setCurrentView('newSupplierPayment') }}><Plus className="w-4 h-4 mr-2" />New Payment</Button>
        </div>
        <div className="flex gap-3 items-center">
          <Input placeholder="Search supplier..." value={spSearch} onChange={e => setSpSearch(e.target.value)} className="w-64" />
          <Badge variant="outline" className="bg-blue-50 text-blue-700">Total Paid: {totalPaid.toFixed(2)}</Badge>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Supplier</TableHead>
              <TableHead className="font-semibold">Purchase No</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold text-right">Amount</TableHead>
              <TableHead className="font-semibold">Notes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {spLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No payments</TableCell></TableRow>
              : filtered.map(p => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{p.supplier?.name || '—'}</TableCell>
                  <TableCell className="text-xs font-mono">{p.purchase?.purchaseNo || '—'}</TableCell>
                  <TableCell className="text-xs">{new Date(p.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{p.paymentType}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{p.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Dialog open={showSpDialog} onOpenChange={setShowSpDialog}>
          <DialogContent><DialogHeader><DialogTitle>New Supplier Payment</DialogTitle></DialogHeader>
            <form onSubmit={handleSaveSp} className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Supplier *</Label><Select value={spForm.supplierId || '__none__'} onValueChange={v => setSpForm({ ...spForm, supplierId: v === '__none__' ? '' : v })}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent><SelectItem value="__none__">— None —</SelectItem>{(suppliers || []).filter(s => s.status === 'active').map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Amount *</Label><Input type="number" step="0.01" value={spForm.amount} onChange={e => setSpForm({ ...spForm, amount: e.target.value })} required /></div>
                <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={spForm.paymentDate} onChange={e => setSpForm({ ...spForm, paymentDate: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Type</Label><Select value={spForm.paymentType} onValueChange={v => setSpForm({ ...spForm, paymentType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="mobile_banking">Mobile Banking</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent></Select></div>
                {spForm.paymentType === 'cheque' && <div className="space-y-1"><Label className="text-xs">Cheque No</Label><Input value={spForm.chequeNo} onChange={e => setSpForm({ ...spForm, chequeNo: e.target.value })} /></div>}
              </div>
              <div className="space-y-1"><Label className="text-xs">Notes</Label><Input value={spForm.notes} onChange={e => setSpForm({ ...spForm, notes: e.target.value })} /></div>
              <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />Save Payment</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ★ Delivery Management page
  const renderDeliveryPage = () => {
    // Filter sales orders by search term (sales number or customer name)
    const matchingOrders = (salesOrders || []).filter((s: any) => {
      if (!deliverySalesSearch) return true
      const q = deliverySalesSearch.toLowerCase()
      return (s.salesNo || '').toLowerCase().includes(q) ||
             (s.customer?.name || '').toLowerCase().includes(q) ||
             (s.customer?.phone || '').includes(q)
    }).filter((s: any) => s.status !== 'delivered') // hide fully-delivered orders

    // When user selects an order, show its items for picking
    const selectOrder = (order: any) => {
      setDeliverySelectedOrder(order)
      // ★ Compute already-delivered qty per sales order item (from existing deliveries)
      const alreadyDelivered = new Map<string, number>()
      for (const d of (order.deliveries || [])) {
        for (const di of (d.items || [])) {
          alreadyDelivered.set(di.salesOrderItemId, (alreadyDelivered.get(di.salesOrderItemId) || 0) + di.quantity)
        }
      }
      // Pre-populate the picked items list with all order items
      // deliverQty = empty (user must scan to deliver)
      // Each item also tracks: alreadyDeliveredQty, remainingQty
      setDeliveryPickedItems((order.items || []).map((si: any) => {
        const already = alreadyDelivered.get(si.id) || 0
        return {
          salesOrderItemId: si.id,
          itemId: si.itemId,
          itemName: si.item?.itemName || '—',
          barcode: si.item?.barcode || '',
          itemCode: si.item?.itemCode || '',
          uom: si.item?.uom || 'PCS',
          orderedQty: si.quantity,
          alreadyDeliveredQty: already,
          remainingQty: si.quantity - already,
          deliverQty: '', // empty until user scans barcode
        }
      }))
      setDeliveryBarcodeInput('')
    }

    // When user scans/types a barcode, find the matching item in the order
    const handleBarcodeScan = () => {
      const bc = deliveryBarcodeInput.trim()
      if (!bc) return
      // Find a picked item matching this barcode (or itemCode or itemName) that still has remaining qty
      const match = deliveryPickedItems.find((p: any) =>
        ((p.barcode && p.barcode.toLowerCase() === bc.toLowerCase()) ||
         (p.itemCode && p.itemCode.toLowerCase() === bc.toLowerCase()) ||
         (p.itemName && p.itemName.toLowerCase() === bc.toLowerCase()))
        && (p.remainingQty || (p.orderedQty - (p.alreadyDeliveredQty || 0))) > 0
      )
      if (!match) {
        // Check if the item matches but is fully delivered
        const fullMatch = deliveryPickedItems.find((p: any) =>
          (p.barcode && p.barcode.toLowerCase() === bc.toLowerCase()) ||
          (p.itemCode && p.itemCode.toLowerCase() === bc.toLowerCase()) ||
          (p.itemName && p.itemName.toLowerCase() === bc.toLowerCase())
        )
        if (fullMatch) {
          toast({ title: 'Already fully delivered', description: `${fullMatch.itemName} has no remaining quantity to deliver.`, variant: 'destructive' })
        } else {
          toast({ title: 'Not found', description: `No item in this sales order matches "${bc}".`, variant: 'destructive' })
        }
        setDeliveryBarcodeInput('')
        return
      }
      // Increment the deliverQty for this item (capped at remaining)
      const currentQty = parseInt(match.deliverQty) || 0
      const remaining = match.remainingQty || (match.orderedQty - (match.alreadyDeliveredQty || 0))
      if (currentQty >= remaining) {
        toast({ title: 'Max reached', description: `${match.itemName}: already at max ${remaining} for this delivery.`, variant: 'destructive' })
        setDeliveryBarcodeInput('')
        return
      }
      setDeliveryPickedItems(items =>
        items.map((p: any) => p.itemId === match.itemId
          ? { ...p, deliverQty: String((parseInt(p.deliverQty) || 0) + 1) }
          : p
        )
      )
      toast({ title: '✓ Added', description: `${match.itemName}: ${currentQty + 1} of ${remaining} remaining` })
      setDeliveryBarcodeInput('')
    }

    // Submit delivery — calls POST /api/sales-orders/[id]/deliver
    const handleSubmitDelivery = async () => {
      if (!deliverySelectedOrder) return
      const itemsToDeliver = deliveryPickedItems.filter(p => parseInt(p.deliverQty) > 0)
      if (itemsToDeliver.length === 0) {
        toast({ title: 'Error', description: 'Scan at least one barcode to deliver items.', variant: 'destructive' })
        return
      }
      const ok = await confirm({
        title: 'Confirm Delivery?',
        message: `This will deliver ${itemsToDeliver.length} item line(s) and decrement stock from "${deliverySelectedOrder.entity?.name || 'this entity'}". This action cannot be undone by regular users (admin can). Do you want to continue?`,
        confirmLabel: 'Confirm Delivery',
      })
      if (!ok) return
      setDelivering(true)
      try {
        const res = await authFetch(`/api/sales-orders/${deliverySelectedOrder.id}/deliver`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: itemsToDeliver.map(p => ({
              salesOrderItemId: p.salesOrderItemId,
              itemId: p.itemId,
              quantity: parseInt(p.deliverQty),
            })),
            deliveryPerson,
            deliveryNotes,
          }),
        })
        const data = await res.json()
        if (res.ok) {
          toast({ title: '✓ Delivered', description: data.message || `Delivery ${data.deliveryNo} created.` })
          // Refresh sales orders + re-select this order to show updated delivery history
          await fetchSalesOrders()
          // Re-fetch the order to get the new delivery in its deliveries array
          try {
            const refetch = await authFetch(`/api/sales-orders?entityId=${workingEntity?.id}`)
            if (refetch.ok) {
              const d2 = await refetch.json()
              const updated = (d2.salesOrders || []).find((so: any) => so.id === deliverySelectedOrder.id)
              if (updated) {
                setDeliverySelectedOrder(updated)
                selectOrder(updated)
              } else {
                setDeliverySelectedOrder(null)
                setDeliveryPickedItems([])
              }
            }
          } catch {}
          setDeliveryBarcodeInput('')
          setDeliveryPerson('')
          setDeliveryNotes('')
        } else {
          toast({ title: 'Error', description: data.error || 'Delivery failed', variant: 'destructive' })
        }
      } catch (e) {
        toast({ title: 'Error', description: 'Delivery failed: ' + String(e), variant: 'destructive' })
      } finally {
        setDelivering(false)
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Delivery Management — {workingEntity?.name}</h2>
        </div>

        {/* Info banner — explain the flow */}
        <div className="rounded-md border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900">
          <p className="font-semibold mb-1">📦 Delivery Workflow</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Sales order created → stock is NOT hit (only reserved)</li>
            <li>Search for the sales order below by sales number or customer name</li>
            <li>Click "Pick & Deliver" on the order to open the picking screen</li>
            <li>Scan or type each item's barcode → quantity auto-increments</li>
            <li>Click "Confirm Delivery" → stock is decremented and order marked delivered</li>
          </ol>
        </div>

        {/* If an order is selected, show the picking screen; otherwise show the search + list */}
        {deliverySelectedOrder ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Picking for {deliverySelectedOrder.salesNo}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Customer: {deliverySelectedOrder.customer?.name || '—'}
                    {deliverySelectedOrder.customer?.phone && ` • ${deliverySelectedOrder.customer.phone}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setDeliverySelectedOrder(null); setDeliveryPickedItems([]) }}>
                  <X className="w-4 h-4 mr-1" />Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Barcode scan input */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Scan Barcode or Type Item Code</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Scan/type barcode here..."
                    value={deliveryBarcodeInput}
                    onChange={e => setDeliveryBarcodeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleBarcodeScan() } }}
                    autoFocus
                    autoComplete="off"
                    className="text-base font-mono"
                  />
                  <Button type="button" onClick={handleBarcodeScan}>
                    <Barcode className="w-4 h-4 mr-1" />Add
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Scan a barcode to increment that item's delivery quantity. Each scan adds 1 unit.</p>
              </div>

              {/* Items to deliver */}
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">SL</th>
                      <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">Item</th>
                      <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide w-32">Barcode</th>
                      <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide w-20">Ordered</th>
                      <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide w-20">Delivered</th>
                      <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide w-20">Remaining</th>
                      <th className="px-2 py-2 text-right text-[11px] uppercase tracking-wide w-24">Deliver Now</th>
                      <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide w-16">UoM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryPickedItems.map((p: any, i) => {
                      const qty = parseInt(p.deliverQty) || 0
                      const isPicked = qty > 0
                      const isComplete = (p.alreadyDeliveredQty || 0) + qty >= p.orderedQty
                      const already = p.alreadyDeliveredQty || 0
                      const remaining = p.remainingQty || (p.orderedQty - already)
                      return (
                        <tr key={p.itemId} className={`border-t ${isComplete ? 'bg-green-50/50' : isPicked ? 'bg-blue-50/40' : already > 0 ? 'bg-amber-50/30' : ''}`}>
                          <td className="px-2 py-2 text-center text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-2 font-medium">{p.itemName}</td>
                          <td className="px-2 py-2 font-mono text-xs">{p.barcode || p.itemCode || '—'}</td>
                          <td className="px-2 py-2 text-right">{p.orderedQty}</td>
                          <td className="px-2 py-2 text-right text-blue-700">{already}</td>
                          <td className="px-2 py-2 text-right font-semibold">{remaining}</td>
                          <td className="px-2 py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              max={remaining}
                              value={p.deliverQty}
                              onChange={e => setDeliveryPickedItems(items => items.map((x: any) => x.itemId === p.itemId ? { ...x, deliverQty: e.target.value } : x))}
                              className={`h-8 text-right text-sm w-full min-w-[70px] ${isComplete ? 'border-green-500' : ''}`}
                              disabled={remaining <= 0}
                            />
                          </td>
                          <td className="px-2 py-2">{p.uom}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Previous deliveries history */}
              {deliverySelectedOrder.deliveries && deliverySelectedOrder.deliveries.length > 0 && (
                <div className="rounded-md border border-blue-200 bg-blue-50/30 p-3">
                  <p className="font-semibold text-sm text-blue-900 mb-2">
                    📦 Delivery History ({deliverySelectedOrder.deliveries.length} deliver{deliverySelectedOrder.deliveries.length === 1 ? 'y' : 'ies'} so far)
                  </p>
                  <div className="space-y-1.5">
                    {deliverySelectedOrder.deliveries.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between bg-white rounded border p-2 text-xs">
                        <div>
                          <span className="font-mono font-semibold">{d.deliveryNo}</span>
                          <span className="ml-2 text-muted-foreground">{bdDate(new Date(d.deliveryDate))}</span>
                          {d.deliveryPerson && <span className="ml-2">• {d.deliveryPerson}</span>}
                          <span className="ml-2">• {d.items?.length || 0} item(s)</span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const token = localStorage.getItem('auth_token') || ''
                              fetch(`/api/deliveries/${d.id}/challan`, { headers: { 'Authorization': `Bearer ${token}` } })
                                .then(r => r.text())
                                .then(html => {
                                  const w = window.open('', '_blank')
                                  if (!w) { toast({ title: 'Popup blocked', variant: 'destructive' }); return }
                                  w.document.write(html); w.document.close()
                                })
                            }}
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />Challan
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery person + notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Delivery Person</Label>
                  <Input value={deliveryPerson} onChange={e => setDeliveryPerson(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Delivery Notes</Label>
                  <Input value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} placeholder="Optional" />
                </div>
              </div>

              {/* Summary + submit */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {deliveryPickedItems.filter(p => parseInt(p.deliverQty) > 0).length} of {deliveryPickedItems.length} item(s) picked •
                  Total units: {deliveryPickedItems.reduce((s, p) => s + (parseInt(p.deliverQty) || 0), 0)}
                </div>
                <Button
                  onClick={handleSubmitDelivery}
                  disabled={delivering || deliveryPickedItems.filter(p => parseInt(p.deliverQty) > 0).length === 0}
                  size="lg"
                >
                  {delivering ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Delivering...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Confirm Delivery</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Sales order search */}
            <div className="flex gap-2">
              <Input
                placeholder="Search by Sales No, customer name, or phone..."
                value={deliverySalesSearch}
                onChange={e => setDeliverySalesSearch(e.target.value)}
                className="max-w-md"
              />
            </div>

            {/* Sales orders list */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Sales No</TableHead>
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold">Order Date</TableHead>
                  <TableHead className="font-semibold">Items</TableHead>
                  <TableHead className="font-semibold">Delivery Status</TableHead>
                  <TableHead className="font-semibold text-center">Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {matchingOrders.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{deliverySalesSearch ? 'No matching sales orders' : 'No pending sales orders to deliver'}</TableCell></TableRow>
                  : matchingOrders.map(s => (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{s.salesNo}</TableCell>
                      <TableCell className="font-medium">{s.customer?.name || '—'}</TableCell>
                      <TableCell className="text-xs">{s.customer?.phone || '—'}</TableCell>
                      <TableCell className="text-xs">{bdDate(new Date(s.orderDate))}</TableCell>
                      <TableCell className="text-xs">{s.items?.length || 0} item(s)</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${(s as any).deliveryStatus === 'delivered' ? 'bg-green-100 text-green-800' : (s as any).deliveryStatus === 'partial' ? 'bg-blue-100 text-blue-800' : (s as any).deliveryStatus === 'out_for_delivery' ? 'bg-purple-100 text-purple-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {((s as any).deliveryStatus || 'pending').replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" onClick={() => selectOrder(s)}>
                          <Truck className="w-4 h-4 mr-1" />Pick & Deliver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    )
  }

  // ★ Damage/Wastage Tracking page — uses ItemAdjustment with type 'decrease' and reason containing 'damage' or 'wastage'
  const renderDamagePage = () => {
    const damageRecords = adjustments.filter(a => a.adjustmentType === 'decrease' && (a.reason.toLowerCase().includes('damage') || a.reason.toLowerCase().includes('wastage') || a.reason.toLowerCase().includes('broken')))
    const totalLoss = damageRecords.reduce((s, a) => s + a.quantity, 0)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Damage/Wastage Tracking - {workingEntity?.name}</h2>
          <Button onClick={() => { setTxItemSearch(''); setTxItemResults([]); setCurrentView('itemAdjustment') }}><Plus className="w-4 h-4 mr-2" />Record Damage</Button>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900">
          <p className="font-semibold">⚠️ How to record damage:</p>
          <p>Go to Item Adjustment → New Adjustment → Select "Decrease" type → In Reason, include the word "damage", "wastage", or "broken" → it will automatically appear here.</p>
        </div>
        <div className="flex gap-3 items-center">
          <Badge variant="outline" className="bg-red-50 text-red-700">Total Items Lost: {totalLoss}</Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-700">Records: {damageRecords.length}</Badge>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Item</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold text-right">Qty Lost</TableHead>
              <TableHead className="font-semibold">Reason</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {damageRecords.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No damage records. Use Item Adjustment with "decrease" type and include "damage"/"wastage" in the reason.</TableCell></TableRow>
              : damageRecords.map(a => (
                <TableRow key={a.id} className="hover:bg-muted/30 bg-red-50/20">
                  <TableCell className="font-medium">{a.itemName}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs bg-red-100 text-red-800">Damage</Badge></TableCell>
                  <TableCell className="text-right font-bold text-red-600">{a.quantity}</TableCell>
                  <TableCell className="text-sm">{a.reason}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{bdDate(new Date(a.createdAt))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // ★ News Ticker management page — with settings
  const renderNewsTickerPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">News Ticker</h2>
          <p className="text-sm text-muted-foreground">Broadcast messages shown as scrolling text at the top of the app. Visible to all users.</p>
        </div>
        {isManagerOrAdmin && (
          <Button onClick={() => setShowTickerInput(!showTickerInput)}><Plus className="w-4 h-4 mr-2" />New Message</Button>
        )}
      </div>

      {/* Ticker Settings (Admin/Manager only) */}
      {isManagerOrAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Settings2 className="w-4 h-4" />Ticker Display Settings</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Scroll Speed (seconds)</Label>
                <Input type="number" min="5" max="120" value={tickerSettings.speed} onChange={e => setTickerSettings({ ...tickerSettings, speed: parseInt(e.target.value) || 30 })} className="h-9" />
                <p className="text-[10px] text-muted-foreground">Lower = faster</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Background Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={tickerSettings.bgColor} onChange={e => setTickerSettings({ ...tickerSettings, bgColor: e.target.value })} className="h-9 w-12 border rounded" />
                  <Input value={tickerSettings.bgColor} onChange={e => setTickerSettings({ ...tickerSettings, bgColor: e.target.value })} className="h-9 text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Text Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={tickerSettings.textColor} onChange={e => setTickerSettings({ ...tickerSettings, textColor: e.target.value })} className="h-9 w-12 border rounded" />
                  <Input value={tickerSettings.textColor} onChange={e => setTickerSettings({ ...tickerSettings, textColor: e.target.value })} className="h-9 text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Font Size</Label>
                <Select value={tickerSettings.fontSize} onValueChange={v => setTickerSettings({ ...tickerSettings, fontSize: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Live preview */}
            <div className="mt-4 rounded-md overflow-hidden" style={{ backgroundColor: tickerSettings.bgColor }}>
              <div className="py-2 px-4 font-semibold whitespace-nowrap" style={{ color: tickerSettings.textColor, fontSize: tickerSettings.fontSize === 'lg' ? '16px' : tickerSettings.fontSize === 'sm' ? '13px' : '14px' }}>
                📢 Live Preview: This is how your ticker will look
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New message input */}
      {showTickerInput && isManagerOrAdmin && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <Input placeholder="Type your broadcast message..." value={tickerInput} onChange={e => setTickerInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && postTickerMessage()} className="flex-1" />
              <Button onClick={postTickerMessage}><Save className="w-4 h-4 mr-2" />Post</Button>
              <Button variant="outline" onClick={() => { setShowTickerInput(false); setTickerInput('') }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages list */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Message</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            {isManagerOrAdmin && <TableHead className="font-semibold text-center">Actions</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {tickerMessages.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No ticker messages yet.</TableCell></TableRow>
            : tickerMessages.map((msg, i) => (
              <TableRow key={i} className="hover:bg-muted/30">
                <TableCell className="font-medium">📢 {msg}</TableCell>
                <TableCell className="text-xs text-muted-foreground">—</TableCell>
                {isManagerOrAdmin && (
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={async () => {
                      try {
                        const res = await authFetch(`/api/news-ticker`, { method: 'GET' })
                        if (res.ok) {
                          const d = await res.json()
                          const msgObj = d.messages?.find((m: any) => m.message === msg)
                          if (msgObj) {
                            await authFetch(`/api/news-ticker/${msgObj.id}`, { method: 'DELETE' })
                            fetchTickerMessages()
                            toast({ title: 'Deleted', description: 'Ticker message removed' })
                          }
                        }
                      } catch {}
                    }} title="Delete"><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            {reportRange === 'custom' && (
              <>
                <Input type="date" value={reportCustomFrom} onChange={e => setReportCustomFrom(e.target.value)} className="w-[150px]" placeholder="From" />
                <span className="text-xs text-muted-foreground">→</span>
                <Input type="date" value={reportCustomTo} onChange={e => setReportCustomTo(e.target.value)} className="w-[150px]" placeholder="To" />
                <Button variant="default" size="sm" onClick={() => fetchReports()} disabled={reportLoading}>Apply</Button>
              </>
            )}
            <Button variant="outline" size="icon" onClick={() => fetchReports()} title="Refresh"><RefreshCw className={`w-4 h-4 ${reportLoading ? 'animate-spin' : ''}`} /></Button>
            <Button variant="outline" size="sm" onClick={handleExportReports} disabled={reportExporting || !reportData} title="Download current tab as Excel" style={{ display: hasPermission('menu', 'reports', 'export') ? '' : 'none' }}>
              {reportExporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Excel
            </Button>
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
    const filteredEntities = entitySearch
      ? availableEntities.filter(e => e.name.toLowerCase().includes(entitySearch.toLowerCase()) || (e.description || '').toLowerCase().includes(entitySearch.toLowerCase()))
      : availableEntities
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
        <div className="w-full max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shrink-0"><Package className="w-7 h-7 text-primary-foreground" /></div>
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">Akash Inventory System</h1>
                <p className="text-muted-foreground">Choose the entity you want to work with</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Logged in as <span className="font-medium">{user.displayName}</span> ({user.role})</p>
              <Input
                placeholder="Search entity by name..."
                value={entitySearch}
                onChange={e => setEntitySearch(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
          {entitiesLoading ? (
            <Card>
              <CardContent className="text-center py-16">
                <div className="inline-flex items-center gap-3 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading entities...</span>
                </div>
              </CardContent>
            </Card>
          ) : filteredEntities.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-lg font-medium">{entitySearch ? 'No entities match your search' : 'No Entity Available'}</p>
                {entitySearch && <p className="text-muted-foreground">Try a different search term.</p>}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Entities ({filteredEntities.length}{entitySearch ? ` of ${availableEntities.length}` : ''})</h3>
                    <p className="text-[11px] text-muted-foreground">Click any row to enter</p>
                  </div>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {filteredEntities.map((entity, idx) => (
                    <button
                      key={entity.id}
                      onClick={() => { setWorkingEntity({ id: entity.id, name: entity.name }); setCurrentView('itemPrice') }}
                      className="w-full text-left px-4 py-4 flex items-center gap-4 hover:bg-primary/5 border-b last:border-0 transition-colors group"
                    >
                      <div className="w-11 h-11 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground font-mono w-8">#{String(idx + 1).padStart(2, '0')}</span>
                          <h3 className="font-semibold text-base truncate">{entity.name}</h3>
                          {(entity as any).entityType && (entity as any).entityType !== 'outlet' && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 capitalize">{(entity as any).entityType.replace('_', ' ')}</Badge>
                          )}
                        </div>
                        {entity.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{entity.description}</p>}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="mt-8 text-center">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />Sign Out
            </Button>
          </div>
        </div>
        <Dialog open={showEntityDialog} onOpenChange={setShowEntityDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />{editingEntityId ? 'Edit Entity' : 'Create New Entity'}</DialogTitle></DialogHeader>
            <form onSubmit={editingEntityId ? handleUpdateEntity : handleCreateEntity} className="space-y-4">
              <div className="space-y-2"><Label>Entity Name *</Label><Input placeholder="e.g. Dhaka Main Warehouse" value={entityForm.name} onChange={e => setEntityForm({ ...entityForm, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Description</Label><Input placeholder="Optional description" value={entityForm.description} onChange={e => setEntityForm({ ...entityForm, description: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select value={(entityForm as any).entityType || 'outlet'} onValueChange={v => setEntityForm({ ...entityForm, entityType: v } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outlet">Outlet (Shop/Branch)</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="head_office">Head Office</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Used by incentive formula: outlet → outletCommission, head_office/warehouse → headOfficeCommission</p>
              </div>
              <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingEntityId ? 'Update' : 'Create'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ★ Tailors master data page — with entity assignment
  const renderTailorsPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Tailors</h2>
          <p className="text-sm text-muted-foreground">Assign tailors to specific entities. When creating a sales order, only tailors assigned to the current working entity (or with no assignment = available to all) appear in the dropdown.</p>
        </div>
        <Button onClick={() => { setEditingTailorId(null); setTailorForm({ name: '', phone: '', address: '', specialization: '', status: 'active', entityIds: [] }); setShowTailorDialog(true) }}><Plus className="w-4 h-4 mr-2" />New Tailor</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Specialization</TableHead>
            <TableHead className="font-semibold">Phone</TableHead>
            <TableHead className="font-semibold">Assigned Entities</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {tailors.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No tailors yet.</TableCell></TableRow>
            : tailors.map(t => {
              const assignedIds = (t.entityIds || '').split(',').map(s => s.trim()).filter(Boolean)
              const assignedEntities = assignedIds.map(id => entities.find(e => e.id === id)?.name).filter(Boolean)
              return (
                <TableRow key={t.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm">{t.specialization || '—'}</TableCell>
                  <TableCell className="text-sm">{t.phone || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {assignedEntities.length === 0 ? <Badge variant="outline" className="text-xs bg-gray-100">All entities</Badge> :
                        assignedEntities.map(name => <Badge key={name} variant="outline" className="text-xs bg-blue-50 text-blue-700">{name}</Badge>)
                      }
                    </div>
                  </TableCell>
                  <TableCell>{t.status === 'active' ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingTailorId(t.id)
                        setTailorForm({
                          name: t.name, phone: t.phone, address: t.address,
                          specialization: t.specialization, status: t.status,
                          entityIds: (t.entityIds || '').split(',').map(s => s.trim()).filter(Boolean),
                        })
                        setShowTailorDialog(true)
                      }} title="Edit"><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTailor(t.id)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showTailorDialog} onOpenChange={setShowTailorDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingTailorId ? 'Edit Tailor' : 'New Tailor'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveTailor} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={tailorForm.name} onChange={e => setTailorForm({ ...tailorForm, name: e.target.value })} required /></div>
              <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={tailorForm.phone} onChange={e => setTailorForm({ ...tailorForm, phone: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Specialization</Label><Input placeholder="e.g. Shirt, Pant, Suit" value={tailorForm.specialization} onChange={e => setTailorForm({ ...tailorForm, specialization: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Status</Label><Select value={tailorForm.status} onValueChange={v => setTailorForm({ ...tailorForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={tailorForm.address} onChange={e => setTailorForm({ ...tailorForm, address: e.target.value })} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Assigned Entities</Label>
              <p className="text-[11px] text-muted-foreground">Tick entities this tailor works for. Leave empty = available to all entities.</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border rounded-md p-2">
                {entities.length === 0 ? <p className="text-xs text-muted-foreground">No entities created yet.</p> :
                  entities.map(e => (
                    <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5">
                      <Checkbox
                        checked={tailorForm.entityIds.includes(e.id)}
                        onCheckedChange={v => {
                          setTailorForm(f => ({
                            ...f,
                            entityIds: v ? [...f.entityIds, e.id] : f.entityIds.filter(id => id !== e.id),
                          }))
                        }}
                      />
                      <span>{e.name}</span>
                    </label>
                  ))
                }
              </div>
              {tailorForm.entityIds.length === 0 && <p className="text-[10px] text-amber-700">⚠ Will be available to ALL entities.</p>}
            </div>
            <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingTailorId ? 'Update' : 'Create'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  // ★ Customers master data page — shows entity column + date
  const renderCustomersPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Customer Database</h2>
          <p className="text-sm text-muted-foreground">Global customers — accessible from all entities. "Created At" shows which entity first created this customer.</p>
        </div>
        <Button onClick={() => { setEditingCustomerId(null); setCustomerForm({ name: '', phone: '', email: '', address: '', type: 'regular', status: 'active' }); setShowCustomerDialog(true) }}><Plus className="w-4 h-4 mr-2" />New Customer</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Phone</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Created At (Entity)</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {customers.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No customers yet.</TableCell></TableRow>
            : customers.map(c => (
              <TableRow key={c.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{c.name}{c.email ? <div className="text-[10px] text-muted-foreground">{c.email}</div> : null}</TableCell>
                <TableCell className="text-sm">{c.phone || '—'}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{c.type}</Badge></TableCell>
                <TableCell className="text-sm">{c.createdByEntity?.name || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</TableCell>
                <TableCell>{c.status === 'active' ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditingCustomerId(c.id)
                      setCustomerForm({ name: c.name, phone: c.phone, email: c.email, address: c.address, type: c.type, status: c.status })
                      setShowCustomerDialog(true)
                    }} title="Edit"><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCustomer(c.id)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingCustomerId ? 'Edit Customer' : 'New Customer'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveCustomer} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} required /></div>
              <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Type</Label><Select value={customerForm.type} onValueChange={v => setCustomerForm({ ...customerForm, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regular">Regular</SelectItem><SelectItem value="wholesale">Wholesale</SelectItem><SelectItem value="corporate">Corporate</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Status</Label><Select value={customerForm.status} onValueChange={v => setCustomerForm({ ...customerForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} /></div>
            <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingCustomerId ? 'Update' : 'Create'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  // ★ Employees master data page
  const renderEmployeesPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Employees</h2>
          <p className="text-sm text-muted-foreground">Track staff and their functional roles (Sales / Accounts / Inventory). Sales persons appear in the New Sales form dropdown.</p>
        </div>
        <Button onClick={openNewEmployeeDialog} className="gap-2"><Plus className="w-4 h-4" />New Employee</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Designation</TableHead>
            <TableHead className="font-semibold">Phone</TableHead>
            <TableHead className="font-semibold">Roles</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {employees.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No employees yet.</TableCell></TableRow>
            : employees.map(emp => {
              const roles = (emp.roles || '').split(',').filter(Boolean)
              return (
                <TableRow key={emp.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{emp.name}{emp.email ? <div className="text-[10px] text-muted-foreground">{emp.email}</div> : null}</TableCell>
                  <TableCell className="text-sm">{emp.designation || '—'}</TableCell>
                  <TableCell className="text-sm">{emp.phone || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {roles.length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                        roles.map(r => {
                          const color = r === 'sales' ? 'bg-green-100 text-green-800' : r === 'accounts' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          return <Badge key={r} variant="outline" className={`text-xs ${color}`}>{r}</Badge>
                        })
                      }
                    </div>
                  </TableCell>
                  <TableCell>{emp.status === 'active' ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditEmployeeDialog(emp)} title="Edit"><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteEmployee(emp.id)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingEmployeeId ? 'Edit Employee' : 'New Employee'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEmployee} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={employeeForm.name} onChange={e => setEmployeeForm({ ...employeeForm, name: e.target.value })} required /></div>
              <div className="space-y-1"><Label className="text-xs">Designation</Label><Input placeholder="e.g. Sales Executive" value={employeeForm.designation} onChange={e => setEmployeeForm({ ...employeeForm, designation: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={employeeForm.phone} onChange={e => setEmployeeForm({ ...employeeForm, phone: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={employeeForm.email} onChange={e => setEmployeeForm({ ...employeeForm, email: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={employeeForm.address} onChange={e => setEmployeeForm({ ...employeeForm, address: e.target.value })} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Functional Roles</Label>
              <p className="text-[11px] text-muted-foreground">Tick all that apply. Sales persons will appear in the New Sales form dropdown.</p>
              <div className="flex gap-2 flex-wrap pt-1">
                {[
                  { key: 'sales', label: 'Sales Person', color: 'bg-green-100 text-green-800 border-green-300' },
                  { key: 'accounts', label: 'Accounts', color: 'bg-blue-100 text-blue-800 border-blue-300' },
                  { key: 'inventory', label: 'Inventory', color: 'bg-purple-100 text-purple-800 border-purple-300' },
                ].map(r => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => toggleEmployeeRole(r.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${employeeForm.roles.includes(r.key) ? r.color : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}
                  >
                    {employeeForm.roles.includes(r.key) ? '✓ ' : ''}{r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Status</Label><Select value={employeeForm.status} onValueChange={v => setEmployeeForm({ ...employeeForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Notes</Label><Input value={employeeForm.notes} onChange={e => setEmployeeForm({ ...employeeForm, notes: e.target.value })} placeholder="Optional notes" /></div>
            <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingEmployeeId ? 'Update' : 'Create'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  // Groups page
  const renderGroupsPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Groups</h2>
          <p className="text-sm text-muted-foreground">Manage item groups (parent categories)</p>
        </div>
        <Button onClick={() => { setEditingGroupId(null); setGroupForm({ name: '', description: '', status: 'active' }); setShowGroupDialog(true) }} className="gap-2"><Plus className="w-4 h-4" />Add Group</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold text-center">Sub Groups</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {groups.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No groups found. Click "Add Group" to create one.</TableCell></TableRow>
            : groups.map(g => (
              <TableRow key={g.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell>{g.description || '—'}</TableCell>
                <TableCell className="text-center">{g._count?.subGroups || 0}</TableCell>
                <TableCell><Badge variant={g.status === 'active' ? 'default' : 'secondary'}>{g.status}</Badge></TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => { setEditingGroupId(g.id); setGroupForm({ name: g.name, description: g.description, status: g.status }); setShowGroupDialog(true) }} title="Edit"><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(g.id)} className="text-destructive hover:text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingGroupId ? 'Edit Group' : 'Add Group'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveGroup} className="space-y-4">
            <div className="space-y-2"><Label>Group Name *</Label><Input value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={groupForm.status} onValueChange={v => setGroupForm({ ...groupForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingGroupId ? 'Update' : 'Create'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  // SubGroups page
  const renderSubGroupsPage = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Sub Groups</h2>
          <p className="text-sm text-muted-foreground">Manage sub groups under parent groups</p>
        </div>
        <Button onClick={() => { setEditingSubGroupId(null); setSubGroupForm({ name: '', groupId: '', description: '', status: 'active' }); setShowSubGroupDialog(true) }} className="gap-2"><Plus className="w-4 h-4" />Add Sub Group</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Sub Group Name</TableHead>
            <TableHead className="font-semibold">Parent Group</TableHead>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {subGroups.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No sub groups found. Click "Add Sub Group" to create one.</TableCell></TableRow>
            : subGroups.map(sg => (
              <TableRow key={sg.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{sg.name}</TableCell>
                <TableCell>{sg.groupName || '—'}</TableCell>
                <TableCell>{sg.description || '—'}</TableCell>
                <TableCell><Badge variant={sg.status === 'active' ? 'default' : 'secondary'}>{sg.status}</Badge></TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => { setEditingSubGroupId(sg.id); setSubGroupForm({ name: sg.name, groupId: sg.groupId, description: sg.description, status: sg.status }); setShowSubGroupDialog(true) }} title="Edit"><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteSubGroup(sg.id)} className="text-destructive hover:text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={showSubGroupDialog} onOpenChange={setShowSubGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingSubGroupId ? 'Edit Sub Group' : 'Add Sub Group'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveSubGroup} className="space-y-4">
            <div className="space-y-2"><Label>Parent Group *</Label><Select value={subGroupForm.groupId} onValueChange={v => setSubGroupForm({ ...subGroupForm, groupId: v })} required><SelectTrigger><SelectValue placeholder="Select parent group" /></SelectTrigger><SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Sub Group Name *</Label><Input value={subGroupForm.name} onChange={e => setSubGroupForm({ ...subGroupForm, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={subGroupForm.description} onChange={e => setSubGroupForm({ ...subGroupForm, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={subGroupForm.status} onValueChange={v => setSubGroupForm({ ...subGroupForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            <DialogFooter><Button type="submit"><Save className="w-4 h-4 mr-2" />{editingSubGroupId ? 'Update' : 'Create'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

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
      case 'newAdjustment': return renderNewAdjustmentPage()
      case 'transfer': return renderTransferPage()
      case 'newTransfer': return renderNewTransferPage()
      case 'receive': return renderReceivePage()
      case 'newReceive': return renderNewReceivePage()
      case 'purchase': return renderPurchaseListPage()
      case 'newPurchase': return renderNewPurchasePage()
      case 'purchaseApproval': return renderPurchaseApprovalPage()
      case 'purchaseDetail': return renderPurchaseDetailPage()
      case 'salesOrder': return renderSalesOrderPage()
      case 'newSalesOrder': return renderNewSalesOrderPage()
      case 'salesReturn': return renderSalesReturnPage()
      case 'newSalesReturn': return renderNewSalesReturnPage()
      case 'tailorPayment': return renderTailorPaymentPage()
      case 'newTailorPayment': return renderNewTailorPaymentPage()
      case 'booking': return renderBookingPage()
      case 'newBooking': return renderNewBookingPage()
      case 'bookingReasons': return renderBookingReasonsPage()
      case 'incentive': return renderIncentivePage()
      case 'newFormula': return renderNewFormulaPage()
      case 'cogsPage': return renderCogsPage()
      case 'supplierPayments': return renderSupplierPaymentsPage()
      case 'newSupplierPayment': return renderNewSupplierPaymentPage()
      case 'delivery': return renderDeliveryPage()
      case 'damage': return renderDamagePage()
      case 'newsTicker': return renderNewsTickerPage()
      case 'reports': return renderReportsPage()
      case 'tailors': return renderTailorsPage()
      case 'makingInfo': return renderMasterDataPage<MakingInfoData>('Making Information', makingInfoList, ['name','description','cost','unit','status'], makingInfoForm, setMakingInfoForm, editingMakingInfoId, setEditingMakingInfoId, showMakingInfoDialog, setShowMakingInfoDialog, handleSaveMakingInfo, handleDeleteMakingInfo, { name:{label:'Process Name*',type:'text',placeholder:'e.g. Stitching, Cutting, Finishing'},description:{label:'Description',type:'text'},cost:{label:'Cost',type:'number'},unit:{label:'Unit',type:'select',options:['PCS','KG','LTR','MTR','SET']},status:{label:'Status',type:'select',options:['active','inactive']} })
      case 'uom': return renderMasterDataPage<UoMData>('Unit of Measure (UoM)', uomList, ['name','description'], uomForm, setUomForm, editingUomId, setEditingUomId, showUomDialog, setShowUomDialog, handleSaveUom, handleDeleteUom, { name:{label:'UoM Name*',type:'text',placeholder:'e.g. PCS, KG, LTR'},description:{label:'Description',type:'text'} })
      case 'suppliers': return renderMasterDataPage<SupplierData>('Suppliers', suppliers, ['name','phone','email','address','status'], supplierForm, setSupplierForm, editingSupplierId, setEditingSupplierId, showSupplierDialog, setShowSupplierDialog, handleSaveSupplier, handleDeleteSupplier, { name:{label:'Supplier Name*',type:'text'},phone:{label:'Phone',type:'text'},email:{label:'Email',type:'text'},address:{label:'Address',type:'text'},status:{label:'Status',type:'select',options:['active','inactive']} })
      case 'employees': return renderEmployeesPage()
      case 'customers': return renderCustomersPage()
      case 'groups': return renderGroupsPage()
      case 'subGroups': return renderSubGroupsPage()
      case 'users': return renderUserManagement()
      case 'userForm': return renderUserFormPage()
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
          <Button variant="outline" onClick={handleExportItems} disabled={exporting} title="Download as Excel file" style={{ display: hasPermission('master', 'items', 'export') ? '' : 'none' }}>
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
            <div className="space-y-2">
              <Label>Group</Label>
              <Select value={itemForm.group} onValueChange={v => setItemForm({ ...itemForm, group: v, subGroup: '' })}>
                <SelectTrigger><SelectValue placeholder="Select group (or type below)" /></SelectTrigger>
                <SelectContent>
                  {groups.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Or type a new group name" value={itemForm.group} onChange={e => setItemForm({ ...itemForm, group: e.target.value, subGroup: '' })} className="text-xs" />
            </div>
            <div className="space-y-2">
              <Label>Sub Group</Label>
              <Select value={itemForm.subGroup} onValueChange={v => setItemForm({ ...itemForm, subGroup: v })} disabled={!itemForm.group}>
                <SelectTrigger><SelectValue placeholder={itemForm.group ? "Select sub group (or type below)" : "Select a group first"} /></SelectTrigger>
                <SelectContent>
                  {subGroups.filter(sg => sg.groupName === itemForm.group || sg.groupId === groups.find(g => g.name === itemForm.group)?.id).map(sg => <SelectItem key={sg.id} value={sg.name}>{sg.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Or type a new sub group name" value={itemForm.subGroup} onChange={e => setItemForm({ ...itemForm, subGroup: e.target.value })} className="text-xs" disabled={!itemForm.group} />
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>Item Name *</Label><Input placeholder="e.g. Samsung Galaxy S23" value={itemForm.itemName} onChange={e => setItemForm({ ...itemForm, itemName: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Price</Label><Input type="number" step="0.01" placeholder="0.00" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} /></div>
            <div className="space-y-2"><Label>UoM</Label><Select value={itemForm.uom} onValueChange={v => setItemForm({ ...itemForm, uom: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{uomList.length > 0 ? uomList.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>) : ['PCS','KG','LTR','MTR','BOX','SET','DOZ','PACK'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Barcode</Label><Input placeholder="Optional" value={itemForm.barcode} onChange={e => setItemForm({ ...itemForm, barcode: e.target.value })} /></div>
            <div className="space-y-2"><Label>Color</Label><Input placeholder="Optional" value={itemForm.color} onChange={e => setItemForm({ ...itemForm, color: e.target.value })} /></div>
            <div className="space-y-2"><Label>Pattern</Label><Input placeholder="Optional" value={itemForm.pattern} onChange={e => setItemForm({ ...itemForm, pattern: e.target.value })} /></div>
            <div className="space-y-2"><Label>Supplier Code</Label><Input placeholder="Optional" value={itemForm.supplierCode} onChange={e => setItemForm({ ...itemForm, supplierCode: e.target.value })} /></div>
            <div className="space-y-2"><Label>Dimension</Label><Input placeholder="e.g. 100x50x20 cm" value={itemForm.dimension} onChange={e => setItemForm({ ...itemForm, dimension: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Description</Label><Input placeholder="Optional item description" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} /></div>
          <div className="flex gap-3 pt-4">
            <Button type="submit"><Save className="w-4 h-4 mr-2" />{isEdit ? 'Update Item' : 'Create Item'}</Button>
            <Button type="button" variant="outline" onClick={() => { setCurrentView('items'); setEditingItemId(null) }}><X className="w-4 h-4 mr-2" />Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )

  const renderUploadForm = () => (
    <div className="space-y-4">
      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="w-5 h-5" />Upload Items via CSV</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-6">
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">Drop your CSV file here or click to browse</p>
            <p className="text-sm text-muted-foreground mb-4">Columns: year, lcNo, group, subGroup, itemName, price, uom, barcode (optional), itemCode (optional)</p>
            <Input type="file" accept=".csv" onChange={e => { setUploadFile(e.target.files?.[0] || null); setUploadResult(null) }} className="max-w-sm mx-auto" />
            {uploadFile && <p className="mt-3 text-sm text-primary font-medium">Selected: {uploadFile.name}</p>}
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">CSV Format Example (with barcode):</p>
            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">{`year,lcNo,group,subGroup,itemName,price,uom,barcode,itemCode\n2024,LC-001,Electronics,Mobile,Samsung S23,75000,PCS,8801234567890,SM-S23\n2024,LC-002,Electronics,Laptop,Dell Inspiron,55000,PCS,8801234567891,DELL-INS-15`}</pre>
            <p className="text-[11px] text-muted-foreground mt-2">If a <strong>barcode</strong> column is present, duplicate barcodes (already in DB or earlier in the same file) will be detected and those rows skipped. The full list of duplicate barcodes appears in the upload result below.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button type="submit" disabled={!uploadFile || uploading}><Upload className="w-4 h-4 mr-2" />{uploading ? 'Uploading...' : 'Upload CSV'}</Button>
            <Button type="button" variant="outline" onClick={downloadItemsTemplate}><Download className="w-4 h-4 mr-2" />Download Format</Button>
            <Button type="button" variant="ghost" onClick={() => { setCurrentView('items'); setUploadFile(null); setUploadResult(null) }}><X className="w-4 h-4 mr-2" />Cancel</Button>
          </div>

          {/* ★ Upload result with duplicate barcode details */}
          {uploadResult && (
            <div className={`rounded-lg border p-4 text-sm ${uploadResult.error ? 'bg-red-50 border-red-200 text-red-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
              {uploadResult.error ? (
                <>
                  <p className="font-semibold mb-1">Upload failed</p>
                  <p className="text-xs">{uploadResult.error}</p>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold">Upload complete</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><span className="opacity-70">Total rows:</span> <strong>{uploadResult.total}</strong></div>
                    <div><span className="opacity-70">Inserted:</span> <strong className="text-green-700">{uploadResult.inserted}</strong></div>
                    <div><span className="opacity-70">Duplicates:</span> <strong className="text-amber-700">{uploadResult.duplicate}</strong></div>
                    <div><span className="opacity-70">Skipped:</span> <strong className="text-red-700">{uploadResult.skipped}</strong></div>
                  </div>

                  {uploadResult.duplicateBarcodes && uploadResult.duplicateBarcodes.length > 0 && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="font-semibold text-amber-900 mb-1">⚠ Duplicate Barcodes Detected ({uploadResult.duplicateBarcodes.length})</p>
                      <p className="text-xs text-amber-800 mb-2">These rows were skipped because the barcode already exists in the database or earlier in the same file:</p>
                      <ul className="list-disc list-inside text-xs text-amber-900 space-y-0.5 max-h-40 overflow-y-auto">
                        {uploadResult.duplicateBarcodes.map((msg: string, i: number) => <li key={i}>{msg}</li>)}
                      </ul>
                    </div>
                  )}

                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium">All warnings ({uploadResult.errors.length}) — click to expand</summary>
                      <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                        {uploadResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>💡 Tip:</strong> Click "Download Format" to get a CSV template. Empty cells will be automatically filled with "N/A". Required columns: <code>year</code> and <code>itemName</code>. Optional: <code>barcode</code>, <code>itemCode</code> (duplicates are auto-detected).
          </div>
        </form>
      </CardContent>
    </Card>
    {renderBarcodeUpdatePanel()}
    </div>
  )

  // ★ "Update Barcodes" panel — retroactively add barcode/itemCode to existing items.
  // Useful when items were uploaded without the barcode/itemCode columns and the
  // user later wants to add those identifiers (e.g. for stock upload via barcode).
  const renderBarcodeUpdatePanel = () => (
    <Card className="max-w-2xl mt-6 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Barcode className="w-5 h-5" />Update Barcodes / Item Codes on Existing Items
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Use this if your items already exist in the master table but were uploaded without barcode / itemCode columns.
          Upload a CSV with <code>itemName</code> (required — must match the existing item's name) and one or both of
          <code>barcode</code> / <code>itemCode</code>. The system will update the matching items in place.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleBarcodeUpdate} className="space-y-4">
          <Input type="file" accept=".csv" onChange={e => { setBarcodeUpdateFile(e.target.files?.[0] || null); setBarcodeUpdateResult(null) }} />
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm font-medium mb-1">CSV Format:</p>
            <pre className="text-xs bg-background p-2 rounded border">{`itemName,barcode,itemCode
AJ-435-40-A,2606190000001,SM-S23
AJ-435-39-E,2606190000002,SM-S22`}</pre>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button type="submit" disabled={!barcodeUpdateFile || barcodeUpdating}>
              <RefreshCw className={`w-4 h-4 mr-2 ${barcodeUpdating ? 'animate-spin' : ''}`} />
              {barcodeUpdating ? 'Updating...' : 'Update Barcodes'}
            </Button>
            <Button type="button" variant="outline" onClick={downloadBarcodeUpdateTemplate}>
              <Download className="w-4 h-4 mr-2" />Download Format
            </Button>
          </div>
          {barcodeUpdateResult && (
            <div className={`rounded-lg border p-3 text-sm ${barcodeUpdateResult.error ? 'bg-red-50 border-red-200 text-red-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
              {barcodeUpdateResult.error ? (
                <p>{barcodeUpdateResult.error}</p>
              ) : (
                <div className="space-y-1.5">
                  <p className="font-semibold">Update complete</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="opacity-70">Total rows:</span> <strong>{barcodeUpdateResult.total}</strong></div>
                    <div><span className="opacity-70">Updated:</span> <strong className="text-green-700">{barcodeUpdateResult.updated}</strong></div>
                    <div><span className="opacity-70">Not found:</span> <strong className="text-amber-700">{barcodeUpdateResult.notFound}</strong></div>
                  </div>
                  {barcodeUpdateResult.notFoundList && barcodeUpdateResult.notFoundList.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium">Items not found ({barcodeUpdateResult.notFoundList.length}) — click to expand</summary>
                      <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                        {barcodeUpdateResult.notFoundList.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </details>
                  )}
                  {barcodeUpdateResult.errors && barcodeUpdateResult.errors.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-medium">All warnings ({barcodeUpdateResult.errors.length})</summary>
                      <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                        {barcodeUpdateResult.errors.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
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
      <p className="text-sm text-muted-foreground">Entities represent warehouses, stores, branches or any location where stock is maintained. Set the correct entity type — it determines which incentive commission rate applies (outlet vs head office).</p>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Description</TableHead>
              <TableHead className="font-semibold text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entities.map(entity => (
              <TableRow key={entity.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{entity.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs capitalize ${(entity as any).entityType === 'head_office' ? 'bg-purple-50 text-purple-700' : (entity as any).entityType === 'warehouse' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                    {((entity as any).entityType || 'outlet').replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{entity.description || '-'}</TableCell>
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
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={entityForm.entityType || 'outlet'} onValueChange={v => setEntityForm({ ...entityForm, entityType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outlet">Outlet (Shop/Branch)</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="head_office">Head Office</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Outlet → uses outletCommission from incentive formulas. Head Office & Warehouse → uses headOfficeCommission.</p>
            </div>
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
        <p className="text-sm text-muted-foreground">Bulk upload stock quantities for items at a specific entity using a CSV file.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleStockUpload} className="space-y-6">
          {/* ★ Entity selector — required by the API. Defaults to current working entity. */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Entity *</Label>
            <Select
              value={stockUploadEntityId || workingEntity?.id || ''}
              onValueChange={v => setStockUploadEntityId(v)}
            >
              <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
              <SelectContent>
                {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              All stock rows in the CSV must have <strong>entityName</strong> matching this selected entity (case-insensitive).
              Rows with a different entity name will be skipped.
            </p>
          </div>

          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">Drop your CSV file here or click to browse</p>
            <p className="text-sm text-muted-foreground mb-4">Upload stock data for multiple items at once</p>
            <Input type="file" accept=".csv" onChange={e => { setStockUploadFile(e.target.files?.[0] || null); setStockUploadResult(null) }} className="max-w-sm mx-auto" />
            {stockUploadFile && <p className="mt-3 text-sm text-primary font-medium">Selected: {stockUploadFile.name}</p>}
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">CSV Format Requirements:</p>
            <p className="text-xs text-muted-foreground">
              The CSV must have a <strong>quantity</strong> column, an <strong>entityName</strong> column (must match the selected entity above), and at least one of <strong>barcode</strong> / <strong>itemCode</strong> / <strong>itemName</strong> to identify each item. <strong>uom</strong> is optional.
            </p>
            <p className="text-sm font-medium mt-2">Recommended format (barcode-based):</p>
            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">{`barcode,entityName,quantity
8801234567890,Head Office,150
8801234567891,Head Office,75`}</pre>
            <p className="text-sm font-medium mt-2">Or with itemName:</p>
            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">{`itemName,entityName,quantity,uom
Cotton Shirt,Head Office,150,PCS
Wool Pant,Head Office,75,PCS`}</pre>
            <p className="text-xs text-muted-foreground mt-2">Supported headers: barcode/bar_code/bc, itemCode/item_code/ic, itemName/item_name/item, entityName/entity_name/entity/warehouse/store, quantity/qty/stock, uom/unit</p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button type="submit" disabled={!stockUploadFile || stockUploading || !stockUploadEntityId}>
              <Upload className="w-4 h-4 mr-2" />{stockUploading ? 'Uploading...' : 'Upload Stock CSV'}
            </Button>
            <Button type="button" variant="outline" onClick={downloadStockTemplate}>
              <Download className="w-4 h-4 mr-2" />Download Format
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setCurrentView('items'); setStockUploadFile(null); setStockUploadResult(null) }}>
              <X className="w-4 h-4 mr-2" />Cancel
            </Button>
          </div>

          {/* ★ Live upload result — shows full feedback instead of silently failing */}
          {stockUploadResult && (
            <div className={`rounded-lg border p-4 text-sm ${stockUploadResult.error ? 'bg-red-50 border-red-200 text-red-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
              {stockUploadResult.error ? (
                <>
                  <p className="font-semibold mb-1">Upload failed</p>
                  <p className="text-xs">{stockUploadResult.error}</p>
                </>
              ) : (
                <div className="space-y-1.5">
                  <p className="font-semibold">Upload complete for "{stockUploadResult.selectedEntity || 'entity'}"</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><span className="opacity-70">Total rows:</span> <strong>{stockUploadResult.total}</strong></div>
                    <div><span className="opacity-70">Upserted:</span> <strong className="text-green-700">{stockUploadResult.upserted}</strong></div>
                    <div><span className="opacity-70">Skipped:</span> <strong className="text-amber-700">{stockUploadResult.skipped}</strong></div>
                    <div><span className="opacity-70">Wrong entity:</span> <strong className="text-red-700">{stockUploadResult.wrongEntity || 0}</strong></div>
                  </div>

                  {/* ★ Special panel: "items not found" guidance — surfaces when every row was skipped */}
                  {stockUploadResult.upserted === 0 && stockUploadResult.skipped > 0 && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-md">
                      <p className="font-semibold text-amber-900 mb-1">⚠ No items were uploaded</p>
                      <p className="text-xs text-amber-800">
                        All rows were skipped because the items in your CSV are not in the Item Information master table yet.
                        Stock upload only updates quantities for items that <strong>already exist</strong>.
                      </p>
                      <p className="text-xs text-amber-800 mt-1">
                        <strong>How to fix:</strong> First upload the items via <strong>Master Data → Upload CSV</strong>
                        (use the <code>barcode</code> and <code>itemCode</code> columns), then come back here to upload their stock.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 text-xs"
                        onClick={() => { setUploadResult(null); setCurrentView('upload') }}
                      >
                        Go to Items Upload →
                      </Button>
                    </div>
                  )}

                  {stockUploadResult.errors && stockUploadResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium">First {stockUploadResult.errors.length} warning(s) — click to expand</summary>
                      <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                        {stockUploadResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>💡 Tip:</strong> Pick the entity first, then click "Download Format" to get a CSV template. The template will be pre-filled with the selected entity name. Empty cells will be automatically filled with "N/A". Required columns: <code>barcode</code> (or <code>itemName</code>), <code>entityName</code>, and <code>quantity</code>.
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
              <TableHead className="font-semibold">Assigned Entities</TableHead>
              <TableHead className="font-semibold">Menu Access</TableHead>
              <TableHead className="font-semibold">Permissions Summary</TableHead>
              <TableHead className="font-semibold text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => {
              const permSummary = (() => {
                if (u.role === 'admin' || u.role === 'manager') return { create: '∞', edit: '∞', delete: '∞', upload: '∞', export: '∞' }
                const menus = u.menuAccess || []
                const master = u.masterDataAccess || []
                const all = [...menus, ...master]
                return {
                  create: all.filter(m => (m as any).canCreate).length,
                  edit: all.filter(m => (m as any).canEdit).length,
                  delete: all.filter(m => (m as any).canDelete).length,
                  upload: all.filter(m => (m as any).canUpload).length,
                  export: all.filter(m => (m as any).canExport).length,
                }
              })()
              return (
              <TableRow key={u.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell>{u.displayName}</TableCell>
                <TableCell><Badge variant={u.role === 'admin' ? 'default' : u.role === 'manager' ? 'secondary' : 'outline'} className={u.role === 'manager' ? 'bg-blue-100 text-blue-800' : ''}>{u.role}</Badge></TableCell>
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
                <TableCell>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    <Badge variant="outline" className="bg-green-50 text-green-700">C: {permSummary.create}</Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">E: {permSummary.edit}</Badge>
                    <Badge variant="outline" className="bg-red-50 text-red-700">D: {permSummary.delete}</Badge>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700">U: {permSummary.upload}</Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700">X: {permSummary.export}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditUserDialog(u)} title="Edit"><Edit className="w-4 h-4" /></Button>
                    {isAdmin && <Button variant="ghost" size="sm" onClick={() => handleAdminPasswordChange(u.id, u.username)} title="Reset Password"><Key className="w-4 h-4" /></Button>}
                    {u.username !== 'admin' && <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5" />{editingUserId ? 'Edit User' : 'Create New User'}</DialogTitle></DialogHeader>
          <form onSubmit={editingUserId ? handleUpdateUser : handleCreateUser} className="space-y-4">
            <div className="space-y-2"><Label>Username *</Label><Input value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} required disabled={!!editingUserId} /></div>
            <div className="space-y-2"><Label>{editingUserId ? 'New Password (leave blank to keep)' : 'Password *'}</Label><Input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required={!editingUserId} /></div>
            <div className="space-y-2"><Label>Display Name *</Label><Input value={userForm.displayName} onChange={e => setUserForm({ ...userForm, displayName: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Role</Label><Select value={userForm.role} onValueChange={v => setUserForm({ ...userForm, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
            <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900">
              <p className="font-semibold mb-0.5">ℹ️ Per-action permissions</p>
              <p>Per-menu Create / Edit / Delete / Upload / Export toggles are below (scroll down). Admin &amp; Manager always have all permissions. The legacy global "Can Create Items" / "Can Modify" toggles have been replaced by these per-menu granular toggles.</p>
            </div>
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
                <Label className="text-sm font-semibold">Menu Access &amp; Permissions</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false })))}>Reset</Button>
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true, canCreate: true, canEdit: true, canDelete: true, canUpload: true, canExport: true, canApprove: true })))}>All On</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Tick "Visible" to grant access. Then tick the per-action permissions (Create / Edit / Delete / Upload / Export) you want this user to have on that menu. Admin &amp; Manager always have every permission.</p>
              {(() => {
                const groups = [...new Set(ALL_MENU_ITEMS.map(m => m.group))]
                return groups.map(group => (
                  <div key={group} className="border rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{group}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left px-2 py-1 font-medium text-muted-foreground">Menu</th>
                            <th className="px-2 py-1 font-medium text-muted-foreground text-center">Visible</th>
                            <th className="px-2 py-1 font-medium text-muted-foreground text-center">Create</th>
                            <th className="px-2 py-1 font-medium text-muted-foreground text-center">Edit</th>
                            <th className="px-2 py-1 font-medium text-muted-foreground text-center">Delete</th>
                            <th className="px-2 py-1 font-medium text-muted-foreground text-center">Upload</th>
                            <th className="px-2 py-1 font-medium text-muted-foreground text-center">Export</th>
                            <th className="px-2 py-1 font-medium text-muted-foreground text-center">Approve</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ALL_MENU_ITEMS.filter(m => m.group === group).map(menu => {
                            const idx = userMenuAccess.findIndex(ma => ma.menuKey === menu.key)
                            const entry = idx >= 0 ? userMenuAccess[idx] : { menuKey: menu.key, visible: true }
                            const setField = (field: 'visible' | 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload' | 'canExport' | 'canApprove', value: boolean) => {
                              const updated = [...userMenuAccess]
                              if (idx >= 0) {
                                updated[idx] = { ...updated[idx], [field]: value }
                              } else {
                                updated.push({ menuKey: menu.key, visible: true, [field]: value } as MenuAccess)
                              }
                              setUserMenuAccess(updated)
                            }
                            const isChecked = (field: 'visible' | 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload' | 'canExport' | 'canApprove') => !!(entry as any)[field]
                            return (
                              <tr key={menu.key} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="px-2 py-1.5 font-medium">{menu.label}</td>
                                <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('visible')} onCheckedChange={v => setField('visible', !!v)} /></td>
                                <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canCreate')} onCheckedChange={v => setField('canCreate', !!v)} disabled={!isChecked('visible')} /></td>
                                <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canEdit')} onCheckedChange={v => setField('canEdit', !!v)} disabled={!isChecked('visible')} /></td>
                                <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canDelete')} onCheckedChange={v => setField('canDelete', !!v)} disabled={!isChecked('visible')} /></td>
                                <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canUpload')} onCheckedChange={v => setField('canUpload', !!v)} disabled={!isChecked('visible')} /></td>
                                <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canExport')} onCheckedChange={v => setField('canExport', !!v)} disabled={!isChecked('visible')} /></td>
                                <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canApprove')} onCheckedChange={v => setField('canApprove', !!v)} disabled={!isChecked('visible')} /></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              })()}
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Master Data Access &amp; Permissions</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false })))}>Reset</Button>
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true, canCreate: true, canEdit: true, canDelete: true, canUpload: true, canExport: true, canApprove: true })))}>All On</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Same per-action permissions as menus. Admin &amp; Manager always see all. Entity &amp; Users are admin-only regardless.</p>
              <div className="border rounded-lg p-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-2 py-1 font-medium text-muted-foreground">Master Data</th>
                      <th className="px-2 py-1 font-medium text-muted-foreground text-center">Visible</th>
                      <th className="px-2 py-1 font-medium text-muted-foreground text-center">Create</th>
                      <th className="px-2 py-1 font-medium text-muted-foreground text-center">Edit</th>
                      <th className="px-2 py-1 font-medium text-muted-foreground text-center">Delete</th>
                      <th className="px-2 py-1 font-medium text-muted-foreground text-center">Upload</th>
                      <th className="px-2 py-1 font-medium text-muted-foreground text-center">Export</th>
                            <th className="px-2 py-1 font-medium text-muted-foreground text-center">Approve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_MASTER_DATA_ITEMS.map(item => {
                      const idx = userMasterDataAccess.findIndex(mda => mda.masterDataKey === item.key)
                      const entry = idx >= 0 ? userMasterDataAccess[idx] : { masterDataKey: item.key, visible: true }
                      const setField = (field: 'visible' | 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload' | 'canExport' | 'canApprove', value: boolean) => {
                        const updated = [...userMasterDataAccess]
                        if (idx >= 0) {
                          updated[idx] = { ...updated[idx], [field]: value }
                        } else {
                          updated.push({ masterDataKey: item.key, visible: true, [field]: value } as MasterDataAccess)
                        }
                        setUserMasterDataAccess(updated)
                      }
                      const isChecked = (field: 'visible' | 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload' | 'canExport' | 'canApprove') => !!(entry as any)[field]
                      return (
                        <tr key={item.key} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-2 py-1.5 font-medium">{item.label}</td>
                          <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('visible')} onCheckedChange={v => setField('visible', !!v)} /></td>
                          <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canCreate')} onCheckedChange={v => setField('canCreate', !!v)} disabled={!isChecked('visible')} /></td>
                          <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canEdit')} onCheckedChange={v => setField('canEdit', !!v)} disabled={!isChecked('visible')} /></td>
                          <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canDelete')} onCheckedChange={v => setField('canDelete', !!v)} disabled={!isChecked('visible')} /></td>
                          <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canUpload')} onCheckedChange={v => setField('canUpload', !!v)} disabled={!isChecked('visible')} /></td>
                          <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canExport')} onCheckedChange={v => setField('canExport', !!v)} disabled={!isChecked('visible')} /></td>
                                <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canApprove')} onCheckedChange={v => setField('canApprove', !!v)} disabled={!isChecked('visible')} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
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

      {/* Password Change Dialog */}
      <Dialog open={showPasswordChangeDialog} onOpenChange={setShowPasswordChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5" />Change Password</DialogTitle></DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Current Password *</Label><Input type="password" value={passwordChangeForm.currentPassword} onChange={e => setPasswordChangeForm({ ...passwordChangeForm, currentPassword: e.target.value })} required /></div>
            <div className="space-y-1"><Label className="text-xs">New Password *</Label><Input type="password" value={passwordChangeForm.newPassword} onChange={e => setPasswordChangeForm({ ...passwordChangeForm, newPassword: e.target.value })} required minLength={4} /></div>
            <div className="space-y-1"><Label className="text-xs">Confirm New Password *</Label><Input type="password" value={passwordChangeForm.confirmPassword} onChange={e => setPasswordChangeForm({ ...passwordChangeForm, confirmPassword: e.target.value })} required minLength={4} /></div>
            {passwordChangeForm.newPassword && passwordChangeForm.confirmPassword && passwordChangeForm.newPassword !== passwordChangeForm.confirmPassword && <p className="text-xs text-red-600">Passwords do not match</p>}
            <DialogFooter><Button type="submit" disabled={passwordChanging}><Save className="w-4 h-4 mr-2" />{passwordChanging ? 'Changing...' : 'Change Password'}</Button></DialogFooter>
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

  // ─── User Form Page (full-page, no popup) ────────────────────────────
  // Renders the same form as the dialog but as a standalone page so users can
  // navigate back/forward with the browser, scroll comfortably, etc.
  const renderUserFormPage = () => (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setEditingUserId(null); setShowUserDialog(false); setCurrentView('users') }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="w-5 h-5" />
            {editingUserId ? 'Edit User' : 'Create New User'}
          </h2>
        </div>
      </div>

      <form onSubmit={editingUserId ? handleUpdateUser : handleCreateUser} className="space-y-4 bg-white rounded-lg border shadow-sm p-6">
        {/* Basic info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Username *</Label>
            <Input value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} required disabled={!!editingUserId} />
          </div>
          <div className="space-y-2">
            <Label>{editingUserId ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
            <Input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required={!editingUserId} />
          </div>
          <div className="space-y-2">
            <Label>Display Name *</Label>
            <Input value={userForm.displayName} onChange={e => setUserForm({ ...userForm, displayName: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={userForm.role} onValueChange={v => setUserForm({ ...userForm, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900">
          <p className="font-semibold mb-0.5">ℹ️ Per-action permissions</p>
          <p>Per-menu Create / Edit / Delete / Upload / Export toggles are below. Admin &amp; Manager always have all permissions. The legacy global "Can Create Items" / "Can Modify" toggles have been replaced by these per-menu granular toggles.</p>
        </div>

        <Separator />

        {/* Assign entities */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Assign Entities</Label>
          <p className="text-xs text-muted-foreground">Select which entities this user can access.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto border rounded-lg p-3">
            {entities.length === 0 ? <p className="text-sm text-muted-foreground col-span-full">No entities created yet. Create entities first.</p> :
              entities.map(entity => (
                <div key={entity.id} className="flex items-center gap-2">
                  <Checkbox id={`page-entity-${entity.id}`} checked={userEntityIds.includes(entity.id)} onCheckedChange={checked => {
                    if (checked) setUserEntityIds([...userEntityIds, entity.id])
                    else setUserEntityIds(userEntityIds.filter(id => id !== entity.id))
                  }} />
                  <Label htmlFor={`page-entity-${entity.id}`} className="text-sm cursor-pointer">{entity.name}</Label>
                </div>
              ))
            }
          </div>
        </div>

        <Separator />

        {/* Menu access */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-semibold">Menu Access &amp; Permissions</Label>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false })))}>Reset</Button>
              <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMenuAccess(ALL_MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true, canCreate: true, canEdit: true, canDelete: true, canUpload: true, canExport: true, canApprove: true })))}>All On</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Tick "Visible" to grant access. Then tick the per-action permissions (Create / Edit / Delete / Upload / Export) you want this user to have on that menu. Admin &amp; Manager always have every permission.</p>
          {(() => {
            const groups = [...new Set(ALL_MENU_ITEMS.map(m => m.group))]
            return groups.map(group => (
              <div key={group} className="border rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">{group}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-2 py-1 font-medium text-muted-foreground">Menu</th>
                        <th className="px-2 py-1 font-medium text-muted-foreground text-center">Visible</th>
                        <th className="px-2 py-1 font-medium text-muted-foreground text-center">Create</th>
                        <th className="px-2 py-1 font-medium text-muted-foreground text-center">Edit</th>
                        <th className="px-2 py-1 font-medium text-muted-foreground text-center">Delete</th>
                        <th className="px-2 py-1 font-medium text-muted-foreground text-center">Upload</th>
                        <th className="px-2 py-1 font-medium text-muted-foreground text-center">Export</th>
                            <th className="px-2 py-1 font-medium text-muted-foreground text-center">Approve</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_MENU_ITEMS.filter(m => m.group === group).map(menu => {
                        const idx = userMenuAccess.findIndex(ma => ma.menuKey === menu.key)
                        const entry = idx >= 0 ? userMenuAccess[idx] : { menuKey: menu.key, visible: true }
                        const setField = (field: 'visible' | 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload' | 'canExport' | 'canApprove', value: boolean) => {
                          const updated = [...userMenuAccess]
                          if (idx >= 0) {
                            updated[idx] = { ...updated[idx], [field]: value }
                          } else {
                            updated.push({ menuKey: menu.key, visible: true, [field]: value } as MenuAccess)
                          }
                          setUserMenuAccess(updated)
                        }
                        const isChecked = (field: 'visible' | 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload' | 'canExport' | 'canApprove') => !!(entry as any)[field]
                        return (
                          <tr key={menu.key} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-2 py-1.5 font-medium">{menu.label}</td>
                            <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('visible')} onCheckedChange={v => setField('visible', !!v)} /></td>
                            <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canCreate')} onCheckedChange={v => setField('canCreate', !!v)} disabled={!isChecked('visible')} /></td>
                            <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canEdit')} onCheckedChange={v => setField('canEdit', !!v)} disabled={!isChecked('visible')} /></td>
                            <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canDelete')} onCheckedChange={v => setField('canDelete', !!v)} disabled={!isChecked('visible')} /></td>
                            <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canUpload')} onCheckedChange={v => setField('canUpload', !!v)} disabled={!isChecked('visible')} /></td>
                            <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canExport')} onCheckedChange={v => setField('canExport', !!v)} disabled={!isChecked('visible')} /></td>
                                <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canApprove')} onCheckedChange={v => setField('canApprove', !!v)} disabled={!isChecked('visible')} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          })()}
        </div>

        <Separator />

        {/* Master data access */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-semibold">Master Data Access &amp; Permissions</Label>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, canApprove: false })))}>Reset</Button>
              <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUserMasterDataAccess(ALL_MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true, canCreate: true, canEdit: true, canDelete: true, canUpload: true, canExport: true, canApprove: true })))}>All On</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Same per-action permissions as menus. Admin &amp; Manager always see all. Entity &amp; Users are admin-only regardless.</p>
          <div className="border rounded-lg p-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-2 py-1 font-medium text-muted-foreground">Master Data</th>
                  <th className="px-2 py-1 font-medium text-muted-foreground text-center">Visible</th>
                  <th className="px-2 py-1 font-medium text-muted-foreground text-center">Create</th>
                  <th className="px-2 py-1 font-medium text-muted-foreground text-center">Edit</th>
                  <th className="px-2 py-1 font-medium text-muted-foreground text-center">Delete</th>
                  <th className="px-2 py-1 font-medium text-muted-foreground text-center">Upload</th>
                  <th className="px-2 py-1 font-medium text-muted-foreground text-center">Export</th>
                            <th className="px-2 py-1 font-medium text-muted-foreground text-center">Approve</th>
                </tr>
              </thead>
              <tbody>
                {ALL_MASTER_DATA_ITEMS.map(item => {
                  const idx = userMasterDataAccess.findIndex(mda => mda.masterDataKey === item.key)
                  const entry = idx >= 0 ? userMasterDataAccess[idx] : { masterDataKey: item.key, visible: true }
                  const setField = (field: 'visible' | 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload' | 'canExport' | 'canApprove', value: boolean) => {
                    const updated = [...userMasterDataAccess]
                    if (idx >= 0) {
                      updated[idx] = { ...updated[idx], [field]: value }
                    } else {
                      updated.push({ masterDataKey: item.key, visible: true, [field]: value } as MasterDataAccess)
                    }
                    setUserMasterDataAccess(updated)
                  }
                  const isChecked = (field: 'visible' | 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload' | 'canExport' | 'canApprove') => !!(entry as any)[field]
                  return (
                    <tr key={item.key} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-2 py-1.5 font-medium">{item.label}</td>
                      <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('visible')} onCheckedChange={v => setField('visible', !!v)} /></td>
                      <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canCreate')} onCheckedChange={v => setField('canCreate', !!v)} disabled={!isChecked('visible')} /></td>
                      <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canEdit')} onCheckedChange={v => setField('canEdit', !!v)} disabled={!isChecked('visible')} /></td>
                      <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canDelete')} onCheckedChange={v => setField('canDelete', !!v)} disabled={!isChecked('visible')} /></td>
                      <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canUpload')} onCheckedChange={v => setField('canUpload', !!v)} disabled={!isChecked('visible')} /></td>
                      <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canExport')} onCheckedChange={v => setField('canExport', !!v)} disabled={!isChecked('visible')} /></td>
                                <td className="px-2 py-1.5 text-center"><Checkbox checked={isChecked('canApprove')} onCheckedChange={v => setField('canApprove', !!v)} disabled={!isChecked('visible')} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Separator />

        {/* Column access */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Column Access</Label>
          <p className="text-xs text-muted-foreground">Define which columns this user can view in the Item Information table.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 border rounded-lg p-3">
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

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => { setEditingUserId(null); setShowUserDialog(false); setCurrentView('users') }}>
            Cancel
          </Button>
          <Button type="submit">
            <Save className="w-4 h-4 mr-2" />
            {editingUserId ? 'Update User' : 'Create User'}
          </Button>
        </div>
      </form>
    </div>
  )

  // Entity selection check
  if (!workingEntity) {
    return renderEntitySelection()
  }

  return (
    <>
    <div className="min-h-screen flex flex-col bg-background">
      {/* ★ News Ticker — scrolling text at top, right-to-left */}
      {tickerMessages.length > 0 && (
        <div className="py-2 overflow-hidden relative shrink-0" style={{ backgroundColor: tickerSettings.bgColor, color: tickerSettings.textColor }}>
          <div className="ticker-track whitespace-nowrap font-semibold" style={{ animationDuration: `${tickerSettings.speed}s`, fontSize: tickerSettings.fontSize === 'lg' ? '16px' : tickerSettings.fontSize === 'sm' ? '13px' : '14px' }}>
            {tickerMessages.map((msg, i) => (
              <span key={i} className="inline-block px-8">📢 {msg}</span>
            ))}
            {tickerMessages.map((msg, i) => (
              <span key={`d-${i}`} className="inline-block px-8">📢 {msg}</span>
            ))}
          </div>
          {/* Admin/Manager controls */}
          {isManagerOrAdmin && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <button onClick={() => setShowTickerInput(!showTickerInput)} className="text-xs opacity-80 hover:opacity-100 px-1" title="Add message">+ Add</button>
            </div>
          )}
          {showTickerInput && (
            <div className="absolute right-2 top-8 z-50 bg-card border rounded-md shadow-lg p-2 flex gap-1">
              <Input placeholder="Type ticker message..." value={tickerInput} onChange={e => setTickerInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && postTickerMessage()} className="h-7 text-xs w-64" />
              <Button size="sm" className="h-7 text-xs" onClick={postTickerMessage}>Post</Button>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-1">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar */}
      {sidebarOpen ? (
        <aside className="fixed md:relative inset-y-0 left-0 z-40 w-64 bg-card border-r flex flex-col shrink-0 transition-all duration-200 md:transition-none">
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-primary-foreground" /></div>
              <div className="min-w-0 flex-1">
                <h1 className="font-bold text-sm truncate">Akash Inventory</h1>
                <button onClick={() => setWorkingEntity(null)} className="flex items-center gap-1 text-xs text-primary hover:underline" title="Switch entity">
                  <Building2 className="w-3 h-3" />{workingEntity.name}
                </button>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive shrink-0" onClick={handleLogout} title="Sign Out"><LogOut className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <nav className="p-3 space-y-1">
              {renderFunctionMenu()}
              {(isManagerOrAdmin || visibleMasterDataItems.length > 0) && (<><div className="my-2"><Separator /></div>{renderMasterDataSection()}</>)}
              {isAdmin && (
                <button onClick={() => setCurrentView('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'settings' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                  <Settings2 className="w-4 h-4 shrink-0" />Settings
                </button>
              )}
            </nav>
          </div>
          <div className="p-3 border-t space-y-2">
            <div className="px-3 py-2 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
              <Badge variant={user.role === 'admin' ? 'default' : user.role === 'manager' ? 'secondary' : 'outline'} className={`mt-1 text-[10px] ${user.role === 'manager' ? 'bg-blue-100 text-blue-800' : ''}`}>{user.role}</Badge>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => setShowPasswordChangeDialog(true)}>
              <Key className="w-3.5 h-3.5 mr-2" />Change Password
            </Button>
          </div>
        </aside>
      ) : (
        <aside className="w-14 bg-card border-r flex flex-col items-center py-4 shrink-0 transition-all duration-200">
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="mb-4"><Menu className="w-5 h-5" /></Button></SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-4 border-b"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-primary-foreground" /></div><div><h1 className="font-bold text-sm">Akash Inventory</h1><button onClick={() => setWorkingEntity(null)} className="flex items-center gap-1 text-xs text-primary hover:underline"><Building2 className="w-3 h-3" />{workingEntity.name}</button></div></div></div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden"><nav className="p-3 space-y-1">
                {renderFunctionMenu()}
                {(isManagerOrAdmin || visibleMasterDataItems.length > 0) && (<><div className="my-2"><Separator /></div>{renderMasterDataSection()}</>)}
                {isAdmin && <button onClick={() => { setCurrentView('settings'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'settings' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Settings2 className="w-4 h-4 shrink-0" />Settings</button>}
              </nav></div>
              <div className="absolute bottom-0 left-0 right-0 p-3 border-t space-y-2">
                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" />Sign Out</Button>
              </div>
            </SheetContent>
          </Sheet>
          {/* Icon-only buttons — scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center w-full py-2">
            <Button variant={currentView === 'itemPrice' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('itemPrice')} title="Item Price"><TrendingUp className="w-4 h-4" /></Button>
            <Button variant={['myEntityStock','allEntityStock'].includes(currentView) ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('myEntityStock')} title="Stock View"><BarChart3 className="w-4 h-4" /></Button>
            <Button variant={currentView === 'itemAdjustment' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('itemAdjustment')} title="Adjustment"><Settings2 className="w-4 h-4" /></Button>
            <Button variant={currentView === 'transfer' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('transfer')} title="Transfer"><ArrowRightLeft className="w-4 h-4" /></Button>
            <Button variant={currentView === 'receive' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('receive')} title="Receive"><ArrowDownToLine className="w-4 h-4" /></Button>
            <Button variant={currentView === 'purchase' || currentView === 'purchaseApproval' || currentView === 'newPurchase' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('purchase')} title="Purchase"><ShoppingCart className="w-4 h-4" /></Button>
            <Button variant={['salesOrder','salesReturn'].includes(currentView) ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('salesOrder')} title="Sales"><ShoppingCart className="w-4 h-4" /></Button>
            <Button variant={currentView === 'booking' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('booking')} title="Booking"><Receipt className="w-4 h-4" /></Button>
            <Button variant={currentView === 'bookingReasons' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('bookingReasons')} title="Booking Reasons"><FileText className="w-4 h-4" /></Button>
            <Button variant={currentView === 'incentive' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('incentive')} title="Incentive"><DollarSign className="w-4 h-4" /></Button>
            <Button variant={currentView === 'reports' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('reports')} title="Reports"><FileText className="w-4 h-4" /></Button>
            {(isManagerOrAdmin || visibleMasterDataItems.length > 0) && <Button variant={isMasterDataActive ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => { const firstVisible = visibleMasterDataItems[0]; if (firstVisible) setCurrentView(firstVisible.key); }} title="Master Data"><Database className="w-4 h-4" /></Button>}
            {isAdmin && <Button variant={currentView === 'settings' ? 'default' : 'ghost'} size="icon" className="my-1" onClick={() => setCurrentView('settings')} title="Settings"><Settings2 className="w-4 h-4" /></Button>}
          </div>
          <div className="shrink-0 pt-2 border-t w-full flex justify-center">
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={handleLogout} title="Sign Out"><LogOut className="w-4 h-4" /></Button>
          </div>
        </aside>
      )}

      {/* Toggle sidebar */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="absolute top-3 z-50 bg-card border rounded-full w-7 h-7 flex items-center justify-center shadow-sm hover:bg-muted transition-colors" style={{ left: sidebarOpen ? '240px' : '48px' }}>
        {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        <div className="p-3 sm:p-4 md:p-6 pt-12 md:pt-14">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>

      {contextMenu && (
        <div className="fixed z-[9999] bg-card border rounded-lg shadow-lg py-1 min-w-[180px]" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button className="w-full text-left px-3 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-2" onClick={() => { openInNewTab(contextMenu.view); setContextMenu(null) }}><Plus className="w-4 h-4" /> Open in new tab</button>
          <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/?view=${contextMenu.view}&entityId=${workingEntity?.id || ''}`); setContextMenu(null); toast({ title: 'Copied', description: 'Link copied' }) }}><FileText className="w-4 h-4" /> Copy link</button>
        </div>
      )}

      </div>{/* close flex-1 div */}
    </div>{/* close root min-h-screen div */}
    
    {/* ★ Chat Widget — completely OUTSIDE all layout divs, truly fixed to viewport */}
    {chatOpen ? (
      <div className="fixed bottom-4 right-4 z-[10000] w-80 bg-card border rounded-lg shadow-2xl flex flex-col" style={{ maxHeight: '500px' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-primary text-primary-foreground rounded-t-lg">
          <span className="text-sm font-semibold flex items-center gap-2">
            {chatPartnerId ? (
              <>
                <button onClick={() => { setChatPartnerId(''); setChatMessages([]) }} className="hover:opacity-70">←</button>
                {entities.find(e => e.id === chatPartnerId)?.name || 'Chat'}
                {chatPartnerId === workingEntity?.id && <Badge variant="outline" className="ml-1 text-[9px] bg-blue-50 text-blue-600">Me</Badge>}
              </>
            ) : (
              <>💬 Entity Chat — {workingEntity?.name}</>
            )}
          </span>
          <button onClick={() => { setChatOpen(false); setChatPartnerId(''); setChatMessages([]) }} className="hover:opacity-70">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: '200px', maxHeight: '350px' }}>
          {!chatPartnerId ? (
            <div className="p-2 space-y-1">
              <p className="text-xs text-muted-foreground px-2 py-1">Select an entity to chat with:</p>
              {entities.map(e => {
                const isSelf = e.id === workingEntity?.id
                const partner = chatPartners.find(p => p.partnerId === e.id)
                return (
                  <button key={e.id} onClick={() => { setChatPartnerId(e.id); fetchChatMessages(e.id); fetchMentionUsers(e.id) }} className="w-full text-left px-3 py-2 hover:bg-muted rounded-md text-sm flex items-center justify-between">
                    <span>{e.name} {isSelf && <Badge variant="outline" className="ml-1 text-[9px] bg-blue-50 text-blue-600">Me</Badge>}</span>
                    {partner && partner.unread > 0 && <Badge className="bg-red-500 text-white text-[10px]">{partner.unread}</Badge>}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {chatLoading ? <p className="text-center text-xs text-muted-foreground py-4">Loading...</p>
              : chatMessages.length === 0 ? <p className="text-center text-xs text-muted-foreground py-4">No messages yet. Say hello!</p>
              : chatMessages.map((msg, i) => {
                const renderMessage = (text: string) => {
                  const parts = text.split(/(@\w+)/g)
                  return parts.map((part, pi) => {
                    if (part.startsWith('@') && part.length > 1) {
                      return <span key={pi} className="font-semibold text-blue-600 bg-blue-100 px-0.5 rounded">{part}</span>
                    }
                    return <span key={pi}>{part}</span>
                  })
                }
                return (
                <div key={i} className={`flex ${msg.fromEntityId === workingEntity?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-xs ${msg.fromEntityId === workingEntity?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className={`text-[10px] font-semibold mb-0.5 ${msg.fromEntityId === workingEntity?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {msg.fromEntityId === workingEntity?.id ? 'You' : (msg as any).senderName || msg.fromEntity?.name || 'Unknown'}
                    </p>
                    <p>{renderMessage(msg.message)}</p>
                    <p className={`text-[9px] mt-0.5 ${msg.fromEntityId === workingEntity?.id ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {chatPartnerId && (
          <div className="p-2 border-t relative">
            {chatMentionStart >= 0 && filteredMentionUsers.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 bg-card border rounded-t-md shadow-lg max-h-32 overflow-y-auto z-10">
                {filteredMentionUsers.slice(0, 5).map(u => (
                  <button key={u.id} type="button" onClick={() => selectMentionUser(u)} className="w-full text-left px-3 py-1.5 hover:bg-primary hover:text-primary-foreground text-xs border-b last:border-0 transition-colors">
                    <span className="font-semibold">@{u.displayName}</span>
                    <span className="text-muted-foreground ml-1">({u.username})</span>
                    {u.role === 'admin' && <Badge variant="outline" className="ml-1 text-[8px]">admin</Badge>}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <Input placeholder="Type a message... use @ to mention" value={chatInput} onChange={e => handleChatInputChange(e.target.value)} onKeyDown={e => {
                if (e.key === 'Enter' && chatMentionStart < 0) sendChatMessage()
              }} className="h-8 text-xs flex-1" />
              <Button size="sm" className="h-8 px-2" onClick={sendChatMessage}>Send</Button>
            </div>
          </div>
        )}
      </div>
    ) : (
      <button onClick={() => { setChatOpen(true); fetchChatPartners(); fetchMentionUsers(); setChatUnreadCount(0) }} className="fixed bottom-4 right-4 z-[10000] w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 flex items-center justify-center transition-all hover:scale-105">
        <span className="text-2xl">💬</span>
        {chatUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</span>
        )}
      </button>
    )}
    {/* ★ Global confirmation dialog host — renders the AlertDialog when confirm() is called */}
    {ConfirmHost}
    </>
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
