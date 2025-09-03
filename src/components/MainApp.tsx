import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SearchFilters from '@/components/SearchFilters'
import InteractiveMap from '@/components/InteractiveMap'
import BillboardCard from '@/components/BillboardCard'
import EnhancedPricingCalculator from '@/components/EnhancedPricingCalculator'
import PricingDataManager from '@/components/PricingDataManager'
import SystemSettings from '@/components/SystemSettings'
import EnhancedArabicPricingManagement from '@/components/EnhancedArabicPricingManagement'
import InstallationPricingManagement from '@/components/InstallationPricingManagement'
import QuoteDialog from '@/components/QuoteDialog'
import { loadBillboardsFromExcel } from '@/services/billboardService'
import { Billboard, PackageDuration } from '@/types'

export default function MainApp() {
  const [billboards, setBillboards] = useState<Billboard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  // Filters state
  const [searchTerm, setSearchTerm] = useState('')
  const [contractFilter, setContractFilter] = useState('')
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [selectedAvailabilities, setSelectedAvailabilities] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showMap, setShowMap] = useState(false)

  // UI dialogs
  const [showSystemSettings, setShowSystemSettings] = useState(false)
  const [showArabicPricing, setShowArabicPricing] = useState(false)
  const [showInstallationPricing, setShowInstallationPricing] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showPricingDataManager, setShowPricingDataManager] = useState(false)
  const [showQuoteDialog, setShowQuoteDialog] = useState(false)

  // Selection and image preview
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<string[]>([])
  const [previewImage, setPreviewImage] = useState<string>('')

  // Duration selection for pricing cards (optional)
  const [selectedDuration, setSelectedDuration] = useState<PackageDuration | null>(null)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await loadBillboardsFromExcel()
        // ضمان فريدة المعرفات لتجنب تحذير مفاتيح React المكررة
        const counts = new Map<string, number>()
        const unique = data.map((b) => {
          const baseId = (b.id || '').toString()
          const c = counts.get(baseId) || 0
          counts.set(baseId, c + 1)
          if (c === 0) return b
          const newId = `${baseId}-${c + 1}`
          console.warn(`Duplicate billboard id detected: ${baseId}. Renaming to ${newId}`)
          return { ...b, id: newId }
        })
        setBillboards(unique)
      } catch (e: any) {
        setError(e?.message || 'فشل تحميل بيانات اللوحات')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Listen to map popup "showBillboardImage" events
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>
      if (ce.detail) setPreviewImage(ce.detail)
    }
    document.addEventListener('showBillboardImage', handler as EventListener)
    return () => document.removeEventListener('showBillboardImage', handler as EventListener)
  }, [])

  const municipalities = useMemo(() => {
    const set = new Set(billboards.map(b => b.municipality).filter(Boolean))
    return Array.from(set).sort()
  }, [billboards])

  const sizes = useMemo(() => {
    const set = new Set(billboards.map(b => b.size).filter(Boolean))
    return Array.from(set).sort()
  }, [billboards])

  const contracts = useMemo(() => {
    const set = new Set(billboards.map(b => (b.contractNumber || '').trim()).filter(Boolean))
    return Array.from(set).sort()
  }, [billboards])

  const filteredBillboards = useMemo(() => {
    let list = [...billboards]

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase()
      list = list.filter(b =>
        b.name.toLowerCase().includes(term) ||
        b.location.toLowerCase().includes(term) ||
        b.municipality.toLowerCase().includes(term) ||
        b.city.toLowerCase().includes(term) ||
        b.area.toLowerCase().includes(term) ||
        b.size.toLowerCase().includes(term) ||
        (b.clientName || '').toLowerCase().includes(term) ||
        (b.contractNumber || '').toLowerCase().includes(term)
      )
    }

    if (contractFilter.trim()) {
      const cf = contractFilter.trim()
      list = list.filter(b => (b.contractNumber || '').includes(cf))
    }

    if (selectedMunicipalities.length)
      list = list.filter(b => selectedMunicipalities.includes(b.municipality))

    if (selectedSizes.length)
      list = list.filter(b => selectedSizes.includes(b.size))

    if (selectedAvailabilities.length)
      list = list.filter(b => selectedAvailabilities.includes(b.status))

    return list
  }, [billboards, searchTerm, contractFilter, selectedMunicipalities, selectedSizes, selectedAvailabilities])

  const toggleSelection = (id: string) => {
    setSelectedBillboardIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const onPrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-yellow-50 to-orange-50">
      <Header
        onOpenSettings={() => setShowSystemSettings(true)}
        onOpenPricing={() => setShowArabicPricing(true)}
        onOpenInstallationPricing={() => setShowInstallationPricing(true)}
      />

      <main className="container mx-auto px-4 py-6">
        <SearchFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          contractFilter={contractFilter}
          setContractFilter={setContractFilter}
          selectedMunicipalities={selectedMunicipalities}
          setSelectedMunicipalities={setSelectedMunicipalities}
          selectedSizes={selectedSizes}
          setSelectedSizes={setSelectedSizes}
          selectedAvailabilities={selectedAvailabilities}
          setSelectedAvailabilities={setSelectedAvailabilities}
          viewMode={viewMode}
          setViewMode={setViewMode}
          showMap={showMap}
          setShowMap={setShowMap}
          municipalities={municipalities}
          sizes={sizes}
          contracts={contracts}
          onPrint={onPrint}
        />

        {error && (
          <div className="max-w-3xl mx-auto mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-md text-red-700 font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-yellow-500"></div>
          </div>
        ) : (
          <>
            {showMap && (
              <div className="mb-8">
                <InteractiveMap billboards={filteredBillboards} onImageView={(url) => setPreviewImage(url)} />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="text-sm text-gray-700 font-bold">
                النتائج: {filteredBillboards.length} / {billboards.length}
                {selectedBillboardIds.length > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-bold">مختار: {selectedBillboardIds.length}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold border-2 border-yellow-400"
                  onClick={() => setShowCalculator(true)}
                  disabled={filteredBillboards.length === 0}
                >
                  حساب الأسعار
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold border-2 border-blue-500"
                  onClick={() => setShowPricingDataManager(true)}
                >
                  إدارة البيانات
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold border-2 border-green-500"
                  onClick={() => setShowQuoteDialog(true)}
                  disabled={selectedBillboardIds.length === 0}
                >
                  إرسال عرض
                </button>
              </div>
            </div>

            {/* List */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBillboards.map(bb => (
                  <BillboardCard
                    key={bb.id}
                    billboard={bb}
                    isSelected={selectedBillboardIds.includes(bb.id)}
                    onToggleSelection={toggleSelection}
                    onViewImage={(url) => setPreviewImage(url)}
                    showPricing={true}
                    selectedDuration={selectedDuration}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBillboards.map(bb => (
                  <BillboardCard
                    key={bb.id}
                    billboard={bb}
                    isSelected={selectedBillboardIds.includes(bb.id)}
                    onToggleSelection={toggleSelection}
                    onViewImage={(url) => setPreviewImage(url)}
                    showPricing={true}
                    selectedDuration={selectedDuration}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />

      {/* Image preview modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImage('')}>
          <img src={previewImage} alt="billboard" className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {/* Dialogs */}
      {showSystemSettings && (
        <SystemSettings onClose={() => setShowSystemSettings(false)} />
      )}

      {showArabicPricing && (
        <EnhancedArabicPricingManagement onClose={() => setShowArabicPricing(false)} />
      )}

      {showInstallationPricing && (
        <InstallationPricingManagement onClose={() => setShowInstallationPricing(false)} />
      )}

      {showCalculator && (
        <EnhancedPricingCalculator
          onClose={() => setShowCalculator(false)}
          selectedBillboards={selectedBillboardIds}
          allBillboards={billboards}
        />
      )}

      {showPricingDataManager && (
        <PricingDataManager onClose={() => setShowPricingDataManager(false)} />
      )}

      {showQuoteDialog && (
        <QuoteDialog
          onClose={() => setShowQuoteDialog(false)}
          selectedBillboards={new Set(selectedBillboardIds)}
          billboards={billboards}
        />
      )}
    </div>
  )
}
