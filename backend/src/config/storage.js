const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } = require('@azure/storage-blob')
const { v4: uuidv4 } = require('uuid')
const path = require('path')

const credential = new StorageSharedKeyCredential(
  process.env.AZURE_STORAGE_ACCOUNT,
  process.env.AZURE_STORAGE_KEY
)
const blobServiceClient = new BlobServiceClient(
  `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
  credential
)
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'erp-documents'

const uploadFile = async (buffer, originalName, folder = 'documents') => {
  const ext = path.extname(originalName)
  const key = `${folder}/${uuidv4()}${ext}`
  const blockBlobClient = blobServiceClient
    .getContainerClient(CONTAINER)
    .getBlockBlobClient(key)

  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: getContentType(ext) },
  })

  return key
}

const getFileUrl = async (key, expiresIn = 3600) => {
  const blobClient = blobServiceClient
    .getContainerClient(CONTAINER)
    .getBlobClient(key)

  return blobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse('r'),
    expiresOn: new Date(Date.now() + expiresIn * 1000),
  })
}

const deleteFile = async (key) => {
  await blobServiceClient
    .getContainerClient(CONTAINER)
    .getBlockBlobClient(key)
    .delete()
}

const downloadFile = async (key) => {
  const blobClient = blobServiceClient.getContainerClient(CONTAINER).getBlobClient(key)
  const dl = await blobClient.download()
  return new Promise((resolve, reject) => {
    const chunks = []
    dl.readableStreamBody.on('data', c => chunks.push(c))
    dl.readableStreamBody.on('end', () => resolve(Buffer.concat(chunks)))
    dl.readableStreamBody.on('error', reject)
  })
}

const getContentType = (ext) => {
  const types = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return types[ext.toLowerCase()] || 'application/octet-stream'
}

module.exports = { uploadFile, getFileUrl, deleteFile, downloadFile }
