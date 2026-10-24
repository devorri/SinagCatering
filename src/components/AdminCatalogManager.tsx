import React, { useState, useMemo, useRef } from 'react'
import {
  Utensils,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  UploadCloud,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useConfirm } from '../context/ConfirmContext'
import type { MenuItem, CateringAddon } from '../types'
import type { CateringPackage } from '../data/packages'
import { formatMoney } from '../data/packages'
import { uploadImageToStorage } from '../lib/storage'

type CatalogSubTab = 'packages' | 'dishes' | 'addons'
type CategoryFilter = 'all' | 'main' | 'pasta' | 'drink'

interface CatalogImageUploadProps {
  label: string
  folder: 'menu' | 'packages'
  currentUrl?: string | null
  onUrlChange: (url: string) => void
  helperText?: string
}

const CatalogImageUpload: React.FC<CatalogImageUploadProps> = ({
  label,
  folder,
  currentUrl,
  onUrlChange,
  helperText,
}) => {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WEBP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 10MB limit. Please choose a smaller file.')
      return
    }
    setErrorMessage('')
    setIsUploading(true)
    try {
      const res = await uploadImageToStorage(file, folder)
      if (res.url) {
        onUrlChange(res.url)
      } else {
        setErrorMessage(res.error || 'Failed to upload image.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error uploading image to Files storage.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowManualInput(!showManualInput)}
          style={{
            background: 'none',
            border: 'none',
            color: '#B45309',
            fontSize: '0.74rem',
            cursor: 'pointer',
            fontWeight: 600,
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          {showManualInput ? 'Hide URL input' : 'Paste link manually'}
        </button>
      </div>

      {currentUrl ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '12px',
            background: '#F8FAFC',
            borderRadius: '8px',
            border: '1.5px solid #E2E8F0',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #CBD5E1',
              flexShrink: 0,
              background: '#FFFFFF',
            }}
          >
            <img
              src={currentUrl}
              alt="Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                ;(e.currentTarget as HTMLElement).style.display = 'none'
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#047857',
                  background: '#ECFDF5',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCircle2 size={12} />
                {currentUrl.includes('/storage/v1/object/public/Files') || currentUrl.includes('/storage/v1/object/public/files')
                  ? `Supabase Files/${folder}`
                  : 'Image Attached'}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#64748B',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={currentUrl}
            >
              {currentUrl}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                if (e.target) e.target.value = ''
              }}
            />
            <button
              type="button"
              className="btn"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#1E293B',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {isUploading ? <Loader2 size={13} className="animate-spin" /> : 'Change'}
            </button>
            <button
              type="button"
              onClick={() => onUrlChange('')}
              style={{
                fontSize: '0.75rem',
                padding: '6px 10px',
                background: '#FEE2E2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="Remove image"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? '#EA580C' : '#CBD5E1'}`,
            background: isDragging ? '#FFF7ED' : '#FAFAFA',
            borderRadius: '8px',
            padding: '20px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleFile(e.target.files?.[0])
              if (e.target) e.target.value = ''
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            {isUploading ? (
              <>
                <Loader2 size={24} style={{ color: '#EA580C' }} className="animate-spin" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#EA580C' }}>
                  Uploading to Supabase "Files" storage...
                </span>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#FFF7ED',
                    color: '#EA580C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '2px',
                  }}
                >
                  <UploadCloud size={20} />
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1E293B' }}>
                  Click to browse or drag and drop image
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Uploads to bucket <strong>Files/{folder}</strong> · PNG, JPG, or WEBP up to 10MB
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={12} /> {errorMessage}
        </span>
      )}

      {showManualInput && (
        <div style={{ marginTop: '4px' }}>
          <input
            type="text"
            className="input-field"
            value={currentUrl || ''}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="e.g. /gallery/food/food_caldereta.jpg or https://..."
            style={{ fontSize: '0.82rem', padding: '8px 12px' }}
          />
          <span style={{ fontSize: '0.72rem', color: '#71717A', display: 'block', marginTop: '3px' }}>
            Paste any direct image URL or local path.
          </span>
        </div>
      )}

      {helperText && !errorMessage && (
        <span style={{ fontSize: '0.74rem', color: '#71717A' }}>{helperText}</span>
      )}
    </div>
  )
}

export const AdminCatalogManager: React.FC = () => {
  const {
    packages,
    menuItems,
    addons,
    savePackage,
    deletePackage,
    saveMenuItem,
    toggleMenuItemActive,
    deleteMenuItem,
    saveAddon,
    deleteAddon,
  } = useApp()

  const { confirm } = useConfirm()

  // Tab & Filters
  const [activeSubTab, setActiveSubTab] = useState<CatalogSubTab>('packages')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'active' | 'hidden'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modals state
  const [editingPackage, setEditingPackage] = useState<CateringPackage | null>(null)
  const [isNewPackage, setIsNewPackage] = useState(false)
  const [editingMenuItem, setEditingMenuItem] = useState<Partial<MenuItem> | null>(null)
  const [isNewMenuItem, setIsNewMenuItem] = useState(false)
  const [editingAddon, setEditingAddon] = useState<Partial<CateringAddon> | null>(null)
  const [isNewAddon, setIsNewAddon] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Package editor temporary input states
  const [newInclusionText, setNewInclusionText] = useState('')
  const [newEntertainmentText, setNewEntertainmentText] = useState('')
  const [newFreebieText, setNewFreebieText] = useState('')
  const [newTierPax, setNewTierPax] = useState<number>(50)
  const [newTierPrice, setNewTierPrice] = useState<number>(35000)

  // Show toast notification
  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text })
    setTimeout(() => setFeedbackMessage(null), 4500)
  }

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (availabilityFilter === 'active' && !item.active) return false
      if (availabilityFilter === 'hidden' && item.active) return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = item.name.toLowerCase().includes(query)
        const matchDesc = item.description?.toLowerCase().includes(query)
        const matchTag = item.tag?.toLowerCase().includes(query)
        if (!matchName && !matchDesc && !matchTag) return false
      }
      return true
    })
  }, [menuItems, categoryFilter, availabilityFilter, searchQuery])

  // Counts
  const counts = useMemo(() => {
    const mainCount = menuItems.filter((m) => m.category === 'main').length
    const pastaCount = menuItems.filter((m) => m.category === 'pasta').length
    const drinkCount = menuItems.filter((m) => m.category === 'drink').length
    const activeCount = menuItems.filter((m) => m.active).length
    return {
      packages: packages.length,
      menuItems: menuItems.length,
      addons: addons.length,
      mains: mainCount,
      pasta: pastaCount,
      drinks: drinkCount,
      active: activeCount,
    }
  }, [packages, menuItems, addons])

  // ---------------------------------------------------------------------------
  // PACKAGE ACTIONS
  // ---------------------------------------------------------------------------
  const handleOpenNewPackage = () => {
    setIsNewPackage(true)
    setEditingPackage({
      id: `pkg-custom-${Date.now().toString().slice(-4)}`,
      name: '',
      shortName: '',
      bestFor: '',
      description: '',
      tiers: [
        { pax: 50, price: 35000 },
        { pax: 70, price: 40000 },
        { pax: 100, price: 45000 },
      ],
      defaultPax: 50,
      currency: 'PHP',
      inclusions: ['4 main dishes', 'Dessert and drinks', 'Elegant buffet setup'],
      entertainment: [],
      freebies: ['Candy and sweet corner', 'Event coordinator'],
    })
  }

  const handleSavePackage = async () => {
    if (!editingPackage) return
    if (!editingPackage.name.trim()) {
      showToast('error', 'Package name is required.')
      return
    }
    if (!editingPackage.id.trim()) {
      showToast('error', 'Package ID is required.')
      return
    }
    if (editingPackage.tiers.length === 0 && !editingPackage.pricePerHead) {
      showToast('error', 'Please configure at least one guest tier or a price per head.')
      return
    }

    setIsSaving(true)
    try {
      const res = await savePackage(editingPackage)
      if (res.success) {
        showToast('success', `Package "${editingPackage.name}" saved successfully!`)
        setEditingPackage(null)
      } else {
        showToast('error', res.error || 'Failed to save package.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error occurred while saving.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePackage = async (pkg: CateringPackage) => {
    const ok = await confirm({
      title: `Delete Package: ${pkg.name}`,
      message: `Are you sure you want to permanently remove "${pkg.name}" (${pkg.id})? This cannot be undone.`,
      confirmText: 'Delete Package',
      cancelText: 'Keep',
      variant: 'danger',
    })
    if (!ok) return

    try {
      const res = await deletePackage(pkg.id)
      if (res.success) {
        showToast('success', `Package "${pkg.name}" deleted.`)
      } else {
        showToast('error', res.error || 'Failed to delete package.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error deleting package.')
    }
  }

  // ---------------------------------------------------------------------------
  // MENU ITEM ACTIONS
  // ---------------------------------------------------------------------------
  const handleOpenNewMenuItem = () => {
    setIsNewMenuItem(true)
    setEditingMenuItem({
      id: `item-${Date.now().toString().slice(-5)}`,
      name: '',
      category: categoryFilter !== 'all' ? categoryFilter : 'main',
      description: '',
      tag: '',
      imageUrl: '',
      color: '#B45309',
      accentColor: '#FEF3C7',
      active: true,
      sortOrder: menuItems.length + 1,
    })
  }

  const handleToggleActive = async (item: MenuItem) => {
    try {
      const res = await toggleMenuItemActive(item.id, !item.active)
      if (res.success) {
        showToast(
          'success',
          `"${item.name}" is now ${!item.active ? 'active and visible in booking wizard' : 'hidden from booking wizard'}.`
        )
      } else {
        showToast('error', res.error || 'Failed to toggle availability.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error toggling item availability.')
    }
  }

  const handleSaveMenuItem = async () => {
    if (!editingMenuItem) return
    if (!editingMenuItem.name?.trim()) {
      showToast('error', 'Item name is required.')
      return
    }
    if (!editingMenuItem.category) {
      showToast('error', 'Category is required.')
      return
    }

    const itemToSave: MenuItem = {
      id: editingMenuItem.id || `item-${Date.now().toString().slice(-5)}`,
      name: editingMenuItem.name.trim(),
      category: editingMenuItem.category,
      description: editingMenuItem.description || '',
      tag: editingMenuItem.tag || undefined,
      imageUrl: editingMenuItem.imageUrl || undefined,
      color: editingMenuItem.color || '#B45309',
      accentColor: editingMenuItem.accentColor || '#FEF3C7',
      active: editingMenuItem.active ?? true,
      sortOrder: editingMenuItem.sortOrder ?? 0,
    }

    setIsSaving(true)
    try {
      const res = await saveMenuItem(itemToSave)
      if (res.success) {
        showToast('success', `Menu item "${itemToSave.name}" saved!`)
        setEditingMenuItem(null)
      } else {
        showToast('error', res.error || 'Failed to save menu item.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error saving menu item.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteMenuItem = async (item: MenuItem) => {
    const ok = await confirm({
      title: `Delete Item: ${item.name}`,
      message: `Permanently delete "${item.name}" from the menu catalog?`,
      confirmText: 'Delete Item',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return

    try {
      const res = await deleteMenuItem(item.id)
      if (res.success) {
        showToast('success', `"${item.name}" deleted from menu.`)
      } else {
        showToast('error', res.error || 'Failed to delete item.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error deleting item.')
    }
  }

  // ---------------------------------------------------------------------------
  // ADDON ACTIONS
  // ---------------------------------------------------------------------------
  const handleOpenNewAddon = () => {
    setIsNewAddon(true)
    setEditingAddon({
      id: `addon-${Date.now().toString().slice(-4)}`,
      name: '',
      price: 3500,
      rateType: 'flat',
      description: '',
    })
  }

  const handleSaveAddon = async () => {
    if (!editingAddon) return
    if (!editingAddon.name?.trim()) {
      showToast('error', 'Add-on name is required.')
      return
    }
    if (editingAddon.price === undefined || editingAddon.price < 0) {
      showToast('error', 'A valid price is required.')
      return
    }

    const addonToSave: CateringAddon = {
      id: editingAddon.id || `addon-${Date.now().toString().slice(-4)}`,
      name: editingAddon.name.trim(),
      price: Number(editingAddon.price),
      currency: 'PHP',
      rateType: editingAddon.rateType || 'flat',
      description: editingAddon.description || '',
    }

    setIsSaving(true)
    try {
      const res = await saveAddon(addonToSave)
      if (res.success) {
        showToast('success', `Add-on "${addonToSave.name}" saved!`)
        setEditingAddon(null)
      } else {
        showToast('error', res.error || 'Failed to save add-on.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error saving add-on.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAddon = async (addon: CateringAddon) => {
    const ok = await confirm({
      title: `Delete Add-on: ${addon.name}`,
      message: `Permanently delete "${addon.name}" from paid add-ons?`,
      confirmText: 'Delete Add-on',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return

    try {
      const res = await deleteAddon(addon.id)
      if (res.success) {
        showToast('success', `"${addon.name}" removed from add-ons.`)
      } else {
        showToast('error', res.error || 'Failed to delete add-on.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error deleting add-on.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Alert Feedback */}
      {feedbackMessage && (
        <div
          className={`alert-box ${feedbackMessage.type}`}
          role="status"
          style={{
            margin: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedbackMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* KPI Stats Ribbon — Identical layout & styling to Executive Overview */}
      <div className="stat-grid" style={{ marginBottom: 0 }}>
        <div className="stat">
          <div className="label">Catering Packages</div>
          <div className="value">{counts.packages}</div>
          <div className="subtext">Multi-tier dynamic banquet packages</div>
        </div>
        <div className="stat">
          <div className="label">Menu Offerings</div>
          <div className="value">{counts.menuItems}</div>
          <div className="subtext">{counts.active} active · {counts.mains} mains, {counts.pasta} pasta, {counts.drinks} drinks</div>
        </div>
        <div className="stat">
          <div className="label">Optional Add-ons</div>
          <div className="value">{counts.addons}</div>
          <div className="subtext">Flat buffet stations & per-head courses</div>
        </div>
      </div>

      {/* Main Unified Data Table Card */}
      <div className="data-table-card">
        {/* Uniform Card Header matching Bookings, Staff, Reviews */}
        <div
          style={{
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #EBE4D8',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>
              {activeSubTab === 'packages'
                ? 'Banquet Packages & Tier Pricing'
                : activeSubTab === 'dishes'
                ? 'Dishes & Beverage Catalog'
                : 'Optional Add-ons & Stations'}
            </h3>
            <span style={{ fontSize: '0.84rem', color: '#71717A' }}>
              {activeSubTab === 'packages'
                ? `Configure guest pax tiers, base rates, inclusions, and complimentary freebies (${packages.length} packages)`
                : activeSubTab === 'dishes'
                ? `Manage live kitchen availability, descriptions, and tags (${counts.active} of ${menuItems.length} active)`
                : `Manage optional buffet stations and per-head course options (${addons.length} items)`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="admin-filter-bar">
              <button
                type="button"
                className={`admin-filter-pill ${activeSubTab === 'dishes' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('dishes')}
              >
                FOOD CATALOG ({menuItems.length})
              </button>
              <button
                type="button"
                className={`admin-filter-pill ${activeSubTab === 'packages' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('packages')}
              >
                PACKAGES & PRICING ({packages.length})
              </button>
              <button
                type="button"
                className={`admin-filter-pill ${activeSubTab === 'addons' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('addons')}
              >
                ADD-ONS & STATIONS ({addons.length})
              </button>
            </div>

            {/* Primary Action Button */}
            {activeSubTab === 'packages' && (
              <button
                className="btn-submit-primary"
                type="button"
                onClick={handleOpenNewPackage}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', width: 'auto' }}
              >
                <Plus size={15} /> Add Package
              </button>
            )}
            {activeSubTab === 'dishes' && (
              <button
                className="btn-submit-primary"
                type="button"
                onClick={handleOpenNewMenuItem}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', width: 'auto' }}
              >
                <Plus size={15} /> Add Menu Item
              </button>
            )}
            {activeSubTab === 'addons' && (
              <button
                className="btn-submit-primary"
                type="button"
                onClick={handleOpenNewAddon}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', width: 'auto' }}
              >
                <Plus size={15} /> Add Add-on
              </button>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: BANQUET PACKAGES TABLE */}
        {/* =================================================================== */}
        {activeSubTab === 'packages' && (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>PACKAGE NAME</th>
                  <th style={{ width: '30%' }}>CAPACITY TIERS & PRICING</th>
                  <th style={{ width: '25%' }}>INCLUSIONS & FREEBIES</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {packages.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                      No banquet packages configured. Click "+ Add Package" to create one.
                    </td>
                  </tr>
                ) : (
                  packages.map((pkg) => (
                    <tr key={pkg.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {pkg.imageUrl ? (
                            <img
                              src={pkg.imageUrl}
                              alt={pkg.name}
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                flexShrink: 0,
                                border: '1px solid #E2E8F0',
                              }}
                              onError={(e) => {
                                ;(e.currentTarget as HTMLElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '8px',
                                background: '#FFF7ED',
                                border: '1px solid #FED7AA',
                                color: '#EA580C',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Sparkles size={18} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: '#18181B', fontSize: '0.92rem' }}>{pkg.name}</div>
                            <div style={{ fontSize: '0.78rem', color: '#71717A', marginTop: '2px' }}>
                              <span style={{ fontWeight: 600, color: '#475569' }}>#{pkg.id}</span>
                              {pkg.bestFor ? ` · ${pkg.bestFor}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {pkg.tiers && pkg.tiers.length > 0 ? (
                            pkg.tiers.map((t, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '0.74rem',
                                  background: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  color: '#1E293B',
                                }}
                              >
                                <strong style={{ color: '#0F172A' }}>{t.pax} pax:</strong>{' '}
                                <span style={{ color: '#9A3412', fontWeight: 700 }}>₱{t.price.toLocaleString()}</span>
                              </span>
                            ))
                          ) : pkg.pricePerHead ? (
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9A3412' }}>
                              ₱{pkg.pricePerHead} / head
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Custom quote</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                          <strong>{pkg.inclusions.length} Inclusions:</strong>{' '}
                          <span style={{ color: '#71717A' }}>
                            {pkg.inclusions.slice(0, 2).join(', ')}
                            {pkg.inclusions.length > 2 ? ` +${pkg.inclusions.length - 2} more` : ''}
                          </span>
                        </div>
                        {pkg.freebies && pkg.freebies.length > 0 && (
                          <div style={{ fontSize: '0.76rem', color: '#059669', marginTop: '3px', fontWeight: 500 }}>
                            Freebies: {pkg.freebies.slice(0, 2).join(', ')}
                            {pkg.freebies.length > 2 ? ` +${pkg.freebies.length - 2} more` : ''}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsNewPackage(false)
                              setEditingPackage({ ...pkg })
                            }}
                            className="btn-action-view"
                            title="Edit Package"
                          >
                            <Edit size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePackage(pkg)}
                            className="btn-action-forfeit"
                            title="Delete Package"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: DISHES & BEVERAGES TABLE */}
        {/* =================================================================== */}
        {activeSubTab === 'dishes' && (
          <>
            {/* Filter & Search Toolbar */}
            <div
              style={{
                padding: '16px 28px',
                background: '#FCFBF9',
                borderBottom: '1px solid #EBE4D8',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div className="admin-filter-bar">
                {(['all', 'main', 'pasta', 'drink'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`admin-filter-pill ${categoryFilter === cat ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat === 'all'
                      ? `ALL (${counts.menuItems})`
                      : cat === 'main'
                      ? `MAINS (${counts.mains})`
                      : cat === 'pasta'
                      ? `PASTA (${counts.pasta})`
                      : `DRINKS (${counts.drinks})`}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  className="admin-sort-select"
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                >
                  <option value="all">All Availability</option>
                  <option value="active">Active / Available</option>
                  <option value="hidden">Hidden / Unavailable</option>
                </select>

                <div className="admin-search-box" style={{ maxWidth: '240px' }}>
                  <Search size={14} style={{ color: '#71717A' }} />
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Search dishes or drinks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '38%' }}>ITEM & DESCRIPTION</th>
                    <th style={{ width: '15%' }}>CATEGORY</th>
                    <th style={{ width: '18%' }}>TAG / HIGHLIGHT</th>
                    <th style={{ width: '15%' }}>AVAILABILITY</th>
                    <th style={{ width: '14%', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMenuItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                        No menu items match the filter or search query.
                      </td>
                    </tr>
                  ) : (
                    filteredMenuItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: '#F1F5F9',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid #E2E8F0',
                              }}
                            >
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <Utensils size={18} style={{ color: '#94A3B8' }} />
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: '#18181B' }}>{item.name}</div>
                              <div
                                style={{
                                  fontSize: '0.78rem',
                                  color: '#71717A',
                                  maxWidth: '320px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={item.description}
                              >
                                {item.description || 'No description entered'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              color:
                                item.category === 'main'
                                  ? '#9A3412'
                                  : item.category === 'pasta'
                                  ? '#B45309'
                                  : '#1D4ED8',
                            }}
                          >
                            {item.category === 'main'
                              ? 'Main Dish'
                              : item.category === 'pasta'
                              ? 'Pasta'
                              : 'Beverage'}
                          </span>
                        </td>
                        <td>
                          {item.tag ? (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                background: '#FEF3C7',
                                color: '#92400E',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              {item.tag}
                            </span>
                          ) : (
                            <span style={{ color: '#CBD5E1' }}>—</span>
                          )}
                        </td>
                        <td>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                            title={`Toggle availability for ${item.name} in customer booking wizard`}
                          >
                            <input
                              type="checkbox"
                              checked={item.active}
                              onChange={() => handleToggleActive(item)}
                              style={{
                                width: '16px',
                                height: '16px',
                                accentColor: '#059669',
                                cursor: 'pointer',
                              }}
                            />
                            <span
                              className={`status-pill ${item.active ? 'confirmed' : 'pending'}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                fontSize: '0.74rem',
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: item.active ? '#059669' : '#D97706',
                                }}
                              />
                              {item.active ? 'Available' : 'Hidden'}
                            </span>
                          </label>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setIsNewMenuItem(false)
                                setEditingMenuItem({ ...item })
                              }}
                              className="btn-action-view"
                              title="Edit Item"
                            >
                              <Edit size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMenuItem(item)}
                              className="btn-action-forfeit"
                              title="Delete Item"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* =================================================================== */}
        {/* TAB 3: PAID ADD-ONS TABLE */}
        {/* =================================================================== */}
        {activeSubTab === 'addons' && (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>ADD-ON ENHANCEMENT</th>
                  <th style={{ width: '18%' }}>RATE TYPE</th>
                  <th style={{ width: '18%' }}>PRICE</th>
                  <th style={{ width: '22%' }}>DESCRIPTION</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {addons.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                      No optional add-ons configured. Click "+ Add Add-on" to create one.
                    </td>
                  </tr>
                ) : (
                  addons.map((addon) => (
                    <tr key={addon.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#18181B' }}>{addon.name}</div>
                        <div style={{ fontSize: '0.74rem', color: '#71717A' }}>#{addon.id}</div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            background: addon.rateType === 'per_head' ? '#EFF6FF' : '#F1F5F9',
                            color: addon.rateType === 'per_head' ? '#1D4ED8' : '#475569',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                          }}
                        >
                          {addon.rateType === 'per_head' ? 'Per Guest' : 'Flat Station'}
                        </span>
                      </td>
                      <td className="font-number" style={{ fontWeight: 700, color: '#9A3412', fontSize: '0.92rem' }}>
                        {addon.rateType === 'per_head'
                          ? `₱${addon.price.toLocaleString()} / head`
                          : formatMoney(addon.price, 'PHP')}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#71717A' }}>
                          {addon.description || '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsNewAddon(false)
                              setEditingAddon({ ...addon })
                            }}
                            className="btn-action-view"
                            title="Edit Add-on"
                          >
                            <Edit size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddon(addon)}
                            className="btn-action-forfeit"
                            title="Delete Add-on"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: PACKAGE EDITOR */}
      {/* ===================================================================== */}
      {editingPackage && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderBottom: '1px solid #EBE4D8',
                paddingBottom: '14px',
              }}
            >
              <div>
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>
                  {isNewPackage ? 'Add Banquet Package' : `Edit Package: ${editingPackage.name}`}
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#71717A' }}>
                  Configure guest capacity tiers, pricing structure, inclusions, and complimentary perks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPackage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Package ID (Slug) *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingPackage.id}
                    disabled={!isNewPackage}
                    onChange={(e) => setEditingPackage({ ...editingPackage, id: e.target.value })}
                    placeholder="pkg-wedding-deluxe"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Package Name *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingPackage.name}
                    onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                    placeholder="Grand Wedding Banquet Package"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Ideal Event / Best For
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={editingPackage.bestFor || editingPackage.description || ''}
                  onChange={(e) =>
                    setEditingPackage({ ...editingPackage, bestFor: e.target.value, description: e.target.value })
                  }
                  placeholder="e.g. Recommended for 50-100 guests celebrating weddings or milestones"
                />
              </div>

              <CatalogImageUpload
                label="Package Cover / Showcase Photo"
                folder="packages"
                currentUrl={editingPackage.imageUrl}
                onUrlChange={(url) => setEditingPackage({ ...editingPackage, imageUrl: url })}
                helperText="Showcase banquet or styling setup photo uploaded to Supabase 'Files/packages'."
              />

              {/* Guest & Price Tiers */}
              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0F172A', display: 'block', marginBottom: '10px' }}>
                  Guest Capacity & Price Tiers
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {editingPackage.tiers.map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr 32px',
                        gap: '8px',
                        alignItems: 'center',
                        background: '#FFFFFF',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          className="input-field"
                          value={t.pax}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            const updated = [...editingPackage.tiers]
                            updated[idx] = { ...updated[idx], pax: val }
                            setEditingPackage({ ...editingPackage, tiers: updated })
                          }}
                          style={{ padding: '5px 8px', fontSize: '0.82rem', width: '65px' }}
                        />
                        <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>pax</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.82rem', color: '#9A3412', fontWeight: 700 }}>₱</span>
                        <input
                          type="number"
                          className="input-field"
                          value={t.price}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            const updated = [...editingPackage.tiers]
                            updated[idx] = { ...updated[idx], price: val }
                            setEditingPackage({ ...editingPackage, tiers: updated })
                          }}
                          style={{ padding: '5px 8px', fontSize: '0.82rem', flex: 1 }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingPackage.tiers.filter((_, i) => i !== idx)
                          setEditingPackage({ ...editingPackage, tiers: updated })
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Remove Tier"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="Pax (e.g. 150)"
                    className="input-field"
                    value={newTierPax || ''}
                    onChange={(e) => setNewTierPax(Number(e.target.value))}
                    style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem' }}
                  />
                  <input
                    type="number"
                    placeholder="Price (e.g. 55000)"
                    className="input-field"
                    value={newTierPrice || ''}
                    onChange={(e) => setNewTierPrice(Number(e.target.value))}
                    style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem' }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (newTierPax > 0 && newTierPrice > 0) {
                        const updated = [...editingPackage.tiers, { pax: newTierPax, price: newTierPrice }].sort(
                          (a, b) => a.pax - b.pax
                        )
                        setEditingPackage({ ...editingPackage, tiers: updated })
                      }
                    }}
                    style={{ fontSize: '0.8rem', padding: '7px 14px', whiteSpace: 'nowrap' }}
                  >
                    + Add Tier
                  </button>
                </div>
              </div>

              {/* Inclusions */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Inclusions ({editingPackage.inclusions.length})
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {editingPackage.inclusions.map((inc, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.76rem',
                        background: '#F1F5F9',
                        color: '#334155',
                        border: '1px solid #CBD5E1',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {inc}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingPackage.inclusions.filter((_, i) => i !== idx)
                          setEditingPackage({ ...editingPackage, inclusions: updated })
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Elegant Floral Centerpieces"
                    className="input-field"
                    value={newInclusionText}
                    onChange={(e) => setNewInclusionText(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newInclusionText.trim()) {
                        e.preventDefault()
                        setEditingPackage({
                          ...editingPackage,
                          inclusions: [...editingPackage.inclusions, newInclusionText.trim()],
                        })
                        setNewInclusionText('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (newInclusionText.trim()) {
                        setEditingPackage({
                          ...editingPackage,
                          inclusions: [...editingPackage.inclusions, newInclusionText.trim()],
                        })
                        setNewInclusionText('')
                      }
                    }}
                    style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Freebies */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Complimentary Freebies ({editingPackage.freebies.length})
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {editingPackage.freebies.map((fr, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.76rem',
                        background: '#ECFDF5',
                        color: '#065F46',
                        border: '1px solid #A7F3D0',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {fr}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingPackage.freebies.filter((_, i) => i !== idx)
                          setEditingPackage({ ...editingPackage, freebies: updated })
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Personalized Welcome Board"
                    className="input-field"
                    value={newFreebieText}
                    onChange={(e) => setNewFreebieText(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFreebieText.trim()) {
                        e.preventDefault()
                        setEditingPackage({
                          ...editingPackage,
                          freebies: [...editingPackage.freebies, newFreebieText.trim()],
                        })
                        setNewFreebieText('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (newFreebieText.trim()) {
                        setEditingPackage({
                          ...editingPackage,
                          freebies: [...editingPackage.freebies, newFreebieText.trim()],
                        })
                        setNewFreebieText('')
                      }
                    }}
                    style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Entertainment */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Entertainment Options ({editingPackage.entertainment.length})
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {editingPackage.entertainment.map((ent, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.76rem',
                        background: '#EFF6FF',
                        color: '#1E40AF',
                        border: '1px solid #BFDBFE',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {ent}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingPackage.entertainment.filter((_, i) => i !== idx)
                          setEditingPackage({ ...editingPackage, entertainment: updated })
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Acoustic Duo & Sound System"
                    className="input-field"
                    value={newEntertainmentText}
                    onChange={(e) => setNewEntertainmentText(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newEntertainmentText.trim()) {
                        e.preventDefault()
                        setEditingPackage({
                          ...editingPackage,
                          entertainment: [...editingPackage.entertainment, newEntertainmentText.trim()],
                        })
                        setNewEntertainmentText('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (newEntertainmentText.trim()) {
                        setEditingPackage({
                          ...editingPackage,
                          entertainment: [...editingPackage.entertainment, newEntertainmentText.trim()],
                        })
                        setNewEntertainmentText('')
                      }
                    }}
                    style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px',
                borderTop: '1px solid #EBE4D8',
                paddingTop: '16px',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setEditingPackage(null)}
                style={{ fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit-primary"
                onClick={handleSavePackage}
                disabled={isSaving}
                style={{ width: 'auto', fontSize: '0.85rem' }}
              >
                {isSaving ? 'Saving Package...' : 'Save Package'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: MENU ITEM EDITOR */}
      {/* ===================================================================== */}
      {editingMenuItem && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderBottom: '1px solid #EBE4D8',
                paddingBottom: '14px',
              }}
            >
              <div>
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>
                  {isNewMenuItem ? 'Add Menu Item' : `Edit Item: ${editingMenuItem.name}`}
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#71717A' }}>
                  Configures client dish options and drink options in the booking wizard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMenuItem(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Category *
                  </label>
                  <select
                    className="input-field"
                    value={editingMenuItem.category || 'main'}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, category: e.target.value as any })}
                  >
                    <option value="main">Main Dish</option>
                    <option value="pasta">Gourmet Pasta</option>
                    <option value="drink">Beverage / Drink</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Item Name *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingMenuItem.name || ''}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, name: e.target.value })}
                    placeholder="e.g. Classic Beef Caldereta"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={editingMenuItem.description || ''}
                  onChange={(e) => setEditingMenuItem({ ...editingMenuItem, description: e.target.value })}
                  placeholder="e.g. Slow-cooked premium beef in rich spiced tomato sauce and bell peppers"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Tag / Highlight
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingMenuItem.tag || ''}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, tag: e.target.value })}
                    placeholder="e.g. Chef's Signature"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Initial Availability
                  </label>
                  <select
                    className="input-field"
                    value={editingMenuItem.active ? 'active' : 'hidden'}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, active: e.target.value === 'active' })}
                  >
                    <option value="active">Active (Available)</option>
                    <option value="hidden">Hidden (Unavailable)</option>
                  </select>
                </div>
              </div>

              <CatalogImageUpload
                label="Dish / Beverage Photo"
                folder="menu"
                currentUrl={editingMenuItem.imageUrl}
                onUrlChange={(url) => setEditingMenuItem({ ...editingMenuItem, imageUrl: url })}
                helperText="Upload a dish photo directly to Supabase 'Files/menu'. Displays in the live booking menu picker."
              />
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px',
                borderTop: '1px solid #EBE4D8',
                paddingTop: '16px',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setEditingMenuItem(null)}
                style={{ fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit-primary"
                onClick={handleSaveMenuItem}
                disabled={isSaving}
                style={{ width: 'auto', fontSize: '0.85rem' }}
              >
                {isSaving ? 'Saving...' : 'Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: ADD-ON EDITOR */}
      {/* ===================================================================== */}
      {editingAddon && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderTop: 'none',
                borderBottom: '1px solid #EBE4D8',
                paddingBottom: '14px',
              }}
            >
              <div>
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>
                  {isNewAddon ? 'Add Optional Add-on' : `Edit Add-on: ${editingAddon.name}`}
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#71717A' }}>
                  Offered to clients during booking step 2 (Add-ons & Upgrades).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAddon(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Add-on Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={editingAddon.name || ''}
                  onChange={(e) => setEditingAddon({ ...editingAddon, name: e.target.value })}
                  placeholder="e.g. Candy Buffet & Sweet Station"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Price (PHP) *
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={editingAddon.price ?? ''}
                    onChange={(e) => setEditingAddon({ ...editingAddon, price: Number(e.target.value) })}
                    placeholder="3500"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Billing Rate Type *
                  </label>
                  <select
                    className="input-field"
                    value={editingAddon.rateType || 'flat'}
                    onChange={(e) => setEditingAddon({ ...editingAddon, rateType: e.target.value as any })}
                  >
                    <option value="flat">Flat Fee (Fixed Setup)</option>
                    <option value="per_head">Per Head (x Guest Count)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Description / Service Details
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={editingAddon.description || ''}
                  onChange={(e) => setEditingAddon({ ...editingAddon, description: e.target.value })}
                  placeholder="Includes themed candy jars, marshmallow pops, and attendant"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px',
                borderTop: '1px solid #EBE4D8',
                paddingTop: '16px',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setEditingAddon(null)}
                style={{ fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit-primary"
                onClick={handleSaveAddon}
                disabled={isSaving}
                style={{ width: 'auto', fontSize: '0.85rem' }}
              >
                {isSaving ? 'Saving...' : 'Save Add-on'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
