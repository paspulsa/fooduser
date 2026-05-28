import { createApp } from 'honox/server'
import apiRouter from '../src/index'

const app = createApp()

// Memasang seluruh API backend Anda agar tetap bisa diakses melalui /api/v1/...
app.route('/', apiRouter)

export default app
