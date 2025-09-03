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
   * حساب