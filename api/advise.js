import { handleAdvise } from './_core/handlers.js'
import { vercelPost } from './_core/vercel.js'

export default vercelPost('advise', handleAdvise)
