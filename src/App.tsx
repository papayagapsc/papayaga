
import { useEffect, useState } from 'react'
import './App.css'
import Login from './components/Login'
import Booking from './Booking'
import { supabase } from './supabase'

type Section = 'home' | 'bookings' | 'payments' | 'customers' | 'branches'
type Theme = 'light' | 'dark'

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'}
      title={theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}
      style={{
        position: 'fixed',
        bottom: 22,
        left: 22,
        zIndex: 100000,
        padding: '12px 18px',
        borderRadius: 30,
        border: '1px solid var(--border-strong)',
        background: 'var(--surface)',
        color: 'var(--text)',
        boxShadow: '0 4px 18px rgba(0,0,0,.18)',
        cursor: 'pointer',
        fontWeight: 800,
        fontSize: 14,
        direction: 'rtl',
      }}
    >
      {theme === 'light' ? '🌙 الوضع الداكن' : '☀️ الوضع الفاتح'}
    </button>
  )
}

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="العودة إلى الصفحة الرئيسية"
      className="brand-logo"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        direction: 'ltr',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'var(--text)',
        textAlign: 'left',
        boxShadow: 'none',
        transform: 'none',
      }}
    >
      <img
        src="/LOGO.png"
        alt="Papa Yaga Logo"
        style={{
          width: 58,
          height: 58,
          objectFit: 'contain',
          display: 'block',
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          boxShadow: 'none',
        }}
      />

      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 2,
          lineHeight: 1.1,
        }}
      >
        <span
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: 19,
            fontWeight: 900,
            letterSpacing: '1px',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
          }}
        >
          PAPA YAGA
        </span>

        <span
          style={{
            fontFamily: 'Cairo, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--muted)',
            whiteSpace: 'nowrap',
          }}
        >
          بابا ياجا
        </span>
      </span>
    </button>
  )
}

function AdminDashboard({
  onBack,
  theme,
  onToggleTheme,
}: {
  onBack: () => void
  theme: Theme
  onToggleTheme: () => void
}) {
  const [section, setSection] = useState<Section>('home')
  const [bookings, setBookings] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')

  async function loadDashboard() {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.rpc('get_admin_dashboard_data')

    if (error) {
      setMessage('حدث خطأ أثناء تحميل بيانات الإدارة: ' + error.message)
      setLoading(false)
      return
    }

    setBookings(data?.bookings || [])
    setCustomers(data?.customers || [])
    setBranches(data?.branches || [])

    const { data: paymentData, error: paymentError } = await supabase
      .from('booking_payments')
      .select(`
        id,
        booking_id,
        customer_id,
        amount,
        transaction_reference,
        proof_path,
        payment_status,
        rejection_reason,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (paymentError) {
      setMessage('تعذر تحميل المدفوعات: ' + paymentError.message)
      setPayments([])
    } else {
      const paymentsWithImages = await Promise.all(
        (paymentData || []).map(async (payment: any) => {
          if (!payment.proof_path) {
            return { ...payment, proofUrl: null }
          }

          const { data: signedImage } = await supabase
            .storage
            .from('payment-proofs')
            .createSignedUrl(payment.proof_path, 3600)

          return {
            ...payment,
            proofUrl: signedImage?.signedUrl || null,
          }
        })
      )

      setPayments(paymentsWithImages)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  async function cancelBooking(bookingId: string) {
    const confirmed = window.confirm(
      'هل أنت متأكد من إلغاء هذا الحجز؟ سيتم تحرير موعد الجهاز.'
    )

    if (!confirmed) return

    setWorking(true)
    setMessage('')

    const { error } = await supabase.rpc('cancel_booking', {
      p_booking_id: bookingId,
    })

    if (error) {
      setMessage('تعذر إلغاء الحجز: ' + error.message)
    } else {
      setMessage('تم إلغاء الحجز وتحرير موعد الجهاز بنجاح.')
      await loadDashboard()
    }

    setWorking(false)
  }

  async function approvePayment(paymentId: string) {
    const confirmed = window.confirm(
      'هل تأكدت من وصول التحويل البنكي وتريد تأكيد الحجز؟'
    )

    if (!confirmed) return

    setWorking(true)
    setMessage('')

    const { error } = await supabase.rpc('approve_booking_payment', {
      p_payment_id: paymentId,
    })

    if (error) {
      setMessage('تعذر تأكيد الدفع: ' + error.message)
    } else {
      setMessage('تم قبول الدفع وتأكيد الحجز بنجاح.')
      await loadDashboard()
    }

    setWorking(false)
  }

  async function rejectPayment(paymentId: string) {
    const reason = window.prompt('اكتب سبب رفض إثبات التحويل:')

    if (reason === null) return

    if (reason.trim().length < 3) {
      setMessage('يجب كتابة سبب واضح للرفض.')
      return
    }

    setWorking(true)
    setMessage('')

    const { error } = await supabase.rpc('reject_booking_payment', {
      p_payment_id: paymentId,
      p_reason: reason.trim(),
    })

    if (error) {
      setMessage('تعذر رفض الدفع: ' + error.message)
    } else {
      setMessage('تم رفض إثبات الدفع وتسجيل السبب.')
      await loadDashboard()
    }

    setWorking(false)
  }

  const pendingBookings = bookings.filter(
    (booking) => booking.booking_status === 'pending'
  ).length

  const confirmedBookings = bookings.filter(
    (booking) => booking.booking_status === 'confirmed'
  ).length

  const pendingPayments = payments.filter(
    (payment) => payment.payment_status === 'pending'
  ).length

  const cancelledBookings = bookings.filter(
    (booking) => booking.booking_status === 'cancelled'
  ).length

  const buttonStyle = {
    background: 'var(--surface-3)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    padding: '12px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'right' as const,
    fontSize: 14,
  }

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    overflowWrap: 'anywhere' as const,
  }

  function formatDate(value: string) {
    if (!value) return 'غير متاح'

    return new Date(value).toLocaleString('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  function bookingStatus(status: string) {
    if (status === 'confirmed') return 'مؤكد'
    if (status === 'cancelled') return 'ملغي'
    return 'في انتظار المراجعة'
  }

  function paymentStatus(status: string) {
    if (status === 'approved') return 'تم قبول الدفع'
    if (status === 'rejected') return 'مرفوض'
    return 'في انتظار المراجعة'
  }

  function renderBookings() {
    if (bookings.length === 0) {
      return <p>لا توجد حجوزات حتى الآن.</p>
    }

    return bookings.map((booking) => (
      <article key={booking.id} style={cardStyle}>
        <h3>حجز #{booking.id.slice(0, 8)}</h3>
        <p><strong>العميل:</strong> {booking.customer_name || 'غير مسجل'}</p>
        <p><strong>الهاتف:</strong> {booking.customer_phone || 'غير مسجل'}</p>
        <p><strong>البريد:</strong> {booking.customer_email || 'غير مسجل'}</p>
        <p><strong>الفرع:</strong> {booking.branch_name || 'غير معروف'}</p>
        <p><strong>العربون:</strong> {booking.total_deposit} جنيه</p>
        <p><strong>حالة الحجز:</strong> {bookingStatus(booking.booking_status)}</p>
        <p><strong>حالة الدفع:</strong> {booking.payment_status === 'paid' ? 'تم الدفع' : booking.payment_status === 'rejected' ? 'مرفوض' : 'في انتظار الدفع'}</p>
        <p><strong>تاريخ الطلب:</strong> {formatDate(booking.created_at)}</p>

        <h4>الفترات والأجهزة</h4>

        {(booking.periods || []).map((period: any) => (
          <div
            key={period.id}
            style={{
              background: 'var(--surface-2)',
              padding: 12,
              borderRadius: 8,
              marginBottom: 10,
            }}
          >
            <p><strong>الجهاز:</strong> {period.device_name || 'غير معروف'}</p>
            <p><strong>النوع:</strong> {period.device_type || 'غير محدد'}</p>
            <p><strong>من:</strong> {formatDate(period.start_time)}</p>
            <p><strong>إلى:</strong> {formatDate(period.end_time)}</p>
            <p><strong>سعر الساعة:</strong> {period.hourly_rate} جنيه</p>
          </div>
        ))}

        {booking.booking_status !== 'cancelled' && (
          <button
            style={{
              ...buttonStyle,
              background: '#542b29',
              color: '#fff',
              marginTop: 10,
            }}
            disabled={working}
            onClick={() => cancelBooking(booking.id)}
          >
            إلغاء الحجز
          </button>
        )}
      </article>
    ))
  }

  function renderPayments() {
    if (payments.length === 0) {
      return <p>لا توجد طلبات دفع حتى الآن.</p>
    }

    return payments.map((payment) => (
      <article key={payment.id} style={cardStyle}>
        <h3>طلب دفع #{payment.id.slice(0, 8)}</h3>
        <p><strong>رقم الحجز:</strong> {payment.booking_id}</p>
        <p><strong>المبلغ:</strong> {payment.amount} جنيه</p>
        <p><strong>رقم التحويل:</strong> {payment.transaction_reference || 'غير مسجل'}</p>
        <p><strong>الحالة:</strong> {paymentStatus(payment.payment_status)}</p>
        <p><strong>تاريخ الطلب:</strong> {formatDate(payment.created_at)}</p>

        {payment.rejection_reason && (
          <p><strong>سبب الرفض:</strong> {payment.rejection_reason}</p>
        )}

        {payment.proofUrl ? (
          <a
            href={payment.proofUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block',
              color: 'var(--text)',
              margin: '16px 0',
              textDecoration: 'underline',
            }}
          >
            فتح صورة إثبات التحويل
          </a>
        ) : (
          <p>لا توجد صورة إثبات متاحة.</p>
        )}

        {payment.payment_status === 'pending' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              style={{
                ...buttonStyle,
                background: '#28543a',
                color: '#fff',
                flex: 1,
              }}
              disabled={working}
              onClick={() => approvePayment(payment.id)}
            >
              قبول الدفع
            </button>

            <button
              style={{
                ...buttonStyle,
                background: '#542b29',
                color: '#fff',
                flex: 1,
              }}
              disabled={working}
              onClick={() => rejectPayment(payment.id)}
            >
              رفض الدفع
            </button>
          </div>
        )}
      </article>
    ))
  }

  function renderCustomers() {
    if (customers.length === 0) {
      return <p>لا يوجد عملاء حتى الآن.</p>
    }

    return customers.map((customer) => (
      <article key={customer.id} style={cardStyle}>
        <h3>{customer.full_name || 'عميل بدون اسم'}</h3>
        <p><strong>البريد الإلكتروني:</strong> {customer.email || 'غير متاح'}</p>
        <p><strong>رقم الهاتف:</strong> {customer.phone || 'غير مسجل'}</p>
        <p><strong>تاريخ التسجيل:</strong> {formatDate(customer.created_at)}</p>
      </article>
    ))
  }

  function renderBranches() {
    if (branches.length === 0) {
      return <p>لا توجد فروع مسجلة.</p>
    }

    return branches.map((branch) => (
      <article key={branch.id} style={cardStyle}>
        <h3>{branch.name}</h3>
        <p><strong>يفتح:</strong> {branch.opens_at}</p>
        <p><strong>يغلق:</strong> {branch.closes_at}</p>
        <p><strong>إغلاق البلياردو:</strong> {branch.billiards_closes_at || 'غير محدد'}</p>

        <h4>الأجهزة</h4>

        {(branch.devices || []).map((device: any) => (
          <div
            key={device.id}
            style={{
              background: 'var(--surface-2)',
              padding: 12,
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <p><strong>{device.name}</strong></p>
            <p>النوع: {device.device_type}</p>
            <p>PlayStation: {device.has_playstation ? 'نعم' : 'لا'}</p>
            <p>Cinema: {device.has_cinema ? 'نعم' : 'لا'}</p>
          </div>
        ))}
      </article>
    ))
  }

  function renderContent() {
    if (loading) return <p>جارٍ تحميل بيانات الإدارة...</p>

    switch (section) {
      case 'home':
        return (
          <>
            <h2>الرئيسية</h2>
            <p>مرحبًا بك في لوحة إدارة papa yaga.</p>

            <div className="service-grid">
              {[
                ['إجمالي الحجوزات', bookings.length],
                ['حجوزات مؤكدة', confirmedBookings],
                ['حجوزات تنتظر المراجعة', pendingBookings],
                ['حجوزات ملغاة', cancelledBookings],
                ['مدفوعات تنتظر المراجعة', pendingPayments],
                ['إجمالي العملاء', customers.length],
              ].map(([label, value]) => (
                <article className="service-card" key={String(label)}>
                  <h3>{label}</h3>
                  <p style={{ fontSize: 28 }}>{value}</p>
                </article>
              ))}
            </div>
          </>
        )

      case 'bookings':
        return <><h2>إدارة الحجوزات</h2>{renderBookings()}</>
      case 'payments':
        return <><h2>إدارة المدفوعات</h2>{renderPayments()}</>
      case 'customers':
        return <><h2>إدارة العملاء</h2>{renderCustomers()}</>
      case 'branches':
        return <><h2>الفروع والأجهزة</h2>{renderBranches()}</>
    }
  }

  const menuItems: { id: Section; label: string }[] = [
    { id: 'home', label: 'الرئيسية' },
    { id: 'bookings', label: 'الحجوزات' },
    { id: 'payments', label: 'المدفوعات' },
    { id: 'customers', label: 'العملاء' },
    { id: 'branches', label: 'الفروع والأجهزة' },
  ]

  return (
    <main className="app" dir="rtl">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />

      <nav className="navbar">
        <Brand onClick={onBack} />
        <button className="login-button" onClick={onBack}>
          العودة للحساب
        </button>
      </nav>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px minmax(0, 1fr)',
          gap: 20,
          padding: 20,
          alignItems: 'start',
        }}
      >
        <aside
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 15,
            position: 'sticky',
            top: 15,
          }}
        >
          <h3 style={{ margin: '5px 0 20px' }}>لوحة الإدارة</h3>

          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              style={{
                ...buttonStyle,
                background: section === item.id ? 'var(--surface-3)' : 'var(--surface-2)',
                marginBottom: 9,
                borderColor: section === item.id ? 'var(--wood)' : 'var(--border)',
              }}
            >
              {item.label}
            </button>
          ))}

          <button
            style={{ ...buttonStyle, marginTop: 15 }}
            disabled={loading || working}
            onClick={loadDashboard}
          >
            تحديث البيانات
          </button>
        </aside>

        <section
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            minHeight: 500,
            minWidth: 0,
          }}
        >
          {message && (
            <p style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>
              {message}
            </p>
          )}

          {renderContent()}
        </section>
      </div>
    </main>
  )
}

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('papa-yaga-theme')
    return savedTheme === 'dark' ? 'dark' : 'light'
  })

  const [showLogin, setShowLogin] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('papa-yaga-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((currentTheme) => currentTheme === 'light' ? 'dark' : 'light')
  }

  function goHome() {
    setShowLogin(false)
    setShowBooking(false)
    setShowAdmin(false)
    setEditing(false)
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (user || showLogin || showBooking || showAdmin || checkingAuth) return

    const elements = document.querySelectorAll(
      '.services .service-card, .branches > *'
    )

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )

    elements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [user, showLogin, showBooking, showAdmin, checkingAuth])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setCheckingAuth(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let active = true

    async function checkAdmin() {
      if (!user) {
        setIsAdmin(false)
        setShowAdmin(false)
        setCheckingAdmin(false)
        return
      }

      setCheckingAdmin(true)
      const { data, error } = await supabase.rpc('is_admin')

      if (active) {
        setIsAdmin(!error && data === true)
        setCheckingAdmin(false)
      }
    }

    checkAdmin()
    return () => { active = false }
  }, [user])

  useEffect(() => {
    let active = true

    async function loadProfile() {
      if (!user) {
        setProfile(null)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return

      if (error) {
        console.error('Profile error:', error.message)
        return
      }

      setProfile(data)
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [user])

  function startEditing() {
    setEditName(profile?.full_name || user.user_metadata?.full_name || '')
    setEditPhone(profile?.phone || '')
    setMessage('')
    setEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveProfile() {
    if (!editName.trim()) {
      setMessage('من فضلك أدخل اسمك بالكامل')
      return
    }

    if (!user?.id) {
      setMessage('انتهت جلسة تسجيل الدخول. سجل الدخول مرة أخرى.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          phone: editPhone.trim() || null,
        })
        .eq('id', user.id)
        .select('id, full_name, phone')
        .maybeSingle()

      if (error) {
        console.error('Profile update error:', error)
        setMessage('فشل حفظ البيانات: ' + error.message)
        return
      }

      if (!data) {
        setMessage('لم يتم العثور على سجل بياناتك في قاعدة البيانات.')
        console.error('No profile row updated for user:', user.id)
        return
      }

      setProfile({
        full_name: data.full_name,
        phone: data.phone,
      })

      setEditName(data.full_name || '')
      setEditPhone(data.phone || '')
      setEditing(false)
      setMessage('تم حفظ بياناتك بنجاح!')

      console.log('Profile saved successfully:', data)

    } catch (error) {
      console.error('Unexpected profile error:', error)
      setMessage('حدث خطأ غير متوقع أثناء حفظ البيانات.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      alert('حدث خطأ أثناء تسجيل الخروج')
      return
    }

    setUser(null)
    setProfile(null)
    setShowLogin(false)
    setShowBooking(false)
    setShowAdmin(false)
    setIsAdmin(false)
  }

  if (checkingAuth) {
    return (
      <div className="app" dir="rtl">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <nav className="navbar">
          <Brand onClick={goHome} />
        </nav>
        <p style={{ padding: 30 }}>جارٍ تحميل الصفحة...</p>
      </div>
    )
  }

  if (user) {
    if (showAdmin && isAdmin) {
      return (
        <AdminDashboard
          onBack={goHome}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )
    }

    if (showBooking) {
      return (
        <main className="app" dir="rtl">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <nav className="navbar">
            <Brand onClick={goHome} />
            <button className="login-button" onClick={goHome}>
              العودة للحساب
            </button>
          </nav>
          <Booking />
        </main>
      )
    }

    return (
      <main className="app" dir="rtl">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />

        <nav className="navbar">
          <Brand onClick={goHome} />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {!checkingAdmin && isAdmin && (
              <button className="main-button" onClick={() => setShowAdmin(true)}>
                لوحة الإدارة
              </button>
            )}

            <button className="login-button" onClick={handleLogout}>
              تسجيل الخروج
            </button>
          </div>
        </nav>

        <section className="hero">
          <p className="eyebrow">WELCOME TO PAPA YAGA</p>
          <h1>
            أهلاً بعودتك
            <br />
            <span>
              {profile?.full_name || user.user_metadata?.full_name || user.email}
            </span>
          </h1>
          <p className="hero-description">
            سعيدون بوجودك معنا. استمتع بتجربتك في papa yaga.
          </p>
        </section>

        <section className="services">
          <p className="eyebrow">MY ACCOUNT</p>
          <h2>حسابك الشخصي</h2>

          {!editing ? (
            <>
              <div className="service-grid">
                <article className="service-card">
                  <span>01</span>
                  <h3>الاسم بالكامل</h3>
                  <p>{profile?.full_name || 'لم يتم تسجيل الاسم بعد'}</p>
                </article>

                <article className="service-card">
                  <span>02</span>
                  <h3>البريد الإلكتروني</h3>
                  <p>{user.email}</p>
                </article>

                <article className="service-card">
                  <span>03</span>
                  <h3>رقم الهاتف</h3>
                  <p>{profile?.phone || 'لم تتم إضافة رقم الهاتف بعد'}</p>
                </article>

                <article className="service-card">
                  <span>04</span>
                  <h3>الحجوزات</h3>
                  <p>حجوزاتك ستظهر هنا قريبًا.</p>
                </article>
              </div>

              <button
                type="button"
                className="main-button"
                onClick={startEditing}
              >
                تعديل البيانات
              </button>

              <button
                type="button"
                className="main-button"
                onClick={() => setShowBooking(true)}
              >
                احجز الآن
              </button>
            </>
          ) : (
            <div
              className="profile-edit-card"
              style={{
                display: 'block',
                opacity: 1,
                visibility: 'visible',
                transform: 'none',
                position: 'relative',
                zIndex: 10,
                width: '100%',
                maxWidth: 650,
                margin: '20px auto',
                padding: 24,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            >
              <h3>تعديل بياناتك الشخصية</h3>

              <label
                htmlFor="edit-profile-name"
                style={{ display: 'block', marginBottom: 8 }}
              >
                الاسم بالكامل
              </label>

              <input
                id="edit-profile-name"
                type="text"
                placeholder="الاسم بالكامل"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  marginBottom: 18,
                  padding: 12,
                  color: 'var(--text)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              />

              <label
                htmlFor="edit-profile-phone"
                style={{ display: 'block', marginBottom: 8 }}
              >
                رقم الهاتف
              </label>

              <input
                id="edit-profile-phone"
                type="tel"
                placeholder="رقم الهاتف"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  marginBottom: 20,
                  padding: 12,
                  color: 'var(--text)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              />

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="main-button"
                  onClick={saveProfile}
                  disabled={saving}
                >
                  {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                </button>

                <button
                  type="button"
                  className="login-button"
                  onClick={() => {
                    setEditing(false)
                    setMessage('')
                  }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {message && <p>{message}</p>}
        </section>
      </main>
    )
  }

  if (showLogin) {
    return (
      <main className="app" dir="rtl">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <nav className="navbar">
          <Brand onClick={goHome} />
          <button className="login-button" onClick={goHome}>
            الرئيسية
          </button>
        </nav>
        <Login />
      </main>
    )
  }

  return (
    <main className="app" dir="rtl">
      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      <nav className="navbar">
        <Brand onClick={goHome} />

        <div className="nav-links">
          <a href="#home">الرئيسية</a>
          <a href="#services">خدماتنا</a>
          <a href="#branches">الفروع</a>
        </div>

        <button className="login-button" onClick={() => setShowLogin(true)}>
          تسجيل الدخول
        </button>
      </nav>

      <section className="hero" id="home">
        <p className="eyebrow">YOUR EXPERIENCE STARTS HERE</p>
        <h1>
          أكثر من مجرد
          <br />
          <span>مكان للترفيه</span>
        </h1>
        <p className="hero-description">
          العب، استمتع، واكتشف تجربة مختلفة مع papa yaga.
        </p>
        <button className="main-button" onClick={() => setShowLogin(true)}>
          احجز تجربتك الآن
        </button>
      </section>

      <section className="services" id="services">
        <p className="eyebrow">DISCOVER OUR WORLD</p>
        <h2>اكتشف خدماتنا</h2>

        <div className="service-grid">
          <article className="service-card">
            <span>01</span>
            <h3>PlayStation</h3>
            <p>تجربة ألعاب مميزة مع أصدقائك.</p>
          </article>

          <article className="service-card">
            <span>02</span>
            <h3>Private Rooms</h3>
            <p>خصوصية وراحة وتجربة مشاهدة ممتعة.</p>
          </article>

          <article className="service-card">
            <span>03</span>
            <h3>Restaurant & Cafe</h3>
            <p>أكلات ومشروبات تناسب وقتك.</p>
          </article>

          <article className="service-card">
            <span>04</span>
            <h3>Billiards</h3>
            <p>استمتع بتحدي البلياردو.</p>
          </article>
        </div>
      </section>

      <section className="branches" id="branches">
        <p className="eyebrow">FIND US</p>
        <h2>فروعنا في دمياط</h2>
        <p>فرعان على كورنيش النيل، وتجربة واحدة مميزة.</p>
      </section>

      <footer>
        <Brand onClick={goHome} />
        <p>© 2026 papa yaga. All rights reserved.</p>
      </footer>
    </main>
  )
}

export default App
