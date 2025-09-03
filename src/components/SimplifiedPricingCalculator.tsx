import React, { useState, useEffect } from 'react'
import { Calculator, DollarSign, MapPin, Clock, Users, Building2, Wrench, FileText, Download, X, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { newPricingService } from '@/services/newPricingService'
import { arabicPricingService } from '@/services/arabicPricingService'
import { BillboardSize, PriceListType, CustomerType, Billboard } from '@/types'

interface PricingCalculation {
  basePrice: number
  municipalityMultiplier: number
  durationDiscount: number
  installationCost: number
  finalPrice: number
  dailyRate: number
  breakdown: string[]
}

interface SimplifiedPricingCalculatorProps {
  onClose: () => void
  selectedBillboards?: string[] // معرفات اللوحات المختارة
  allBillboards?: Billboard[] // جميع اللوحات للمراجعة
}

const SimplifiedPricingCalculator: React.FC<SimplifiedPricingCalculatorProps> = ({
  onClose,
  selectedBillboards,
  allBillboards
}) => {
  // State for pricing inputs
  const [selectedSize, setSelectedSize] = useState<BillboardSize>('5x13')
  const [selectedLevel, setSelectedLevel] = useState<PriceListType>('A')
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('مصراتة')
  const [selectedCustomerType, setSelectedCustomerType] = useState<CustomerType>('individuals')
  const [pricingMode, setPricingMode] = useState<'daily' | 'package'>('daily')
  // Daily mode dates
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  // Package mode start date and duration
  const [packageStartDate, setPackageStartDate] = useState<string>('')
  const [packageDuration, setPackageDuration] = useState<number>(30)
  // Installation
  const [installationCost, setInstallationCost] = useState<number>(0)
  const [installationCosts, setInstallationCosts] = useState<Record<string, number>>({})
  const [needInstallation, setNeedInstallation] = useState<boolean>(false)
  
  // Customer information for quote
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    company: '',
    phone: '',
    email: ''
  })

  // Available options
  const [availableSizes, setAvailableSizes] = useState<BillboardSize[]>([])
  const [availableMunicipalities, setAvailableMunicipalities] = useState<string[]>([])
  const [calculation, setCalculation] = useState<PricingCalculation | null>(null)

  // Selected billboards data
  const [selectedBillboardsData, setSelectedBillboardsData] = useState<Billboard[]>([])
  const [calculationMode, setCalculationMode] = useState<'single' | 'multiple'>('single')
  const [multipleCalculations, setMultipleCalculations] = useState<Array<{
    billboard: Billboard
    calculation: PricingCalculation
  }>>([])
  const [totalCalculation, setTotalCalculation] = useState<{
    totalPrice: number
    totalDailyRate: number
    count: number
  }>({ totalPrice: 0, totalDailyRate: 0, count: 0 })

  // Load available options and selected billboards
  useEffect(() => {
    const pricing = newPricingService.getPricing()
    setAvailableSizes(['5x13', '4x12', '4x10', '3x8', '3x6', '3x4'])
    setAvailableMunicipalities(Object.keys(pricing.zones))

    // Check if we have selected billboards
    if (selectedBillboards && selectedBillboards.length > 0 && allBillboards) {
      const selectedData = allBillboards.filter(billboard => selectedBillboards.includes(billboard.id))
      setSelectedBillboardsData(selectedData)
      setCalculationMode('multiple')
      // في وضع اللوحات المختارة، اجعل العميل يحدد المدة فقط
      setPricingMode('package')
      setSelectedCustomerType('individuals')

      // Set default municipality from first selected billboard
      if (selectedData.length > 0) {
        setSelectedMunicipality(selectedData[0].municipality || 'مصراتة')
      }
    } else {
      setCalculationMode('single')
    }
  }, [selectedBillboards, allBillboards])

  // Calculate pricing when inputs change
  useEffect(() => {
    if (calculationMode === 'single') {
      calculatePricing()
    } else {
      calculateMultipleBillboards()
    }
  }, [selectedSize, selectedLevel, selectedMunicipality, selectedCustomerType, pricingMode, startDate, endDate, packageStartDate, packageDuration, installationCost, installationCosts, needInstallation, calculationMode, selectedBillboardsData])

  const calculatePricing = async () => {
    try {
      let basePrice = 0
      let breakdown: string[] = []

      // Determine duration in days for Arabic pricing table
      const daysInPackage = packageDuration === 30 ? 30 : packageDuration === 60 ? 60 : packageDuration === 90 ? 90 : packageDuration === 180 ? 180 : 365

      if (pricingMode === 'daily') {
        // Use Arabic pricing (يوم واحد) as daily base, multiply by days count
        basePrice = await arabicPricingService.getPrice(
          selectedSize,
          selectedLevel,
          selectedCustomerType,
          1
        )
        breakdown.push(`السعر الأساسي اليومي (${selectedCustomerType}): ${basePrice.toLocaleString()} د.ل`)
      } else {
        // Use Arabic pricing for the selected package duration
        basePrice = await arabicPricingService.getPrice(
          selectedSize,
          selectedLevel,
          selectedCustomerType,
          daysInPackage
        )
        breakdown.push(`سعر الباقة الأساسي (مستوى ${selectedLevel} • ${daysInPackage} يوم): ${basePrice.toLocaleString()} د.ل`)
      }

      const municipalityMultiplier = 1.0

      let finalPrice = basePrice
      let dailyRate = basePrice

      if (pricingMode === 'daily') {
        const sd = startDate ? new Date(startDate) : null
        const ed = endDate ? new Date(endDate) : null
        const numDays = (sd && ed) ? Math.max(Math.ceil((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24)) + 1, 0) : 0
        finalPrice = basePrice * numDays
        breakdown.push(`إجمالي ${numDays} أيام: ${finalPrice.toLocaleString()} د.ل`)
        dailyRate = basePrice
      } else {
        dailyRate = basePrice > 0 ? basePrice / daysInPackage : 0
        breakdown.push(`السعر اليومي للباقة: ${dailyRate.toFixed(2)} د.ل`)
      }

      // Add installation cost if needed
      let totalInstallationCost = 0
      if (needInstallation && installationCost > 0) {
        totalInstallationCost = installationCost
        finalPrice += totalInstallationCost
        breakdown.push(`تكلفة التركيب: ${totalInstallationCost.toLocaleString()} د.ل`)
      }

      // Apply company discount if applicable
      if (selectedCustomerType === 'companies') {
        const discount = Math.round(finalPrice * 0.05) // 5% discount for companies
        finalPrice -= discount
        breakdown.push(`خصم الشركات (5%): -${discount.toLocaleString()} د.ل`)
      } else if (selectedCustomerType === 'marketers') {
        const discount = Math.round(finalPrice * 0.15) // 15% discount for marketers
        finalPrice -= discount
        breakdown.push(`خصم المسوقي�� (15%): -${discount.toLocaleString()} د.ل`)
      }

      breakdown.push(`السعر النهائي: ${finalPrice.toLocaleString()} د.ل`)

      setCalculation({
        basePrice,
        municipalityMultiplier,
        durationDiscount: 0,
        installationCost: totalInstallationCost,
        finalPrice,
        dailyRate,
        breakdown
      })

    } catch (error) {
      console.error('خطأ في حساب التسعير:', error)
    }
  }

  const calculateMultipleBillboards = async () => {
    try {
      const calculations: Array<{billboard: Billboard, calculation: PricingCalculation}> = []
      let totalPrice = 0
      let totalDailyRate = 0

      if (selectedBillboardsData.length === 0) {
        setMultipleCalculations([])
        setTotalCalculation({ totalPrice: 0, totalDailyRate: 0, count: 0 })
        return
      }

      for (const billboard of selectedBillboardsData) {
        const size = billboard.size as BillboardSize
        const municipality = billboard.municipality || selectedMunicipality
        const level = billboard.level === 'A' ? 'A' : 'B' as PriceListType

        let basePrice = 0
        let breakdown: string[] = []

        const daysInPackage = packageDuration === 30 ? 30 : packageDuration === 60 ? 60 : packageDuration === 90 ? 90 : packageDuration === 180 ? 180 : 365

        if (pricingMode === 'daily') {
          basePrice = await arabicPricingService.getPrice(
            size,
            level,
            selectedCustomerType,
            1
          )
          breakdown.push(`السعر ��لأساسي اليومي (${selectedCustomerType}): ${basePrice.toLocaleString()} د.ل`)
        } else {
          basePrice = await arabicPricingService.getPrice(
            size,
            level,
            selectedCustomerType,
            daysInPackage
          )
          breakdown.push(`سعر الباقة الأساسي (مستوى ${level} • ${daysInPackage} يوم): ${basePrice.toLocaleString()} د.ل`)
        }

        let finalPrice = basePrice
        let dailyRate = basePrice

        if (pricingMode === 'daily') {
          const sd = startDate ? new Date(startDate) : null
          const ed = endDate ? new Date(endDate) : null
          const numDays = (sd && ed) ? Math.max(Math.ceil((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24)) + 1, 0) : 0
          finalPrice = basePrice * numDays
          breakdown.push(`إجمالي ${numDays} أيام: ${finalPrice.toLocaleString()} د.ل`)
          dailyRate = basePrice
        } else {
          dailyRate = basePrice > 0 ? basePrice / daysInPackage : 0
          breakdown.push(`السعر اليومي للباقة: ${dailyRate.toFixed(2)} د.ل`)
        }

        // Add installation cost if needed
        let totalInstallationCost = 0
        if (needInstallation) {
          totalInstallationCost = installationCosts[billboard.id] || 0
          if (totalInstallationCost > 0) {
            finalPrice += totalInstallationCost
            breakdown.push(`تكلفة التركيب: ${totalInstallationCost.toLocaleString()} د.ل`)
          }
        }

        // Apply customer discount
        if (selectedCustomerType === 'companies') {
          const discount = Math.round(finalPrice * 0.05)
          finalPrice -= discount
          breakdown.push(`خصم الشركات (5%): -${discount.toLocaleString()} د.ل`)
        } else if (selectedCustomerType === 'marketers') {
          const discount = Math.round(finalPrice * 0.15)
          finalPrice -= discount
          breakdown.push(`خصم المسوقين (15%): -${discount.toLocaleString()} د.ل`)
        }

        breakdown.push(`السعر النهائي: ${finalPrice.toLocaleString()} د.ل`)

        const billboardCalculation: PricingCalculation = {
          basePrice,
          municipalityMultiplier: 1.0,
          durationDiscount: 0,
          installationCost: totalInstallationCost,
          finalPrice,
          dailyRate,
          breakdown
        }

        calculations.push({
          billboard,
          calculation: billboardCalculation
        })

        totalPrice += finalPrice
        totalDailyRate += dailyRate
      }

      setMultipleCalculations(calculations)
      setTotalCalculation({
        totalPrice,
        totalDailyRate,
        count: selectedBillboardsData.length
      })

    } catch (error) {
      console.error('خطأ في حساب التسعير المتعدد:', error)
    }
  }

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price) + ' د.ل'
  }

  const generateQuote = () => {
    if (!customerInfo.name) {
      alert('يرجى ملء معلومات العميل لإنشاء عرض السعر')
      return
    }

    if (calculationMode === 'multiple' && multipleCalculations.length === 0) {
      alert('لا توجد حسابات للوحات المختارة')
      return
    }

    if (calculationMode === 'single' && !calculation) {
      alert('يرجى ��دخال بيانات اللوحة لإنشاء عرض السعر')
      return
    }

    const quoteData = {
      date: new Date().toLocaleDateString('ar-SA'),
      customer: customerInfo,
      mode: calculationMode,
      billing: calculationMode === 'multiple' ? {
        billboards: selectedBillboardsData,
        calculations: multipleCalculations,
        total: totalCalculation
      } : {
        billboard: {
          size: selectedSize,
          level: selectedLevel,
          municipality: selectedMunicipality,
          customerType: selectedCustomerType
        },
        calculation
      },
      pricing: {
        mode: pricingMode,
        days: pricingMode === 'daily' ? (startDate && endDate ? Math.max(Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000*60*60*24)) + 1, 0) : 0) : undefined,
        package: pricingMode === 'package' ? packageDuration : undefined,
        customerType: selectedCustomerType,
        needInstallation,
        installationCost
      }
    }

    // Generate quote document
    const quoteHtml = generateQuoteHTML(quoteData)

    // Open in new window for printing
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(quoteHtml)
      printWindow.document.close()
    }
  }

  const generateQuoteHTML = (data: any) => {
    const isMultiple = data.mode === 'multiple'

    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>عرض سعر - الفارس الذهبي</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: 'Arial', sans-serif; direction: rtl; line-height: 1.6; }
        .header { text-align: center; border-bottom: 3px solid #D4AF37; padding-bottom: 20px; margin-bottom: 30px; }
        .company-name { font-size: 28px; font-weight: bold; color: #D4AF37; margin-bottom: 10px; }
        .quote-title { font-size: 24px; color: #333; margin: 20px 0; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .section-title { font-size: 18px; font-weight: bold; color: #D4AF37; margin-bottom: 10px; }
        .info-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ccc; }
        .breakdown { background: #f9f9f9; padding: 15px; border-radius: 5px; }
        .total { font-size: 20px; font-weight: bold; color: #D4AF37; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; }
        .footer { text-align: center; margin-top: 40px; color: #666; }
        .billboard-item { background: #f8f9fa; margin: 10px 0; padding: 10px; border-radius: 5px; border: 1px solid #ddd; }
        .billboard-price { color: #D4AF37; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background: #D4AF37; color: white; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">الفا��س الذهبي للدعاية والإعلان</div>
        <div>AL FARES AL DAHABI</div>
      </div>

      <div class="quote-title">${isMultiple ? 'عرض سعر حملة إعلانية' : 'عرض سعر لوحة إعلانية'}</div>
      <div>التاريخ: ${data.date}</div>

      <div class="section">
        <div class="section-title">معلومات العميل</div>
        <div class="info-row"><span>الاسم:</span><span>${data.customer.name}</span></div>
        ${data.customer.company ? `<div class="info-row"><span>الشركة:</span><span>${data.customer.company}</span></div>` : ''}
        <div class="info-row"><span>الهاتف:</span><span>${data.customer.phone}</span></div>
        <div class="info-row"><span>البريد الإلكتروني:</span><span>${data.customer.email}</span></div>
      </div>

      ${isMultiple ? `
        <div class="section">
          <div class="section-title">تفاصيل الحملة الإعلانية</div>
          <div class="info-row"><span>عدد اللوحات:</span><span>${data.billing.billboards.length} لوحة</span></div>
          <div class="info-row"><span>نوع التسعير:</span><span>${data.pricing.mode === 'daily' ? 'يومي' : 'باقة'}</span></div>
          ${data.pricing.days ? `<div class="info-row"><span>عدد الأيام:</span><span>${data.pricing.days} يوم</span></div>` : ''}
          ${data.pricing.package ? `<div class="info-row"><span>مدة الباقة:</span><span>${data.pricing.package} يوم</span></div>` : ''}
          ${data.pricing.needInstallation ? `<div class="info-row"><span>تكلفة التركيب:</span><span>${formatPrice(data.pricing.installationCost)} لكل لوحة</span></div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">تفصيل اللوحات والأسعار</div>
          <table>
            <thead>
              <tr>
                <th>م</th>
                <th>اسم اللوحة</th>
                <th>الموقع</th>
                <th>المقاس</th>
                <th>البلدية</th>
                <th>السعر</th>
              </tr>
            </thead>
            <tbody>
              ${data.billing.calculations.map((item: any, index: number) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.billboard.name}</td>
                  <td>${item.billboard.location}</td>
                  <td>${item.billboard.size}</td>
                  <td>${item.billboard.municipality}</td>
                  <td class="billboard-price">${formatPrice(item.calculation.finalPrice)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="total">
          إجمالي الحملة الإعلانية: ${formatPrice(data.billing.total.totalPrice)}
          <br>
          <small style="font-size: 14px; font-weight: normal;">
            (${data.billing.total.count} لوحة • متوسط يومي: ${formatPrice(data.billing.total.totalDailyRate)})
          </small>
        </div>
      ` : `
        <div class="section">
          <div class="section-title">تفاصيل اللوحة</div>
          <div class="info-row"><span>المقاس:</span><span>${data.billing.billboard.size}</span></div>
          <div class="info-row"><span>المستوى:</span><span>${data.billing.billboard.level}</span></div>
          <div class="info-row"><span>البلدية:</span><span>${data.billing.billboard.municipality}</span></div>
          <div class="info-row"><span>نوع ال��ميل:</span><span>${
            data.billing.billboard.customerType === 'individuals' ? 'فرد' :
            data.billing.billboard.customerType === 'companies' ? 'شركة' : 'مسوق'
          }</span></div>
          <div class="info-row"><span>نوع التسعير:</span><span>${data.pricing.mode === 'daily' ? 'يومي' : 'باقة'}</span></div>
          ${data.pricing.days ? `<div class="info-row"><span>عدد الأيام:</span><span>${data.pricing.days} يوم</span></div>` : ''}
          ${data.pricing.package ? `<div class="info-row"><span>مدة الباقة:</span><span>${data.pricing.package} يوم</span></div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">تفصيل الأسعار</div>
          <div class="breakdown">
            ${data.billing.calculation.breakdown.map((item: string) => `<div>${item}</div>`).join('')}
          </div>
        </div>

        <div class="total">
          المبلغ الإجمالي: ${formatPrice(data.billing.calculation.finalPrice)}
        </div>
      `}

      <div class="footer">
        <p>شكراً لثقتكم في الفارس الذهبي للدعاية والإعلان</p>
        <p>ا��عرض صالح لمدة 30 يوماً من تاريخ الإصدار</p>
      </div>
    </body>
    </html>
    `
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Calculator className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {calculationMode === 'multiple' ? 'حاسبة تسعير اللوحات المختارة' : 'حاسبة التسعير المبسطة'}
                </h1>
                <p className="text-sm opacity-90">
                  {calculationMode === 'multiple'
                    ? `احسب أسعار ${selectedBillboardsData.length} لوحة مختارة`
                    : 'احسب أسعار اللوحات الإعلانية بسهولة'
                  }
                </p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              إ��لاق
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
          {/* رسالة إرشادية عندما لا توجد لوحات مختارة */}
          {calculationMode === 'multiple' && selectedBillboardsData.length === 0 && (
            <Card className="mb-6 p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300">
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <List className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-yellow-900 mb-2">لا توجد لوحات مختارة</h3>
                <p className="text-yellow-800 mb-4">
                  لاستخدام هذه الميزة، يرجى اختيار لوحات من الصفحة الرئيسية أولاً، ثم الضغط على "حساب الأسعار"
                </p>
                <Button
                  onClick={() => setCalculationMode('single')}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  التبديل إلى الحساب المنفرد
                </Button>
              </div>
            </Card>
          )}

          {/* عرض اللوحات المختارة */}
          {calculationMode === 'multiple' && selectedBillboardsData.length > 0 && (
            <Card className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
              <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                <List className="w-5 h-5" />
                اللوحات المختارة ({selectedBillboardsData.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                {selectedBillboardsData.map((billboard, index) => (
                  <div
                    key={billboard.id}
                    className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">
                          {billboard.name}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {billboard.location}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {billboard.size}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {billboard.municipality}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center text-sm text-blue-800 mb-2">
                  <div>
                    <div className="font-bold">{[...new Set(selectedBillboardsData.map(b => b.size))].length}</div>
                    <div>مقاسات مختلفة</div>
                  </div>
                  <div>
                    <div className="font-bold">{[...new Set(selectedBillboardsData.map(b => b.municipality))].length}</div>
                    <div>بلديات مختلفة</div>
                  </div>
                  <div>
                    <div className="font-bold">{selectedBillboardsData.filter(b => b.status === 'متاح').length}</div>
                    <div>لوحة متاحة</div>
                  </div>
                </div>
                <div className="text-sm text-blue-800 text-center border-t border-blue-200 pt-2">
                  💡 سيتم حساب سعر كل لوحة بناءً على مواصفاتها الخاصة
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Inputs */}
            <div className="space-y-6">
              {/* نمط الحساب */}
              {selectedBillboardsData.length > 0 && (
                <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
                  <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    نمط الحساب
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => setCalculationMode('multiple')}
                      className={`p-4 h-auto ${
                        calculationMode === 'multiple'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="text-center">
                        <List className="w-6 h-6 mx-auto mb-2" />
                        <div className="font-bold">اللو��ات المختارة</div>
                        <div className="text-xs opacity-75">{selectedBillboardsData.length} لوحة</div>
                      </div>
                    </Button>
                    <Button
                      onClick={() => setCalculationMode('single')}
                      className={`p-4 h-auto ${
                        calculationMode === 'single'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="text-center">
                        <Calculator className="w-6 h-6 mx-auto mb-2" />
                        <div className="font-bold">حساب منفرد</div>
                        <div className="text-xs opacity-75">لو��ة واحدة</div>
                      </div>
                    </Button>
                  </div>
                </Card>
              )}
              {/* Pricing Mode Selection (single mode only) */}
              {calculationMode === 'single' && (
              <Card className="p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  نوع التسعير
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => setPricingMode('daily')}
                    className={`p-4 h-auto ${
                      pricingMode === 'daily'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="text-center">
                      <Clock className="w-6 h-6 mx-auto mb-2" />
                      <div className="font-bold">تسعير يومي</div>
                      <div className="text-xs opacity-75">حساب حسب عدد ��لأيام</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => setPricingMode('package')}
                    className={`p-4 h-auto ${
                      pricingMode === 'package'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="text-center">
                      <Building2 className="w-6 h-6 mx-auto mb-2" />
                      <div className="font-bold">باقة</div>
                      <div className="text-xs opacity-75">أسعار الباقات الثابتة</div>
                    </div>
                  </Button>
                </div>
              </Card>
              )}

              {/* Billboard Specifications */}
              <Card className="p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  مواصفات اللوحة
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">الم��اس</label>
                    <select
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value as BillboardSize)}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    >
                      {availableSizes.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">المستوى</label>
                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value as PriceListType)}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    >
                      <option value="A">مستوى A (مميز)</option>
                      <option value="B">مستوى B (عادي)</option>
                    </select>
                  </div>
                </div>
              </Card>

              {/* Location and Customer */}
              <Card className="p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-600" />
                  الموقع والعميل
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">البلدية</label>
                    <select
                      value={selectedMunicipality}
                      onChange={(e) => setSelectedMunicipality(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    >
                      {availableMunicipalities.map(municipality => (
                        <option key={municipality} value={municipality}>{municipality}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">نوع العميل</label>
                    <select
                      value={selectedCustomerType}
                      onChange={(e) => setSelectedCustomerType(e.target.value as CustomerType)}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    >
                      <option value="individuals">فرد</option>
                      <option value="companies">شركة</option>
                      <option value="marketers">مسوق</option>
                    </select>
                  </div>
                </div>
              </Card>

              {/* Duration */}
              <Card className="p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  المدة الزمنية
                </h3>
                {pricingMode === 'daily' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">تاريخ البداية</label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">تاريخ النهاية</label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">نوع الباقة</label>
                      <select
                        value={packageDuration}
                        onChange={(e) => setPackageDuration(parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      >
                        <option value={30}>شهر واحد</option>
                        <option value={60}>2 أشهر</option>
                        <option value={90}>3 أشهر</option>
                        <option value={180}>6 أشهر</option>
                        <option value={365}>سنة كاملة</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">تاريخ البدء</label>
                      <Input type="date" value={packageStartDate} onChange={(e) => setPackageStartDate(e.target.value)} />
                    </div>
                  </div>
                )}
              </Card>

              {/* Installation */}
              <Card className="p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-red-600" />
                  التركيب
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={needInstallation}
                      onChange={(e) => setNeedInstallation(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-semibold">يحتاج تركيب</span>
                  </label>
                  {needInstallation && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">تكلفة التركيب (د.ل)</label>
                      <Input
                        type="number"
                        value={installationCost}
                        onChange={(e) => setInstallationCost(parseInt(e.target.value) || 0)}
                        min="0"
                        placeholder="أدخل تكلفة التركيب"
                      />
                    </div>
                  )}
                </div>
              </Card>

              {/* Customer Information */}
              <Card className="p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  معلومات العميل
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">الاسم *</label>
                    <Input
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="اسم العميل"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">الشركة</label>
                    <Input
                      value={customerInfo.company}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="اسم الشركة (اختياري)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">الهاتف</label>
                    <Input
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="رقم الهاتف"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">البريد الإلكتروني</label>
                    <Input
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="البريد الإلكتروني"
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Panel - Results */}
            <div className="space-y-6">
              {/* Multiple Billboards Results */}
              {calculationMode === 'multiple' && multipleCalculations.length > 0 && (
                <>
                  {/* Individual Billboard Calculations */}
                  <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 max-h-96 overflow-y-auto">
                    <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-3">
                      <List className="w-5 h-5" />
                      تفصيل أسعار اللوحات
                    </h3>
                    <div className="space-y-3">
                      {multipleCalculations.map(({ billboard, calculation }, index) => (
                        <div key={billboard.id} className="bg-white p-3 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 text-sm">{billboard.name}</div>
                                <div className="text-xs text-gray-600">{billboard.size} • {billboard.municipality} • مستوى {billboard.level}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-blue-700">{formatPrice(calculation.finalPrice)}</div>
                              <div className="text-xs text-blue-600">يومي: {formatPrice(calculation.dailyRate)}</div>
                            </div>
                          </div>
                          {needInstallation && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div className="text-xs text-gray-600">سعر التركيب (لهذه اللوحة):</div>
                              <Input
                                type="number"
                                value={installationCosts[billboard.id] ?? 0}
                                onChange={(e) => setInstallationCosts(prev => ({ ...prev, [billboard.id]: parseInt(e.target.value) || 0 }))}
                                min={0}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Total Calculation for Multiple Billboards */}
                  <Card className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200">
                    <h3 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                        <Calculator className="w-6 h-6 text-white" />
                      </div>
                      الإجمالي ا��نهائي
                    </h3>

                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                        <span className="text-gray-700">��دد اللوحات</span>
                        <span className="font-bold text-emerald-700">{totalCalculation.count} لوحة</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                        <span className="text-gray-700">إجمالي الس��ر</span>
                        <span className="font-bold text-emerald-700">{formatPrice(totalCalculation.totalPrice)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                        <span className="text-gray-700">متوسط السعر اليومي</span>
                        <span className="font-bold text-emerald-700">{formatPrice(totalCalculation.totalDailyRate / totalCalculation.count)}</span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white p-6 rounded-xl text-center">
                      <div className="text-sm opacity-90 mb-2">إجمالي الحملة الإعلانية</div>
                      <div className="text-3xl font-black">{formatPrice(totalCalculation.totalPrice)}</div>
                      <div className="text-sm opacity-90 mt-2">
                        لـ {totalCalculation.count} لوحة • متوسط يومي: {formatPrice(totalCalculation.totalDailyRate)}
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* Single Billboard Calculation */}
              {calculationMode === 'single' && calculation && (
                <Card className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200">
                  <h3 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                      <Calculator className="w-6 h-6 text-white" />
                    </div>
                    حساب التسعير
                  </h3>
                  
                  <div className="space-y-3 mb-6">
                    {calculation.breakdown.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm"
                      >
                        <span className="text-gray-700">{item.split(':')[0]}</span>
                        <span className="font-bold text-emerald-700">{item.split(':')[1]}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white p-6 rounded-xl text-center">
                    <div className="text-sm opacity-90 mb-2">السعر النهائي</div>
                    <div className="text-3xl font-black">{formatPrice(calculation.finalPrice)}</div>
                    <div className="text-sm opacity-90 mt-2">
                      السعر اليومي: {formatPrice(calculation.dailyRate)}
                    </div>
                  </div>
                </Card>
              )}

              {/* Summary */}
              <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  م��خص العرض
                </h3>
                <div className="space-y-2 text-sm">
                  {calculationMode === 'multiple' ? (
                    <>
                      <div className="flex justify-between">
                        <span>عدد الل��حات:</span>
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          {selectedBillboardsData.length} ��وحة
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>المقاسات:</span>
                        <div className="flex flex-wrap gap-1">
                          {[...new Set(selectedBillboardsData.map(b => b.size))].map(size => (
                            <Badge key={size} variant="outline" className="text-xs">
                              {size}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span>البلديات:</span>
                        <div className="flex flex-wrap gap-1">
                          {[...new Set(selectedBillboardsData.map(b => b.municipality))].map(municipality => (
                            <Badge key={municipality} variant="outline" className="text-xs">
                              {municipality}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>المقاس:</span>
                        <Badge variant="outline">{selectedSize}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>المستوى:</span>
                        <Badge variant="outline">مستو�� {selectedLevel}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>البلدية:</span>
                        <Badge variant="outline">{selectedMunicipality}</Badge>
                      </div>
                    </>
                  )}
                  {calculationMode === 'single' && (
                    <>
                    <div className="flex justify-between">
                      <span>نوع العميل:</span>
                      <Badge variant="outline" className={
                        selectedCustomerType === 'companies' ? 'bg-green-100 text-green-800' :
                        selectedCustomerType === 'marketers' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }>
                        {selectedCustomerType === 'individuals' ? 'فرد' :
                         selectedCustomerType === 'companies' ? 'شركة' : 'مسوق'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>نوع التسعير:</span>
                      <Badge variant="outline">{pricingMode === 'daily' ? 'يومي' : 'باقة'}</Badge>
                    </div>
                    </>
                  )}
                  {pricingMode === 'daily' && (
                    <div className="flex justify-between">
                      <span>عدد الأيام:</span>
                      <Badge variant="outline">{daysCount} يوم</Badge>
                    </div>
                  )}
                  {pricingMode === 'package' && (
                    <div className="flex justify-between">
                      <span>مدة الباقة:</span>
                      <Badge variant="outline">
                        {packageDuration === 30 ? 'شهر' :
                         packageDuration === 90 ? '3 أشهر' :
                         packageDuration === 180 ? '6 أشهر' : 'سنة'}
                      </Badge>
                    </div>
                  )}
                  {needInstallation && (
                    <div className="flex justify-between">
                      <span>تكلفة التركيب:</span>
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        {formatPrice(installationCost)}
                      </Badge>
                    </div>
                  )}
                </div>
              </Card>

              {/* Action Buttons */}
              <Card className="p-4">
                <div className="space-y-3">
                  <Button
                    onClick={generateQuote}
                    disabled={!customerInfo.name || (calculationMode === 'single' && !calculation) || (calculationMode === 'multiple' && multipleCalculations.length === 0)}
                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-3"
                  >
                    <FileText className="w-5 h-5 ml-2" />
                    {calculationMode === 'multiple' ? 'إنشاء عرض حملة إعلانية' : 'إنشاء عرض سعر'}
                  </Button>
                  <Button
                    onClick={() => {
                      const data = calculationMode === 'multiple' ? {
                        mode: 'multiple',
                        billboards: selectedBillboardsData.length,
                        calculations: multipleCalculations.map(c => ({
                          billboard: c.billboard.name,
                          size: c.billboard.size,
                          municipality: c.billboard.municipality,
                          price: c.calculation.finalPrice
                        })),
                        total: totalCalculation,
                        customerType: selectedCustomerType,
                        pricingMode: pricingMode,
                        days: pricingMode === 'daily' ? daysCount : undefined,
                        package: pricingMode === 'package' ? packageDuration : undefined
                      } : {
                        mode: 'single',
                        size: selectedSize,
                        level: selectedLevel,
                        municipality: selectedMunicipality,
                        customerType: selectedCustomerType,
                        pricingMode: pricingMode,
                        days: pricingMode === 'daily' ? daysCount : undefined,
                        package: pricingMode === 'package' ? packageDuration : undefined,
                        calculation
                      }
                      navigator.clipboard.writeText(JSON.stringify(data, null, 2))
                      alert('تم نسخ بيانات التسعير!')
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <Download className="w-5 h-5 ml-2" />
                    نسخ ا��بيانات
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimplifiedPricingCalculator
