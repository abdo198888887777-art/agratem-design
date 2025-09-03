import React, { useState, useEffect } from 'react'
import {
  Calculator,
  Calendar,
  DollarSign,
  User,
  Building,
  MapPin,
  Clock,
  FileText,
  Printer,
  X,
  Plus,
  Minus,
  Settings,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Wrench
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  enhancedPricingService, 
  CustomerType, 
  PricingMode, 
  BillboardPricingData, 
  PricingCalculation,
  PricingQuote,
  PackageOption
} from '@/services/enhancedPricingService'
import { formatGregorianDate } from '@/lib/dateUtils'

interface EnhancedPricingCalculatorProps {
  onClose: () => void
  selectedBillboards?: string[]
  allBillboards?: any[]
}

const EnhancedPricingCalculator: React.FC<EnhancedPricingCalculatorProps> = ({
  onClose,
  selectedBillboards = [],
  allBillboards = []
}) => {
  // حالة النموذج
  const [pricingMode, setPricingMode] = useState<PricingMode>('package')
  const [customerType, setCustomerType] = useState<CustomerType>('عادي')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null)
  const [includeInstallation, setIncludeInstallation] = useState(false)

  // معلومات العميل
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  })

  // اللوحات المختارة
  const [billboards, setBillboards] = useState<BillboardPricingData[]>([])
  const [calculations, setCalculations] = useState<PricingCalculation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedQuote, setGeneratedQuote] = useState<PricingQuote | null>(null)

  // الباقات المتاحة
  const packageOptions = enhancedPricingService.getPackageOptions()

  useEffect(() => {
    // تحويل اللوحات المختارة إلى تنسيق مناسب للحساب
    if (selectedBillboards.length > 0 && allBillboards.length > 0) {
      const selectedBillboardsData = allBillboards
        .filter(b => selectedBillboards.includes(b.id))
        .map(b => ({
          id: b.id,
          name: b.name,
          size: b.size,
          municipality: b.municipality,
          level: (b.level || b.priceCategory || 'A') as 'A' | 'B',
          status: b.status,
          location: b.location,
          imageUrl: b.imageUrl
        }))
      
      setBillboards(selectedBillboardsData)
    }
  }, [selectedBillboards, allBillboards])

  useEffect(() => {
    // تعيين الباقة الافتراضية
    if (packageOptions.length > 0 && !selectedPackage) {
      setSelectedPackage(packageOptions[0])
    }
  }, [packageOptions, selectedPackage])

  useEffect(() => {
    // إعادة حساب الأسعار عند تغيير أي إعداد
    if (billboards.length > 0) {
      calculatePrices()
    }
  }, [billboards, customerType, pricingMode, startDate, endDate, selectedPackage, includeInstallation])

  const calculatePrices = async () => {
    if (billboards.length === 0) return

    setLoading(true)
    setError('')

    try {
      let calculations: PricingCalculation[]

      if (pricingMode === 'daily') {
        if (!endDate) {
          setError('يرجى تحديد تاريخ النهاية للحساب اليومي')
          setLoading(false)
          return
        }
        
        calculations = await enhancedPricingService.calculateMultipleBillboards(
          billboards,
          customerType,
          'daily',
          startDate,
          endDate,
          undefined,
          includeInstallation
        )
      } else {
        if (!selectedPackage) {
          setError('يرجى اختيار باقة للحساب')
          setLoading(false)
          return
        }

        calculations = await enhancedPricingService.calculateMultipleBillboards(
          billboards,
          customerType,
          'package',
          startDate,
          undefined,
          selectedPackage,
          includeInstallation
        )
      }

      setCalculations(calculations)
    } catch (error: any) {
      setError(`خطأ في الحساب: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const generateQuote = async () => {
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      setError('يرجى ملء جميع معلومات العميل')
      return
    }

    if (calculations.length === 0) {
      setError('لا توجد حسابات لإنشاء العرض')
      return
    }

    setLoading(true)

    try {
      const quote = await enhancedPricingService.generateQuote(
        {
          name: customerInfo.name,
          email: customerInfo.email,
          phone: customerInfo.phone,
          company: customerInfo.company,
          customerType
        },
        billboards,
        pricingMode,
        startDate,
        endDate,
        selectedPackage,
        includeInstallation
      )

      setGeneratedQuote(quote)
      setError('')
    } catch (error: any) {
      setError(`خطأ في إنشاء العرض: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const printQuote = () => {
    if (generatedQuote) {
      enhancedPricingService.printQuote(generatedQuote)
    }
  }

  const addManualBillboard = () => {
    const newBillboard: BillboardPricingData = {
      id: `manual-${Date.now()}`,
      name: 'لوحة يدوية',
      size: '5x13',
      municipality: 'مصراتة',
      level: 'A',
      status: 'متاح',
      location: 'موقع يدوي'
    }
    setBillboards(prev => [...prev, newBillboard])
  }

  const removeBillboard = (id: string) => {
    setBillboards(prev => prev.filter(b => b.id !== id))
  }

  const updateBillboard = (id: string, updates: Partial<BillboardPricingData>) => {
    setBillboards(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  const getTotalSummary = () => {
    const subtotal = calculations.reduce((sum, calc) => sum + calc.subtotal, 0)
    const totalInstallation = calculations.reduce((sum, calc) => sum + calc.installationPrice, 0)
    const grandTotal = subtotal + totalInstallation
    const averageDaily = enhancedPricingService.calculateAverageDailyPrice(calculations)
    const stats = enhancedPricingService.getCampaignStats(calculations)

    return {
      subtotal,
      totalInstallation,
      grandTotal,
      averageDaily,
      stats
    }
  }

  const summary = getTotalSummary()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Calculator className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">حاسبة التسعير المتطورة</h1>
                <p className="text-sm opacity-90">
                  {billboards.length > 0 ? `${billboards.length} لوحة مختارة` : 'حساب الأسعار المتقدم'}
                </p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
          {/* رسائل الخطأ */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">{error}</span>
              </div>
            </div>
          )}

          {!generatedQuote ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* إعدادات التسعير */}
              <div className="lg:col-span-1 space-y-6">
                {/* نوع التسعير */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-emerald-600" />
                    نوع التسعير
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={pricingMode === 'daily' ? 'default' : 'outline'}
                      className={pricingMode === 'daily' ? 'bg-emerald-600 text-white' : ''}
                      onClick={() => setPricingMode('daily')}
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      يومي
                    </Button>
                    <Button
                      variant={pricingMode === 'package' ? 'default' : 'outline'}
                      className={pricingMode === 'package' ? 'bg-emerald-600 text-white' : ''}
                      onClick={() => setPricingMode('package')}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      باقة
                    </Button>
                  </div>
                </Card>

                {/* نوع العميل */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-emerald-600" />
                    نوع العميل
                  </h3>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-emerald-500"
                  >
                    <option value="عادي">عادي</option>
                    <option value="مسوق">مسوق</option>
                    <option value="شركات">شركات</option>
                    <option value="المدينة">المدينة</option>
                  </select>
                </Card>

                {/* التواريخ والمدة */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    التواريخ والمدة
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ البداية</label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    {pricingMode === 'daily' ? (
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ النهاية</label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full"
                          min={startDate}
                        />
                        {startDate && endDate && (
                          <p className="text-sm text-gray-600 mt-2">
                            المدة: {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} يوم
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">اختر الباقة</label>
                        <select
                          value={selectedPackage?.key || ''}
                          onChange={(e) => {
                            const pkg = packageOptions.find(p => p.key === e.target.value)
                            setSelectedPackage(pkg || null)
                          }}
                          className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-emerald-500"
                        >
                          <option value="">اختر باقة...</option>
                          {packageOptions.map(pkg => (
                            <option key={pkg.key} value={pkg.key}>
                              {pkg.label} ({pkg.duration} يوم)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </Card>

                {/* خيارات إضافية */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-emerald-600" />
                    خيارات إضافية
                  </h3>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={includeInstallation}
                      onChange={(e) => setIncludeInstallation(e.target.checked)}
                      className="w-5 h-5 text-emerald-600"
                    />
                    <span className="text-sm font-semibold">تضمين أسعار التركيب</span>
                  </label>
                </Card>

                {/* معلومات العميل */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-emerald-600" />
                    معلومات العميل
                  </h3>
                  <div className="space-y-4">
                    <Input
                      placeholder="اسم العميل *"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <Input
                      placeholder="البريد الإلكتروني *"
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                    />
                    <Input
                      placeholder="رقم الهاتف *"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                    />
                    <Input
                      placeholder="اسم الشركة (اختياري)"
                      value={customerInfo.company}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, company: e.target.value }))}
                    />
                  </div>
                </Card>
              </div>

              {/* اللوحات والحسابات */}
              <div className="lg:col-span-2 space-y-6">
                {/* إدارة اللوحات */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Building className="w-5 h-5 text-emerald-600" />
                      اللوحات المختارة ({billboards.length})
                    </h3>
                    <Button
                      onClick={addManualBillboard}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      إضافة لوحة يدوياً
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {billboards.map((billboard, index) => (
                      <div key={billboard.id} className="bg-gray-50 rounded-lg p-4 border">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <Input
                              value={billboard.name}
                              onChange={(e) => updateBillboard(billboard.id, { name: e.target.value })}
                              className="font-bold mb-2"
                              placeholder="اسم اللوحة"
                            />
                            <Input
                              value={billboard.location}
                              onChange={(e) => updateBillboard(billboard.id, { location: e.target.value })}
                              className="text-sm"
                              placeholder="الموقع"
                            />
                          </div>
                          <Button
                            onClick={() => removeBillboard(billboard.id)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">المقاس</label>
                            <select
                              value={billboard.size}
                              onChange={(e) => updateBillboard(billboard.id, { size: e.target.value })}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            >
                              <option value="13x5">13x5</option>
                              <option value="12x4">12x4</option>
                              <option value="10x4">10x4</option>
                              <option value="8x3">8x3</option>
                              <option value="6x3">6x3</option>
                              <option value="4x3">4x3</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">المستوى</label>
                            <select
                              value={billboard.level}
                              onChange={(e) => updateBillboard(billboard.id, { level: e.target.value as 'A' | 'B' })}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            >
                              <option value="A">A</option>
                              <option value="B">B</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">البلدية</label>
                            <select
                              value={billboard.municipality}
                              onChange={(e) => updateBillboard(billboard.id, { municipality: e.target.value })}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            >
                              <option value="مصراتة">مصراتة</option>
                              <option value="طرابلس">طرابلس</option>
                              <option value="بنغازي">بنغازي</option>
                              <option value="زليتن">زليتن</option>
                              <option value="أبو سليم">أبو سليم</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">الحالة</label>
                            <Badge className={`${
                              billboard.status === 'متاح' ? 'bg-green-100 text-green-800' :
                              billboard.status === 'محجوز' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {billboard.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}

                    {billboards.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Building className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>لا توجد لوحات مختارة</p>
                        <p className="text-sm">اضغط "إضافة لوحة يدوياً" لبدء الحساب</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* نتائج الحسابات */}
                {calculations.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-emerald-600" />
                      نتائج الحسابات
                    </h3>

                    {/* ملخص سريع */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">{summary.stats.totalBillboards}</div>
                        <div className="text-sm text-blue-700">لوحة</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">{summary.stats.totalDays}</div>
                        <div className="text-sm text-green-700">يوم</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg text-center">
                        <div className="text-lg font-bold text-purple-600">{summary.averageDaily.toLocaleString()}</div>
                        <div className="text-sm text-purple-700">متوسط يومي</div>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg text-center">
                        <div className="text-lg font-bold text-orange-600">{summary.grandTotal.toLocaleString()}</div>
                        <div className="text-sm text-orange-700">الإجمالي</div>
                      </div>
                    </div>

                    {/* تفاصيل كل لوحة */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
                        <thead>
                          <tr className="bg-emerald-600 text-white">
                            <th className="border border-emerald-700 p-3 text-center">اللوحة</th>
                            <th className="border border-emerald-700 p-3 text-center">المقاس</th>
                            <th className="border border-emerald-700 p-3 text-center">المستوى</th>
                            <th className="border border-emerald-700 p-3 text-center">البلدية</th>
                            <th className="border border-emerald-700 p-3 text-center">
                              {pricingMode === 'daily' ? 'السعر اليومي' : 'سعر الباقة'}
                            </th>
                            <th className="border border-emerald-700 p-3 text-center">المدة</th>
                            {includeInstallation && (
                              <th className="border border-emerald-700 p-3 text-center">التركيب</th>
                            )}
                            <th className="border border-emerald-700 p-3 text-center">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calculations.map((calc, index) => (
                            <tr key={calc.billboard.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="border border-gray-300 p-3 text-right font-semibold">
                                {calc.billboard.name}
                              </td>
                              <td className="border border-gray-300 p-3 text-center font-bold">
                                {calc.billboard.size}
                              </td>
                              <td className="border border-gray-300 p-3 text-center">
                                <Badge className={calc.billboard.level === 'A' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                                  {calc.billboard.level}
                                </Badge>
                              </td>
                              <td className="border border-gray-300 p-3 text-center">
                                {calc.billboard.municipality}
                              </td>
                              <td className="border border-gray-300 p-3 text-center font-bold text-emerald-700">
                                {calc.basePrice.toLocaleString()} د.ل
                              </td>
                              <td className="border border-gray-300 p-3 text-center">
                                {calc.totalDays} يوم
                              </td>
                              {includeInstallation && (
                                <td className="border border-gray-300 p-3 text-center font-bold text-orange-600">
                                  {calc.installationPrice.toLocaleString()} د.ل
                                </td>
                              )}
                              <td className="border border-gray-300 p-3 text-center font-bold text-green-700">
                                {calc.total.toLocaleString()} د.ل
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* الإجمالي النهائي */}
                    <div className="mt-6 bg-gradient-to-r from-emerald-50 to-green-50 p-6 rounded-lg border-2 border-emerald-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold text-emerald-700">
                            {summary.subtotal.toLocaleString()} د.ل
                          </div>
                          <div className="text-sm text-emerald-600">إجمالي الإعلانات</div>
                        </div>
                        {includeInstallation && (
                          <div>
                            <div className="text-lg font-bold text-orange-700">
                              {summary.totalInstallation.toLocaleString()} د.ل
                            </div>
                            <div className="text-sm text-orange-600">إجمالي التركيب</div>
                          </div>
                        )}
                        <div>
                          <div className="text-2xl font-bold text-green-700">
                            {summary.grandTotal.toLocaleString()} د.ل
                          </div>
                          <div className="text-sm text-green-600">الإجمالي النهائي</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            /* عرض الفاتورة المُنشأة */
            <div className="space-y-6">
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-green-900 flex items-center gap-2">
                    <CheckCircle className="w-8 h-8" />
                    عرض السعر جاهز!
                  </h2>
                  <Badge className="bg-green-600 text-white text-lg px-4 py-2">
                    {generatedQuote.id}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-bold text-green-800 mb-2">معلومات العميل</h3>
                    <div className="space-y-1 text-sm">
                      <p><strong>الاسم:</strong> {generatedQuote.customerInfo.name}</p>
                      <p><strong>النوع:</strong> {generatedQuote.customerInfo.customerType}</p>
                      <p><strong>البريد:</strong> {generatedQuote.customerInfo.email}</p>
                      <p><strong>الهاتف:</strong> {generatedQuote.customerInfo.phone}</p>
                      {generatedQuote.customerInfo.company && (
                        <p><strong>الشركة:</strong> {generatedQuote.customerInfo.company}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-green-800 mb-2">تفاصيل العرض</h3>
                    <div className="space-y-1 text-sm">
                      <p><strong>نوع التسعير:</strong> {generatedQuote.pricingMode === 'daily' ? 'يومي' : 'باقة'}</p>
                      <p><strong>تاريخ البداية:</strong> {formatGregorianDate(generatedQuote.startDate)}</p>
                      {generatedQuote.endDate && (
                        <p><strong>تاريخ النهاية:</strong> {formatGregorianDate(generatedQuote.endDate)}</p>
                      )}
                      {generatedQuote.packageDuration && (
                        <p><strong>مدة الباقة:</strong> {generatedQuote.packageDuration}</p>
                      )}
                      <p><strong>عدد اللوحات:</strong> {generatedQuote.billboards.length} لوحة</p>
                      <p><strong>الإجمالي:</strong> 
                        <span className="text-lg font-bold text-green-700 mr-2">
                          {generatedQuote.grandTotal.toLocaleString()} {generatedQuote.currency}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* أزرار الإجراءات */}
          <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-gray-200">
            {!generatedQuote ? (
              <>
                <Button
                  onClick={generateQuote}
                  disabled={loading || billboards.length === 0 || !customerInfo.name || !customerInfo.email || !customerInfo.phone}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  {loading ? 'جاري الحساب...' : 'إنشاء عرض السعر'}
                </Button>
                <Button
                  onClick={() => {
                    setBillboards([])
                    setCalculations([])
                    setCustomerInfo({ name: '', email: '', phone: '', company: '' })
                    setError('')
                  }}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <X className="w-5 h-5 mr-2" />
                  إعادة تعيين
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={printQuote}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8"
                >
                  <Printer className="w-5 h-5 mr-2" />
                  طباعة العرض
                </Button>
                <Button
                  onClick={() => setGeneratedQuote(null)}
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  إنشاء عرض جديد
                </Button>
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <X className="w-5 h-5 mr-2" />
                  إغلاق
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhancedPricingCalculator