import { signatureHelper } from '@kentico/kontent-webhook-helper'
import { getPostByCodename } from '../../lib/api'

export default async function revalidate(req, res) {
  // ensure webhook request is authentic
  if (!isValidWebhookRequest(req)) {
    return res.status(401).json({ message: 'Invalid signature' })
  }

  // extract the post codenames to revalidate from the incoming request
  const postCodenames = getPostCodenamesFromWebhookRequest(req)

  if (isEmpty(postCodenames)) {
    return res.status(204).send() // nothing to revalidate
  }

  // convert the post codenames to url paths to revalidate
  const pathsToRevalidate = await Promise.all(
    postCodenames.map(getPostPathForCodename)
  ).catch(() => {
    return res.status(404).json({ message: 'Invalid codename(s)' })
  })

  // revalidate the posts
  try {
    await Promise.all(pathsToRevalidate.map((path) => res.revalidate(path)))
    console.log(`[api/revalidate] revalidated: ${pathsToRevalidate.join(', ')}`)

    return res.status(200).json({ revalidated: true })
  } catch (error) {
    console.error(`[api/revalidate] error: ${error.message}`)

    return res.status(500).json({ message: 'Error revalidating' })
  }
}

// https://github.com/kentico/kontent-webhook-helper-js/#signature-verification
function isValidWebhookRequest(req) {
  const payload = JSON.stringify(req.body, null, 2).replace(/[\r\n]+/g, '\r\n')
  const secret = process.env.KONTENT_WEBHOOK_SECRET
  const signature = req.headers['x-kc-signature']

  return signatureHelper.isValidSignatureFromString(payload, secret, signature)
}

function getPostCodenamesFromWebhookRequest(req) {
  return req.body.data.items
    .map(({ codename, type }) => {
      if (type !== 'post') return

      return codename
    })
    .filter((el) => el) // remove empty (non post) elements
}

function isEmpty(array) {
  return array.length === 0
}

async function getPostPathForCodename(codename) {
  const post = await getPostByCodename(codename)

  if (!post) {
    throw new Error('Invalid codename')
  }

  return `/posts/${post.slug}`
}
