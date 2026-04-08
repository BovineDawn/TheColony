import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App'

// Note: StrictMode removed to prevent Pixi.js v8 double-mount conflict
createRoot(document.getElementById('root')!).render(<App />)
