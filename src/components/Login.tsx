
import '../Auth.css'
import { useState } from 'react'
import { supabase } from '../supabase'

function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function saveProfile(user: any, fullName: string) {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: fullName,
      })

    if (error) throw error
  }

  async function handleSubmit() {
    setMessage('')

    if (!email || !password) {
      setMessage('من فضلك أدخل البريد الإلكتروني وكلمة المرور')
      return
    }

    if (isRegister && !name.trim()) {
      setMessage('من فضلك أدخل اسمك بالكامل')
      return
    }

    if (isRegister && password !== confirmPassword) {
      setMessage('كلمتا المرور غير متطابقتين')
      return
    }

    if (password.length < 6) {
      setMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }

    setLoading(true)

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name.trim(),
            },
          },
        })

        if (error) throw error

        if (data.user && data.session) {
          await saveProfile(data.user, name.trim())
          setMessage('تم إنشاء حسابك وحفظ بياناتك بنجاح!')
        } else {
          setMessage('تم إنشاء الحساب. أكد بريدك الإلكتروني ثم سجل الدخول.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        // لا نعيد كتابة الاسم عند تسجيل الدخول
        setMessage('تم تسجيل الدخول بنجاح!')
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'حدث خطأ، حاول مرة أخرى'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" dir="rtl">
      <div className="auth-card">
        <div className="auth-logo">papa yaga</div>

        <h1>{isRegister ? 'إنشاء حساب جديد' : 'أهلاً بعودتك'}</h1>

        <p className="auth-description">
          {isRegister
            ? 'أنشئ حسابك واستمتع بتجربتنا'
            : 'سجل دخولك لمتابعة حجوزاتك'}
        </p>

        {isRegister && (
          <input
            type="text"
            placeholder="الاسم بالكامل"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}

        <input
          type="email"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {isRegister && (
          <input
            type="password"
            placeholder="تأكيد كلمة المرور"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        )}

        <button
          className="auth-submit"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading
            ? 'جارٍ التنفيذ...'
            : isRegister
              ? 'إنشاء الحساب'
              : 'تسجيل الدخول'}
        </button>

        {message && <p>{message}</p>}

        <div className="auth-switch">
          {isRegister ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟'}

          <button
            onClick={() => {
              setIsRegister(!isRegister)
              setMessage('')
            }}
          >
            {isRegister ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </button>
        </div>

        <button
          className="auth-back"
          onClick={() => window.location.href = '/'}
        >
          العودة للرئيسية
        </button>
      </div>
    </div>
  )
}

export default Login
