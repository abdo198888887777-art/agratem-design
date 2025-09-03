import React, { useState, useEffect } from 'react'
import {
  Database,
  Upload,
  Download,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Save,
  Trash2,
  Edit3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { enhancedPricingService, PricingRow, CustomerType } from '@/services/enhancedPricingService'
import { PriceListType } from '@/types'

interface PricingDataManagerProps {
  onClose: () => void
}

const PricingDataManager: React.FC<PricingDataManagerProps> = ({ onClose }) => {
  const [pricingData, setPricingData] = useState<PricingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const showNotification = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccess(message)
      setError('')
      setTimeout(() => setSuccess(''), 3000)
    } else {
      setError(message)
      setSuccess('')
      setTimeout(() => setError(''), 5000)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await enhancedPricingService.getAllPricingData()
      setPricingData(data)
      showNotification('success', `تم تحميل ${data.length} صف من قاعدة البيانات`)
    } catch (error: any) {
      showNotification('error', `خطأ في تحميل البيانات: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const text = await file.text()
      const result = await enhancedPricingService.updatePricingData(text)
      
      if (result.success) {
        showNotification('success', `تم استيراد ${result.imported} صف بنجاح`)
        await loadData()
      } else {
        showNotification('error', `فشل الاستيراد: ${result.errors.join(', ')}`)
      }
    } catch (error: any) {
      showNotification('error', `خطأ في قراءة الملف: ${error.message}`)
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  const exportToCSV = () => {
    const headers = ['المقاس', 'المستوى', 'الزبون', 'شهر واحد', '2 أشهر', '3 أشهر', '6 أشهر', 'سنة كاملة', 'يوم واحد', 'id']
    const csvContent = [
      headers.join(','),
      ...pricingData.map(row => [
        row.المقاس,
        row.المستوى,
        row.الزبون,
        row['شهر واحد'] || 0,
        row['2 أشهر'] || 0,
        row['3 أشهر'] || 0,
        row['6 أشهر'] || 0,
        row['سنة كاملة'] || 0,
        row['يوم واحد'] || 0,
        row.id || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `pricing_data_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    
    showNotification('success', 'تم تصدير البيانات بنجاح')
  }

  const startEdit = (rowId: number, column: keyof PricingRow) => {
    const row = pricingData.find(r => r.id === rowId)
    if (!row) return

    const cellKey = `${rowId}-${column}`
    setEditingCell(cellKey)
    setEditingValue(String(row[column] || ''))
  }

  const saveEdit = async () => {
    if (!editingCell) return

    const [rowIdStr, column] = editingCell.split('-')
    const rowId = parseInt(rowIdStr)
    const newValue = parseInt(editingValue) || 0

    // هنا يمكن إضافة منطق تحديث قاعدة البيانات
    const updatedData = pricingData.map(row => 
      row.id === rowId 
        ? { ...row, [column]: newValue }
        : row
    )
    
    setPricingData(updatedData)
    setEditingCell(null)
    setEditingValue('')
    showNotification('success', 'تم تحديث السعر بنجاح')
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  const priceColumns: (keyof PricingRow)[] = ['شهر واحد', '2 أشهر', '3 أشهر', '6 أشهر', 'سنة كاملة', 'يوم واحد']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Database className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">إدارة بيانات الأسعار</h1>
                <p className="text-sm opacity-90">تحديث وإدارة جدول الأسعار في Supabase</p>
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
          {/* Notifications */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-400 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">{success}</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Button
                onClick={loadData}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                تحديث البيانات
              </Button>

              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <Button
                  onClick={() => document.getElementById('csv-upload')?.click()}
                  variant="outline"
                  className="text-green-600 border-green-300"
                  disabled={loading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  استيراد CSV
                </Button>
              </div>

              <Button
                onClick={exportToCSV}
                variant="outline"
                className="text-purple-600 border-purple-300"
              >
                <Download className="w-4 h-4 mr-2" />
                تصدير CSV
              </Button>
            </div>

            <div className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
              <span className="font-semibold">إجمالي الصفوف:</span>
              <Badge className="ml-2 bg-blue-100 text-blue-800">
                {pricingData.length}
              </Badge>
            </div>
          </div>

          {/* Data Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                    <th className="border border-white/20 p-3 text-center font-bold">المقاس</th>
                    <th className="border border-white/20 p-3 text-center font-bold">المستوى</th>
                    <th className="border border-white/20 p-3 text-center font-bold">نوع الزبون</th>
                    {priceColumns.map(column => (
                      <th key={column} className="border border-white/20 p-3 text-center font-bold min-w-[120px]">
                        {column}
                      </th>
                    ))}
                    <th className="border border-white/20 p-3 text-center font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingData.map((row, index) => (
                    <tr key={row.id || index} className={`hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="border border-gray-200 p-3 text-center font-bold text-blue-900 bg-blue-100">
                        {row.المقاس}
                      </td>
                      <td className="border border-gray-200 p-3 text-center">
                        <Badge className={`${row.المستوى === 'A' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                          {row.المستوى}
                        </Badge>
                      </td>
                      <td className="border border-gray-200 p-3 text-center">
                        <Badge className={`${
                          row.الزبون === 'شركات' ? 'bg-purple-100 text-purple-800' :
                          row.الزبون === 'مسوق' ? 'bg-orange-100 text-orange-800' :
                          row.الزبون === 'المدينة' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {row.الزبون}
                        </Badge>
                      </td>
                      {priceColumns.map(column => {
                        const cellKey = `${row.id}-${column}`
                        const value = row[column]
                        const isEditing = editingCell === cellKey
                        
                        return (
                          <td key={column} className="border border-gray-200 p-2 text-center">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-24 text-center text-sm"
                                  autoFocus
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') saveEdit()
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                                <Button onClick={saveEdit} size="sm" className="p-1 bg-green-600 text-white">
                                  <CheckCircle className="w-3 h-3" />
                                </Button>
                                <Button onClick={cancelEdit} size="sm" variant="outline" className="p-1">
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div
                                className="cursor-pointer hover:bg-blue-100 p-2 rounded transition-colors"
                                onClick={() => startEdit(row.id!, column)}
                                title={`تحرير ${column}`}
                              >
                                <span className="font-semibold text-gray-800">
                                  {typeof value === 'number' ? value.toLocaleString() : (value || '0')}
                                </span>
                                <div className="text-xs text-gray-500">د.ل</div>
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="border border-gray-200 p-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Empty State */}
          {pricingData.length === 0 && !loading && (
            <div className="text-center py-12">
              <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">لا توجد بيانات</h3>
              <p className="text-gray-500 mb-4">
                لم يتم تحميل أي بيانات من جدول pricing_ar
              </p>
              <Button
                onClick={loadData}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                إعادة تحميل البيانات
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">جاري تحميل البيانات...</p>
            </div>
          )}

          {/* Instructions */}
          <Card className="mt-6 p-4 bg-blue-50 border-blue-200">
            <h4 className="font-bold text-blue-900 mb-2">تعليمات الاستخدام:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• انقر على أي سعر لتحريره مباشرة</li>
              <li>• استخدم "استيراد CSV" لتحديث جميع البيانات من ملف</li>
              <li>• استخدم "تصدير CSV" لحفظ البيانات الحالية</li>
              <li>• تنسيق CSV المطلوب: المقاس,المستوى,الزبون,شهر واحد,2 أشهر,3 أشهر,6 أشهر,سنة كاملة,يوم واحد,id</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default PricingDataManager