import { supabase } from '@/supabaseClient'
import { BillboardSize, PriceListType } from '@/types'
import { formatGregorianDate } from '@/lib/dateUtils'

export type CustomerType = 'عادي' | 'مسوق' | 'شركات' | 'المدينة'
export type PricingMode = 'daily' | 'package'

export interface PricingRow {
  id?: number
  المقاس: string
  المستوى: PriceListType
  الزبون: CustomerType
  'شهر واحد'?: number
  '2 أشهر'?: number
  '3 أشهر'?: number
  '6 أشهر'?: number
  'سنة كاملة'?: number
  'يوم واحد'?: number
}

export interface BillboardPricingData {
  id: string
  name: string
  size: string
  municipality: string
  level: PriceListType
  status: string
  location: string
  imageUrl?: string
}

export interface PricingCalculation {
  billboard: BillboardPricingData
  basePrice: number
  dailyPrice: number
  totalDays: number
  subtotal: number
  installationPrice: number
  total: number
}

export interface PricingQuote {
  id: string
  customerInfo: {
    name: string
    email: string
    phone: string
    company?: string
    customerType: CustomerType
  }
  pricingMode: PricingMode
  startDate: string
  endDate?: string
  packageDuration?: string
  billboards: PricingCalculation[]
  subtotal: number
  totalInstallation: number
  grandTotal: number
  currency: string
  createdAt: string
  validUntil: string
}

export interface PackageOption {
  key: keyof PricingRow
  label: string
  duration: number // بالأيام
}

class EnhancedPricingService {
  private readonly CACHE_KEY = 'enhanced_pricing_cache'
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 دقائق

  /**
   * الحصول على جميع بيانات الأسعار من Supabase
   */
  async getAllPricingData(): Promise<PricingRow[]> {
    try {
      // محاولة الحصول من Cache أولاً
      const cached = this.getCachedData()
      if (cached) return cached

      if (!supabase) {
        console.warn('Supabase غير متاح، استخدام البيانات الافتراضية')
        return this.getFallbackData()
      }

      const { data, error } = await supabase
        .from('pricing_ar')
        .select('*')
        .order('id', { ascending: true })

      if (error) {
        console.error('خطأ في تحميل البيانات من Supabase:', error)
        return this.getFallbackData()
      }

      const rows = (data || []) as PricingRow[]
      
      // حفظ في Cache
      this.setCachedData(rows)
      
      console.log(`✅ تم تحميل ${rows.length} صف من جدول pricing_ar`)
      return rows

    } catch (error) {
      console.error('خطأ في الحصول على البيانات:', error)
      return this.getFallbackData()
    }
  }

  /**
   * الحصول على الباقات المتاحة
   */
  getPackageOptions(): PackageOption[] {
    return [
      { key: 'شهر واحد', label: 'شهر واحد', duration: 30 },
      { key: '2 أشهر', label: '2 أشهر', duration: 60 },
      { key: '3 أشهر', label: '3 أشهر', duration: 90 },
      { key: '6 أشهر', label: '6 أشهر', duration: 180 },
      { key: 'سنة كاملة', label: 'سنة كاملة', duration: 365 }
    ]
  }

  /**
   * البحث عن السعر المناسب للوحة
   */
  async findPriceForBillboard(
    size: string,
    level: PriceListType,
    customerType: CustomerType,
    pricingKey: keyof PricingRow
  ): Promise<number> {
    try {
      const pricingData = await this.getAllPricingData()
      
      const row = pricingData.find(r => 
        r.المقاس === size && 
        r.المستوى === level && 
        r.الزبون === customerType
      )

      if (!row) {
        console.warn(`لم يتم العثور على سعر للمواصفات: ${size} ${level} ${customerType}`)
        return 0
      }

      const price = row[pricingKey]
      return typeof price === 'number' ? price : 0

    } catch (error) {
      console.error('خطأ في البحث عن السعر:', error)
      return 0
    }
  }

  /**
   * حساب السعر اليومي
   */
  async calculateDailyPrice(
    billboard: BillboardPricingData,
    customerType: CustomerType,
    startDate: string,
    endDate: string,
    includeInstallation: boolean = false
  ): Promise<PricingCalculation> {
    const dailyPrice = await this.findPriceForBillboard(
      billboard.size,
      billboard.level,
      customerType,
      'يوم واحد'
    )

    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const subtotal = dailyPrice * totalDays
    const installationPrice = includeInstallation ? await this.getInstallationPrice(billboard.size, billboard.municipality) : 0
    const total = subtotal + installationPrice

    return {
      billboard,
      basePrice: dailyPrice,
      dailyPrice,
      totalDays,
      subtotal,
      installationPrice,
      total
    }
  }

  /**
   * حساب سعر الباقة
   */
  async calculatePackagePrice(
    billboard: BillboardPricingData,
    customerType: CustomerType,
    packageOption: PackageOption,
    includeInstallation: boolean = false
  ): Promise<PricingCalculation> {
    const packagePrice = await this.findPriceForBillboard(
      billboard.size,
      billboard.level,
      customerType,
      packageOption.key
    )

    const installationPrice = includeInstallation ? await this.getInstallationPrice(billboard.size, billboard.municipality) : 0
    const total = packagePrice + installationPrice

    return {
      billboard,
      basePrice: packagePrice,
      dailyPrice: Math.round(packagePrice / packageOption.duration),
      totalDays: packageOption.duration,
      subtotal: packagePrice,
      installationPrice,
      total
    }
  }

  /**
   * حساب سعر التركيب (افتراضي بناءً على المقاس)
   */
  async getInstallationPrice(size: string, municipality: string): Promise<number> {
    // أسعار تركيب افتراضية حسب المقاس
    const installationPrices: Record<string, number> = {
      '13x5': 1500,
      '12x4': 1200,
      '10x4': 1000,
      '8x3': 800,
      '6x3': 600,
      '4x3': 500
    }

    // معاملات البلديات لأسعار التركيب
    const municipalityMultipliers: Record<string, number> = {
      'مصراتة': 1.0,
      'طرابلس': 1.1,
      'بنغازي': 1.2,
      'زليتن': 0.9,
      'أبو سليم': 1.1
    }

    const basePrice = installationPrices[size] || 500
    const multiplier = municipalityMultipliers[municipality] || 1.0

    return Math.round(basePrice * multiplier)
  }

  /**
   * حساب عدة لوحات
   */
  async calculateMultipleBillboards(
    billboards: BillboardPricingData[],
    customerType: CustomerType,
    pricingMode: PricingMode,
    startDate: string,
    endDate?: string,
    packageOption?: PackageOption,
    includeInstallation: boolean = false
  ): Promise<PricingCalculation[]> {
    const calculations: PricingCalculation[] = []

    for (const billboard of billboards) {
      let calculation: PricingCalculation

      if (pricingMode === 'daily' && endDate) {
        calculation = await this.calculateDailyPrice(
          billboard,
          customerType,
          startDate,
          endDate,
          includeInstallation
        )
      } else if (pricingMode === 'package' && packageOption) {
        calculation = await this.calculatePackagePrice(
          billboard,
          customerType,
          packageOption,
          includeInstallation
        )
      } else {
        throw new Error('معاملات الحساب غير صحيحة')
      }

      calculations.push(calculation)
    }

    return calculations
  }

  /**
   * إنشاء عرض سعر شامل
   */
  async generateQuote(
    customerInfo: PricingQuote['customerInfo'],
    billboards: BillboardPricingData[],
    pricingMode: PricingMode,
    startDate: string,
    endDate?: string,
    packageOption?: PackageOption,
    includeInstallation: boolean = false
  ): Promise<PricingQuote> {
    const calculations = await this.calculateMultipleBillboards(
      billboards,
      customerInfo.customerType,
      pricingMode,
      startDate,
      endDate,
      packageOption,
      includeInstallation
    )

    const subtotal = calculations.reduce((sum, calc) => sum + calc.subtotal, 0)
    const totalInstallation = calculations.reduce((sum, calc) => sum + calc.installationPrice, 0)
    const grandTotal = subtotal + totalInstallation

    // حساب تاريخ النهاية للباقات
    let finalEndDate = endDate
    if (pricingMode === 'package' && packageOption) {
      const start = new Date(startDate)
      const end = new Date(start)
      end.setDate(end.getDate() + packageOption.duration)
      finalEndDate = end.toISOString().split('T')[0]
    }

    const quote: PricingQuote = {
      id: `Q-${Date.now()}`,
      customerInfo,
      pricingMode,
      startDate,
      endDate: finalEndDate,
      packageDuration: packageOption?.label,
      billboards: calculations,
      subtotal,
      totalInstallation,
      grandTotal,
      currency: 'د.ل',
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    return quote
  }

  /**
   * طباعة عرض السعر
   */
  printQuote(quote: PricingQuote): void {
    const printContent = this.generateQuoteHTML(quote)
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  /**
   * إنشاء HTML لعرض السعر
   */
  private generateQuoteHTML(quote: PricingQuote): string {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>عرض سعر - ${quote.id}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Tajawal', Arial, sans-serif; 
            direction: rtl; 
            background: white; 
            color: #000; 
            line-height: 1.6; 
            font-size: 14px; 
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 30px; 
            padding: 20px 0; 
            border-bottom: 4px solid #D4AF37; 
          }
          .logo-section { 
            display: flex; 
            align-items: center; 
            gap: 20px; 
          }
          .company-info { 
            text-align: right; 
          }
          .company-name { 
            font-size: 24px; 
            font-weight: 800; 
            color: #000; 
            margin-bottom: 8px; 
          }
          .company-subtitle { 
            font-size: 16px; 
            color: #666; 
            font-weight: 600;
          }
          .quote-info { 
            text-align: left; 
          }
          .quote-title { 
            font-size: 28px; 
            font-weight: 800; 
            color: #D4AF37; 
            margin-bottom: 12px; 
          }
          .quote-details { 
            font-size: 14px; 
            color: #666; 
            line-height: 1.8;
          }
          .customer-section { 
            background: linear-gradient(135deg, #f8f9fa, #e9ecef); 
            padding: 20px; 
            border-radius: 12px; 
            margin-bottom: 30px; 
            border: 2px solid #D4AF37;
          }
          .customer-title { 
            font-size: 20px; 
            font-weight: 800; 
            margin-bottom: 15px; 
            color: #000; 
          }
          .customer-details { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 15px; 
            font-size: 15px;
          }
          .pricing-info {
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 25px;
            border: 2px solid #f39c12;
          }
          .pricing-title {
            font-size: 18px;
            font-weight: 800;
            color: #d68910;
            margin-bottom: 10px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 25px; 
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          th, td { 
            border: 1px solid #D4AF37; 
            padding: 12px 8px; 
            text-align: center; 
            font-size: 13px;
          }
          th { 
            background: linear-gradient(135deg, #D4AF37, #F4E04D); 
            color: #000; 
            font-weight: 800; 
            font-size: 14px;
          }
          tr:nth-child(even) { 
            background: #f8f9fa; 
          }
          .totals-section { 
            text-align: left; 
            margin-top: 25px; 
          }
          .totals-table { 
            border: none; 
            width: 350px; 
            margin-left: auto; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-radius: 12px;
            overflow: hidden;
          }
          .totals-table td { 
            border: 1px solid #ddd; 
            padding: 12px 20px; 
            font-weight: 700; 
            font-size: 15px;
          }
          .total-row { 
            background: linear-gradient(135deg, #D4AF37, #F4E04D); 
            color: #000; 
            font-weight: 800; 
            font-size: 18px; 
          }
          .installation-row {
            background: linear-gradient(135deg, #17a2b8, #138496);
            color: white;
            font-weight: 700;
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 25px; 
            border-top: 3px solid #D4AF37; 
            text-align: center; 
            font-size: 13px; 
            color: #666; 
          }
          .price-highlight {
            color: #D4AF37;
            font-weight: 800;
          }
          @media print { 
            body { 
              print-color-adjust: exact; 
              -webkit-print-color-adjust: exact; 
            } 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-section">
            <div class="company-info">
              <div class="company-name">الفــــارس الذهبــــي</div>
              <div class="company-subtitle">للدعــــــاية والإعـــلان</div>
            </div>
          </div>
          <div class="quote-info">
            <div class="quote-title">عرض سعر</div>
            <div class="quote-details">
              <div><strong>رقم العرض:</strong> ${quote.id}</div>
              <div><strong>التاريخ:</strong> ${formatGregorianDate(quote.createdAt)}</div>
              <div><strong>صالح حتى:</strong> ${formatGregorianDate(quote.validUntil)}</div>
            </div>
          </div>
        </div>

        <div class="customer-section">
          <div class="customer-title">معلومات العميل</div>
          <div class="customer-details">
            <div><strong>الاسم:</strong> ${quote.customerInfo.name}</div>
            <div><strong>نوع العميل:</strong> ${quote.customerInfo.customerType}</div>
            <div><strong>البريد الإلكتروني:</strong> ${quote.customerInfo.email}</div>
            <div><strong>رقم الهاتف:</strong> ${quote.customerInfo.phone}</div>
            ${quote.customerInfo.company ? `<div><strong>الشركة:</strong> ${quote.customerInfo.company}</div>` : ''}
          </div>
        </div>

        <div class="pricing-info">
          <div class="pricing-title">تفاصيل التسعير</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; font-size: 14px;">
            <div><strong>نوع التسعير:</strong> ${quote.pricingMode === 'daily' ? 'يومي' : 'باقة'}</div>
            <div><strong>تاريخ البداية:</strong> ${formatGregorianDate(quote.startDate)}</div>
            <div><strong>تاريخ النهاية:</strong> ${quote.endDate ? formatGregorianDate(quote.endDate) : 'غير محدد'}</div>
            ${quote.packageDuration ? `<div><strong>مدة الباقة:</strong> ${quote.packageDuration}</div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>م</th>
              <th>اسم اللوحة</th>
              <th>الموقع</th>
              <th>البلدية</th>
              <th>المقاس</th>
              <th>المستوى</th>
              <th>${quote.pricingMode === 'daily' ? 'السعر اليومي' : 'سعر الباقة'}</th>
              <th>${quote.pricingMode === 'daily' ? 'عدد الأيام' : 'المدة'}</th>
              <th>سعر التركيب</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${quote.billboards.map((calc, index) => `
              <tr>
                <td>${index + 1}</td>
                <td style="text-align: right; font-weight: 600;">${calc.billboard.name}</td>
                <td style="text-align: right;">${calc.billboard.location}</td>
                <td>${calc.billboard.municipality}</td>
                <td><strong>${calc.billboard.size}</strong></td>
                <td><strong>${calc.billboard.level}</strong></td>
                <td class="price-highlight">${calc.basePrice.toLocaleString()} ${quote.currency}</td>
                <td>${calc.totalDays} ${quote.pricingMode === 'daily' ? 'يوم' : 'يوم'}</td>
                <td class="price-highlight">${calc.installationPrice.toLocaleString()} ${quote.currency}</td>
                <td class="price-highlight"><strong>${calc.total.toLocaleString()} ${quote.currency}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td>إجمالي الإعلانات:</td>
              <td class="price-highlight">${quote.subtotal.toLocaleString()} ${quote.currency}</td>
            </tr>
            ${quote.totalInstallation > 0 ? `
            <tr class="installation-row">
              <td>إجمالي التركيب:</td>
              <td>${quote.totalInstallation.toLocaleString()} ${quote.currency}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td>الإجمالي النهائي:</td>
              <td>${quote.grandTotal.toLocaleString()} ${quote.currency}</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          <p><strong>شركة الفارس الذهبي للدعاية والإعلان</strong></p>
          <p>زليتن - ليبيا | هاتف: +218.91.322.8908</p>
          <p>هذا عرض أسعار صالح لمدة 30 يوماً من تاريخ الإصدار</p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 1000);
            }, 500);
          };
        </script>
      </body>
      </html>
    `
  }

  /**
   * حساب متوسط السعر اليومي للحملة
   */
  calculateAverageDailyPrice(calculations: PricingCalculation[]): number {
    if (calculations.length === 0) return 0
    
    const totalDailyPrice = calculations.reduce((sum, calc) => sum + calc.dailyPrice, 0)
    return Math.round(totalDailyPrice / calculations.length)
  }

  /**
   * الحصول على إحصائيات الحملة
   */
  getCampaignStats(calculations: PricingCalculation[]): {
    totalBillboards: number
    totalDays: number
    averageDailyPrice: number
    sizeBreakdown: Record<string, number>
    municipalityBreakdown: Record<string, number>
    levelBreakdown: Record<string, number>
  } {
    const sizeBreakdown: Record<string, number> = {}
    const municipalityBreakdown: Record<string, number> = {}
    const levelBreakdown: Record<string, number> = {}

    calculations.forEach(calc => {
      // تجميع حسب المقاس
      sizeBreakdown[calc.billboard.size] = (sizeBreakdown[calc.billboard.size] || 0) + 1
      
      // تجميع حسب البلدية
      municipalityBreakdown[calc.billboard.municipality] = (municipalityBreakdown[calc.billboard.municipality] || 0) + 1
      
      // تجميع حسب المستوى
      levelBreakdown[calc.billboard.level] = (levelBreakdown[calc.billboard.level] || 0) + 1
    })

    return {
      totalBillboards: calculations.length,
      totalDays: calculations.length > 0 ? calculations[0].totalDays : 0,
      averageDailyPrice: this.calculateAverageDailyPrice(calculations),
      sizeBreakdown,
      municipalityBreakdown,
      levelBreakdown
    }
  }

  /**
   * تحديث بيانات الأسعار في Supabase
   */
  async updatePricingData(csvData: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      if (!supabase) {
        return { success: false, imported: 0, errors: ['Supabase غير متاح'] }
      }

      // تحليل بيانات CSV
      const lines = csvData.trim().split('\n')
      const headers = lines[0].split(',')
      const rows: PricingRow[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',')
        const row: any = {}
        
        headers.forEach((header, index) => {
          const value = values[index]?.trim()
          if (header === 'id') {
            row.id = parseInt(value) || undefined
          } else if (['شهر واحد', '2 أشهر', '3 أشهر', '6 أشهر', 'سنة كاملة', 'يوم واحد'].includes(header)) {
            row[header] = parseInt(value) || 0
          } else {
            row[header] = value || ''
          }
        })
        
        if (row.المقاس && row.المستوى && row.الزبون) {
          rows.push(row)
        }
      }

      // حذف البيانات الموجودة
      await supabase.from('pricing_ar').delete().neq('id', -1)

      // إدراج البيانات الجديدة
      const { error } = await supabase.from('pricing_ar').insert(rows)

      if (error) {
        return { success: false, imported: 0, errors: [error.message] }
      }

      // مسح Cache
      this.clearCache()

      return { success: true, imported: rows.length, errors: [] }

    } catch (error: any) {
      return { success: false, imported: 0, errors: [error.message] }
    }
  }

  /**
   * مساعدات Cache
   */
  private getCachedData(): PricingRow[] | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY)
      if (!cached) return null

      const { data, timestamp } = JSON.parse(cached)
      const now = Date.now()

      if (now - timestamp > this.CACHE_DURATION) {
        this.clearCache()
        return null
      }

      return data
    } catch {
      return null
    }
  }

  private setCachedData(data: PricingRow[]): void {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      }
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData))
    } catch {
      // تجاهل أخطاء Cache
    }
  }

  private clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY)
    } catch {
      // تجاهل أخطاء Cache
    }
  }

  /**
   * بيانات احتياطية
   */
  private getFallbackData(): PricingRow[] {
    return [
      {
        id: 1,
        المقاس: '13x5',
        المستوى: 'A',
        الزبون: 'عادي',
        'شهر واحد': 24000,
        '2 أشهر': 23000,
        '3 أشهر': 22000,
        '6 أشهر': 21000,
        'سنة كاملة': 20000,
        'يوم واحد': 800
      },
      {
        id: 2,
        المقاس: '12x4',
        المستوى: 'A',
        الزبون: 'عادي',
        'شهر واحد': 21000,
        '2 أشهر': 20000,
        '3 أشهر': 19000,
        '6 أشهر': 18000,
        'سنة كاملة': 17000,
        'يوم واحد': 700
      }
    ]
  }
}

export const enhancedPricingService = new EnhancedPricingService()