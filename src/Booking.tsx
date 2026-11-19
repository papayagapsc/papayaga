
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type BookingMode = 'all' | 'playstation'

type Branch = {
  id: string
  name: string
  opens_at: string
  closes_at: string
  billiards_closes_at: string | null
}

type Device = {
  id: string
  name: string
  device_type: string
  branch_id: string
}

type BookedPeriod = {
  booked_start: string
  booked_end: string
}

function Booking({ mode = 'all' }: { mode?: BookingMode }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)

  const [playMode, setPlayMode] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('1')

  const [bookedPeriods, setBookedPeriods] = useState<BookedPeriod[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availabilityMessage, setAvailabilityMessage] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [createdBookingId, setCreatedBookingId] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')

  const [transactionReference, setTransactionReference] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploadingPayment, setUploadingPayment] = useState(false)
  const [paymentSubmitted, setPaymentSubmitted] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const selectedBranchData = branches.find(
    (branch) => branch.id === selectedBranch
  )

  useEffect(() => {
    async function loadBranches() {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, opens_at, closes_at, billiards_closes_at')
        .order('name')

      if (error) {
        setError('حدث خطأ أثناء تحميل الفروع: ' + error.message)
      } else {
        setBranches(data || [])
      }

      setLoading(false)
    }

    loadBranches()
  }, [])

  useEffect(() => {
    async function loadDevices() {
      if (!selectedBranch) {
        setDevices([])
        return
      }

      setSelectedDevice(null)
      setPlayMode('')
      setBookingDate('')
      setStartTime('')
      setBookedPeriods([])
      setAvailabilityMessage('')
      setCreatedBookingId('')
      setSubmitMessage('')
      setPaymentSubmitted(false)
      setPaymentMessage('')
      setProofFile(null)
      setTransactionReference('')

      const { data, error } = await supabase
        .from('devices')
        .select('id, name, device_type, branch_id')
        .eq('branch_id', selectedBranch)
        .order('name')

      if (error) {
        setError('حدث خطأ أثناء تحميل الأجهزة: ' + error.message)
        return
      }

      const loadedDevices = (data || []) as Device[]

      const visibleDevices =
        mode === 'playstation'
          ? loadedDevices.filter(
              (device) =>
                device.device_type === 'playstation_only' ||
                device.device_type === 'room'
            )
          : loadedDevices

      setError('')
      setDevices(visibleDevices)
    }

    loadDevices()
  }, [selectedBranch, mode])

  function getDevicePrice(device: Device) {
    if (device.device_type === 'playstation_only') {
      return playMode === 'multiplayer' ? 100 : 80
    }

    return 80
  }

  function selectDevice(device: Device) {
    setSelectedDevice(device)
    setPlayMode('')
    setBookingDate('')
    setStartTime('')
    setDuration('1')
    setBookedPeriods([])
    setAvailabilityMessage('')
    setCreatedBookingId('')
    setSubmitMessage('')
    setPaymentSubmitted(false)
    setPaymentMessage('')
    setProofFile(null)
    setTransactionReference('')
    setError('')
  }

  function getTodayDate() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  function getBookingDates() {
    if (!bookingDate || !startTime) return null

    const [year, month, day] = bookingDate.split('-').map(Number)
    const [hour, minute] = startTime.split(':').map(Number)

    const start = new Date(year, month - 1, day, hour, minute)
    const end = new Date(
      start.getTime() + Number(duration) * 60 * 60 * 1000
    )

    return { start, end }
  }

  function getBookingIssue(): string | null {
    if (!selectedBranchData || !selectedDevice) return null
    if (!bookingDate || !startTime) return null

    if (
      selectedDevice.device_type === 'playstation_only' &&
      !playMode
    ) {
      return 'اختار وضع اللعب أولاً.'
    }

    const dates = getBookingDates()
    if (!dates) return null

    const { start, end } = dates

    if (start <= new Date()) {
      return 'لا يمكن الحجز في موعد انتهى بالفعل.'
    }

    const closeTime =
      selectedDevice.device_type === 'billiards' &&
      selectedBranchData.billiards_closes_at
        ? selectedBranchData.billiards_closes_at
        : selectedBranchData.closes_at

    const openMinutes =
      Number(selectedBranchData.opens_at.slice(0, 2)) * 60 +
      Number(selectedBranchData.opens_at.slice(3, 5))

    const closeMinutes =
      Number(closeTime.slice(0, 2)) * 60 +
      Number(closeTime.slice(3, 5))

    const [year, month, day] = bookingDate.split('-').map(Number)
    const [hour, minute] = startTime.split(':').map(Number)
    const startMinutes = hour * 60 + minute

    const opening = new Date(year, month - 1, day)
    const closing = new Date(year, month - 1, day)

    if (startMinutes < closeMinutes) {
      opening.setDate(opening.getDate() - 1)
    } else {
      closing.setDate(closing.getDate() + 1)
    }

    opening.setHours(
      Math.floor(openMinutes / 60),
      openMinutes % 60,
      0,
      0
    )

    closing.setHours(
      Math.floor(closeMinutes / 60),
      closeMinutes % 60,
      0,
      0
    )

    if (start < opening || start >= closing) {
      return `هذا الموعد خارج مواعيد الحجز. موعد الفتح ${selectedBranchData.opens_at.slice(0, 5)} وموعد الإغلاق ${closeTime.slice(0, 5)}.`
    }

    if (end > closing) {
      return `مدة الحجز تتجاوز موعد الإغلاق ${closeTime.slice(0, 5)}.`
    }

    return null
  }

  useEffect(() => {
    let cancelled = false

    async function checkAvailability() {
      setBookedPeriods([])
      setAvailabilityMessage('')
      setCheckingAvailability(false)

      if (!selectedDevice || !bookingDate || !startTime) return

      const issue = getBookingIssue()

      if (issue) {
        setAvailabilityMessage(issue)
        return
      }

      const dates = getBookingDates()
      if (!dates) return

      setCheckingAvailability(true)

      const { data, error } = await supabase.rpc(
        'get_device_booked_periods',
        {
          p_device_id: selectedDevice.id,
          p_start: dates.start.toISOString(),
          p_end: dates.end.toISOString(),
        }
      )

      if (cancelled) return

      if (error) {
        setAvailabilityMessage(
          'تعذر فحص المواعيد حاليًا: ' + error.message
        )
        setCheckingAvailability(false)
        return
      }

      const periods = (data || []) as BookedPeriod[]
      setBookedPeriods(periods)

      if (periods.length > 0) {
        setAvailabilityMessage(
          'هذا الجهاز محجوز في الموعد المختار. اختار وقتًا آخر.'
        )
      } else {
        setAvailabilityMessage(
          'الموعد متاح مبدئيًا لهذا الجهاز.'
        )
      }

      setCheckingAvailability(false)
    }

    checkAvailability()

    return () => {
      cancelled = true
    }
  }, [
    selectedDevice,
    bookingDate,
    startTime,
    duration,
    playMode,
    selectedBranchData,
  ])

  async function confirmBooking() {
    setSubmitMessage('')

    const issue = getBookingIssue()

    if (issue) {
      setSubmitMessage(issue)
      return
    }

    if (!selectedBranch || !selectedDevice || !bookingDate || !startTime) {
      setSubmitMessage('من فضلك أكمل بيانات الحجز أولاً.')
      return
    }

    if (checkingAvailability) {
      setSubmitMessage('انتظر حتى ينتهي فحص المواعيد.')
      return
    }

    if (
      availabilityMessage !== 'الموعد متاح مبدئيًا لهذا الجهاز.' ||
      bookedPeriods.length > 0
    ) {
      setSubmitMessage('لا يمكن تسجيل الحجز قبل التأكد من توفر الموعد.')
      return
    }

    const dates = getBookingDates()

    if (!dates) {
      setSubmitMessage('بيانات التاريخ أو الوقت غير صحيحة.')
      return
    }

    setSubmitting(true)

    const { data, error } = await supabase.rpc('create_booking', {
      p_branch_id: selectedBranch,
      p_periods: [
        {
          device_id: selectedDevice.id,
          start_time: dates.start.toISOString(),
          end_time: dates.end.toISOString(),
          play_mode: playMode || null,
        },
      ],
    })

    setSubmitting(false)

    if (error) {
      if (
        error.message.includes('no_overlapping_device_bookings') ||
        error.code === '23P01'
      ) {
        setSubmitMessage(
          'عذرًا، تم حجز الجهاز في هذا الموعد للتو. اختار موعدًا آخر.'
        )
      } else {
        setSubmitMessage('تعذر تسجيل الحجز: ' + error.message)
      }

      return
    }

    setCreatedBookingId(data)

    setSubmitMessage(
      'تم تسجيل طلب الحجز بنجاح. الحجز الآن في انتظار الدفع ومراجعة الإدارة.'
    )
  }

  async function submitPaymentProof() {
    setPaymentMessage('')

    if (!createdBookingId) {
      setPaymentMessage('رقم الحجز غير موجود.')
      return
    }

    if (!transactionReference.trim()) {
      setPaymentMessage('اكتب رقم عملية التحويل أولاً.')
      return
    }

    if (!proofFile) {
      setPaymentMessage('اختار صورة إثبات التحويل أولاً.')
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(proofFile.type)) {
      setPaymentMessage('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP.')
      return
    }

    if (proofFile.size > 5 * 1024 * 1024) {
      setPaymentMessage('حجم الصورة أكبر من 5 ميجابايت.')
      return
    }

    setUploadingPayment(true)

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser()

      if (userError || !userData.user) {
        throw new Error('يجب تسجيل الدخول أولاً.')
      }

      const safeFileName = proofFile.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')

      const filePath =
        `${userData.user.id}/${createdBookingId}/${Date.now()}-${safeFileName}`

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, proofFile, {
          contentType: proofFile.type,
          upsert: false,
        })

      if (uploadError) {
        throw new Error('تعذر رفع الصورة: ' + uploadError.message)
      }

      const { error: insertError } = await supabase
        .from('booking_payments')
        .insert({
          booking_id: createdBookingId,
          customer_id: userData.user.id,
          amount: 50,
          transaction_reference: transactionReference.trim(),
          proof_path: filePath,
          payment_status: 'pending',
        })

      if (insertError) {
        throw new Error(
          'تم رفع الصورة، لكن تعذر تسجيل بيانات الدفع: ' +
          insertError.message
        )
      }

      setPaymentSubmitted(true)
      setPaymentMessage(
        'تم إرسال إثبات التحويل بنجاح. الدفع الآن في انتظار مراجعة الإدارة.'
      )
    } catch (err) {
      setPaymentMessage(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء إرسال إثبات الدفع.'
      )
    } finally {
      setUploadingPayment(false)
    }
  }

  const price = selectedDevice ? getDevicePrice(selectedDevice) : 0
  const totalPrice = price * Number(duration)
  const bookingIssue = getBookingIssue()

  const hasConflict = bookedPeriods.some((period) => {
    const dates = getBookingDates()
    if (!dates) return false

    const bookedStart = new Date(period.booked_start)
    const bookedEnd = new Date(period.booked_end)

    return dates.start < bookedEnd && dates.end > bookedStart
  })

  const canSubmit =
    Boolean(selectedDevice) &&
    Boolean(bookingDate) &&
    Boolean(startTime) &&
    !bookingIssue &&
    !checkingAvailability &&
    !hasConflict &&
    availabilityMessage === 'الموعد متاح مبدئيًا لهذا الجهاز.' &&
    !submitting &&
    !createdBookingId

  return (
    <main className="app booking-page" dir="rtl">
      <section className="booking-section">
        <p className="eyebrow">BOOK YOUR EXPERIENCE</p>

        <h1>احجز تجربتك الآن</h1>

        <p className="booking-description">
          اختار الفرع والجهاز المناسب ليك وابدأ تجربتك مع papa yaga.
        </p>

        {loading ? (
          <p>جارٍ تحميل الفروع...</p>
        ) : (
          <>
            <h2>اختار الفرع</h2>

            <div className="booking-branches">
              {branches.map((branch) => (
                <button
                  key={branch.id}
                  className={
                    selectedBranch === branch.id
                      ? 'branch-option selected'
                      : 'branch-option'
                  }
                  onClick={() => setSelectedBranch(branch.id)}
                >
                  {branch.name}
                </button>
              ))}
            </div>

            {selectedBranch && selectedBranchData && (
              <>
                <p className="booking-description">
                  مواعيد الفرع: من {selectedBranchData.opens_at.slice(0, 5)}
                  {' '}إلى {selectedBranchData.closes_at.slice(0, 5)}
                  {' '}صباحًا في اليوم التالي.
                </p>

                <h2 className="devices-title">اختار الجهاز</h2>

                <div className="booking-devices">
                  {devices.map((device) => (
                    <button
                      type="button"
                      key={device.id}
                      className={
                        selectedDevice?.id === device.id
                          ? 'booking-device selected'
                          : 'booking-device'
                      }
                      onClick={() => selectDevice(device)}
                    >
                      <h3>{device.name}</h3>

                      <p>
                        {device.device_type === 'room'
                          ? 'غرفة PlayStation + Cinema'
                          : device.device_type === 'billiards'
                            ? 'بلياردو'
                            : 'PlayStation مستقل'}
                      </p>

                      {device.device_type === 'billiards' &&
                        selectedBranchData.billiards_closes_at && (
                          <p>
                            آخر موعد للحجز: {selectedBranchData.billiards_closes_at.slice(0, 5)} صباحًا
                          </p>
                        )}

                      <p>اضغط لاختيار الجهاز</p>
                    </button>
                  ))}
                </div>

                {devices.length === 0 && (
                  <p>
                    {mode === 'playstation'
                      ? 'لا توجد أجهزة PlayStation أو غرف PlayStation + Cinema مسجلة في هذا الفرع.'
                      : 'لا توجد أجهزة مسجلة في هذا الفرع.'}
                  </p>
                )}
              </>
            )}

            {selectedDevice && (
              <div className="booking-details">
                <h2>تفاصيل الحجز</h2>

                <p>الجهاز المختار: {selectedDevice.name}</p>

                {selectedDevice.device_type === 'playstation_only' && (
                  <>
                    <h3>اختار وضع اللعب</h3>

                    <div className="booking-branches">
                      <button
                        type="button"
                        className={
                          playMode === 'single'
                            ? 'branch-option selected'
                            : 'branch-option'
                        }
                        onClick={() => setPlayMode('single')}
                      >
                        Single - فردي
                      </button>

                      <button
                        type="button"
                        className={
                          playMode === 'multiplayer'
                            ? 'branch-option selected'
                            : 'branch-option'
                        }
                        onClick={() => setPlayMode('multiplayer')}
                      >
                        Multiplayer - جماعي
                      </button>
                    </div>
                  </>
                )}

                <h3>تاريخ الحجز</h3>

                <input
                  className="booking-input"
                  type="date"
                  min={getTodayDate()}
                  value={bookingDate}
                  onChange={(e) => {
                    setBookingDate(e.target.value)
                    setCreatedBookingId('')
                    setSubmitMessage('')
                  }}
                />

                <h3>وقت بداية الحجز</h3>

                <input
                  className="booking-input"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value)
                    setCreatedBookingId('')
                    setSubmitMessage('')
                  }}
                />

                <h3>مدة الحجز</h3>

                <select
                  className="booking-input"
                  value={duration}
                  onChange={(e) => {
                    setDuration(e.target.value)
                    setCreatedBookingId('')
                    setSubmitMessage('')
                  }}
                >
                  <option value="1">ساعة واحدة</option>
                  <option value="2">ساعتان</option>
                </select>

                {checkingAvailability && (
                  <p className="booking-description">
                    جارٍ فحص المواعيد المتاحة...
                  </p>
                )}

                {availabilityMessage && (
                  <p className={
                    hasConflict ||
                    bookingIssue ||
                    availabilityMessage.includes('تعذر') ||
                    availabilityMessage.includes('محجوز')
                      ? 'booking-error'
                      : 'booking-description'
                  }>
                    {availabilityMessage}
                  </p>
                )}

                <div className="booking-price">
                  <p>سعر الساعة</p>
                  <h3>{price} جنيه</h3>

                  <p>مدة الحجز</p>
                  <h3>{duration === '1' ? 'ساعة واحدة' : 'ساعتان'}</h3>

                  <p>إجمالي سعر الحجز</p>
                  <h3>{totalPrice} جنيه</h3>

                  <p>الديبوزت المطلوب</p>
                  <h3>50 جنيه</h3>
                </div>

                <p className="booking-description">
                  الديبوزت ثابت لكل فترة حجز، والمدة القصوى للفترة الواحدة ساعتان.
                </p>

                {!createdBookingId && (
                  <button
                    type="button"
                    className="main-button"
                    disabled={!canSubmit}
                    onClick={confirmBooking}
                  >
                    {submitting ? 'جارٍ تسجيل الحجز...' : 'تأكيد الحجز'}
                  </button>
                )}

                {submitMessage && (
                  <p className={
                    createdBookingId ? 'booking-description' : 'booking-error'
                  }>
                    {submitMessage}
                  </p>
                )}

                {createdBookingId && (
                  <div className="booking-price">
                    <h3>رقم الحجز</h3>
                    <p dir="ltr">{createdBookingId}</p>
                    <p>حالة الحجز: في انتظار الدفع ومراجعة الإدارة.</p>
                    <p>لم يتم تأكيد الحجز نهائيًا بعد.</p>

                    <hr />

                    <h2>الدفع عن طريق InstaPay</h2>

                    <p>حوّل مبلغ الديبوزت إلى الرقم التالي:</p>

                    <h2 dir="ltr">01019003929</h2>

                    <button
                      type="button"
                      className="main-button"
                      onClick={() => {
                        navigator.clipboard.writeText('01019003929')
                        setPaymentMessage('تم نسخ رقم InstaPay.')
                      }}
                    >
                      نسخ رقم InstaPay
                    </button>

                    <p>مبلغ التحويل المطلوب: 50 جنيه</p>

                    {!paymentSubmitted ? (
                      <>
                        <h3>رقم عملية التحويل</h3>

                        <input
                          className="booking-input"
                          type="text"
                          value={transactionReference}
                          onChange={(e) =>
                            setTransactionReference(e.target.value)
                          }
                          placeholder="اكتب رقم العملية"
                        />

                        <h3>صورة إثبات التحويل</h3>

                        <input
                          className="booking-input"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) =>
                            setProofFile(e.target.files?.[0] || null)
                          }
                        />

                        {proofFile && (
                          <p className="booking-description">
                            الصورة المختارة: {proofFile.name}
                          </p>
                        )}

                        <p className="booking-description">
                          الصيغ المقبولة JPG وPNG وWEBP، والحد الأقصى 5 ميجابايت.
                        </p>

                        <button
                          type="button"
                          className="main-button"
                          disabled={uploadingPayment}
                          onClick={submitPaymentProof}
                        >
                          {uploadingPayment
                            ? 'جارٍ إرسال إثبات الدفع...'
                            : 'إرسال إثبات الدفع'}
                        </button>
                      </>
                    ) : (
                      <p className="booking-description">
                        تم استلام إثبات الدفع، وفي انتظار مراجعة الإدارة.
                      </p>
                    )}

                    {paymentMessage && (
                      <p className={
                        paymentSubmitted
                          ? 'booking-description'
                          : 'booking-error'
                      }>
                        {paymentMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="booking-error">{error}</p>}
      </section>
    </main>
  )
}

export default Booking
