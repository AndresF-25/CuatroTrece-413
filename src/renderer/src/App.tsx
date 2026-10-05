import { Store } from 'lucide-react'

function App(): React.JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <Store className="mx-auto mb-3 h-10 w-10 text-slate-700" />
        <h1 className="text-3xl font-semibold">413</h1>
        <p className="mt-1 text-slate-500">Sistema de contabilidad local</p>
      </div>
    </div>
  )
}

export default App
