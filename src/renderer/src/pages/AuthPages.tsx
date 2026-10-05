import { useState, type FormEvent } from 'react'
import logoDark from '../assets/logo-dark.png'
import { useAuth } from '../auth/useAuth'
import { Alert, Button, Card, Field } from '../components/ui'

function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src={logoDark} alt="413" className="mx-auto mb-3 h-36 w-auto" draggable={false} />
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {children}
      </Card>
    </div>
  )
}

export function SetupPage(): React.JSX.Element {
  const { setup } = useAuth()
  const [form, setForm] = useState({
    businessName: '413',
    name: '',
    username: '',
    password: '',
    confirm: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden')
    setBusy(true)
    setError(null)
    const err = await setup({
      businessName: form.businessName,
      name: form.name,
      username: form.username,
      password: form.password
    })
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <AuthShell title="Bienvenido" subtitle="Crea tu usuario administrador para comenzar">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre del negocio" value={form.businessName} onChange={set('businessName')} />
        <Field label="Tu nombre" value={form.name} onChange={set('name')} autoFocus />
        <Field label="Usuario" value={form.username} onChange={set('username')} />
        <Field
          label="Contraseña"
          type="password"
          hint="Mínimo 6 caracteres"
          value={form.password}
          onChange={set('password')}
        />
        <Field
          label="Confirmar contraseña"
          type="password"
          value={form.confirm}
          onChange={set('confirm')}
        />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>
          Crear y entrar
        </Button>
      </form>
    </AuthShell>
  )
}

export function LoginPage(): React.JSX.Element {
  const { login, businessName } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await login(username, password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <AuthShell title={businessName} subtitle="Inicia sesión para continuar">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <Field
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>
          Entrar
        </Button>
      </form>
    </AuthShell>
  )
}
