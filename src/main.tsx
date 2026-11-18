// Entry for the single-file Claude artifact build (Vite). The Next.js app has its own entry in app/.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { buildCatalog } from './content/catalog'
import { weeks, midterm, finalExam } from './content/course'
import { localBackend } from './platform/local-backend'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App catalog={buildCatalog(weeks, [midterm, finalExam])} backend={localBackend()} />
  </StrictMode>,
)
